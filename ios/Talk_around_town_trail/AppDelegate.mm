#import "AppDelegate.h"
#import <AVFoundation/AVFoundation.h>
#import <React/RCTBundleURLProvider.h>
#import <GoogleMaps/GoogleMaps.h>
#import <UserNotifications/UserNotifications.h>
#import <RNCPushNotificationIOS/RNCPushNotificationIOS.h>
#import <Firebase.h>
#import <FirebaseMessaging.h>
#import <FirebaseCore.h>

@interface AppDelegate () <UNUserNotificationCenterDelegate, FIRMessagingDelegate>
@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // Configure Firebase first
  [FIRApp configure];
  [FIRMessaging messaging].delegate = self;

  // Configure Google Maps with correct API key
  [GMSServices provideAPIKey:@"AIzaSyBczo2yBRbSwa4IVQagZKNfTje0JJ_HEps"];

  // Audio Session setup
  AVAudioSession *audioSession = [AVAudioSession sharedInstance];
  NSError *error;
  [audioSession setCategory:AVAudioSessionCategoryPlayAndRecord
                withOptions:AVAudioSessionCategoryOptionDefaultToSpeaker | AVAudioSessionCategoryOptionMixWithOthers
                      error:&error];
  if (error) {
    NSLog(@"Error setting audio session category: %@", error);
  }

  self.moduleName = @"ENACT";
  self.initialProps = @{};

  // Configure UNUserNotificationCenter
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  center.delegate = self;

  // Request notification permissions with better error handling
  UNAuthorizationOptions authOptions = UNAuthorizationOptionAlert |
      UNAuthorizationOptionSound | UNAuthorizationOptionBadge;
  [center requestAuthorizationWithOptions:authOptions
      completionHandler:^(BOOL granted, NSError * _Nullable error) {
        if (error) {
          NSLog(@"Error requesting notification authorization: %@", error);
        } else if (granted) {
          dispatch_async(dispatch_get_main_queue(), ^{
            [application registerForRemoteNotifications];
          });
        }
  }];

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

// Enhanced Firebase messaging delegate method
- (void)messaging:(FIRMessaging *)messaging didReceiveRegistrationToken:(NSString *)fcmToken {
    NSLog(@"FCM registration token: %@", fcmToken);
    if (fcmToken) {
        // Store token locally if needed
        [[NSUserDefaults standardUserDefaults] setObject:fcmToken forKey:@"fcmToken"];
        [[NSUserDefaults standardUserDefaults] synchronize];
        
        // Post notification for the React Native side
        [[NSNotificationCenter defaultCenter] postNotificationName:
         @"FCMToken" object:nil userInfo:@{@"token": fcmToken}];
    }
}

// Enhanced device token handling
- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
{
  [RNCPushNotificationIOS didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
  [FIRMessaging messaging].APNSToken = deviceToken;
  
  // Log the token for debugging with proper type casting
  const unsigned char *tokenBytes = (const unsigned char *)[deviceToken bytes];
  NSMutableString *token = [NSMutableString string];
  for (NSUInteger i = 0; i < [deviceToken length]; i++) {
    [token appendFormat:@"%02.2hhX", tokenBytes[i]];
  }
  NSLog(@"Device Token: %@", token);
}

// Enhanced remote notification handling
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)userInfo
fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler
{
  NSLog(@"Received remote notification: %@", userInfo);
  
  if ([[FIRMessaging messaging] appDidReceiveMessage:userInfo]) {
    // Handle Firebase message
    completionHandler(UIBackgroundFetchResultNewData);
  } else {
    // Handle RNC message
    [RNCPushNotificationIOS didReceiveRemoteNotification:userInfo fetchCompletionHandler:completionHandler];
  }
}

// Enhanced error handling
- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
{
  NSLog(@"Failed to register for remote notifications: %@", error);
  [RNCPushNotificationIOS didFailToRegisterForRemoteNotificationsWithError:error];
}

// Enhanced local notification handling
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler
{
  NSDictionary *userInfo = response.notification.request.content.userInfo;
  NSLog(@"Received notification response: %@", userInfo);
  [RNCPushNotificationIOS didReceiveNotificationResponse:response];
  completionHandler();
}

// Enhanced foreground notification handling
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions options))completionHandler
{
  NSDictionary *userInfo = notification.request.content.userInfo;
  NSLog(@"Will present notification: %@", userInfo);
  
  if ([[FIRMessaging messaging] appDidReceiveMessage:userInfo]) {
    // Firebase message: the JS onMessage handler displays it via Notifee.
    // Passing any presentation options here would cause a duplicate banner.
    completionHandler(UNNotificationPresentationOptionNone);
  } else {
    // Local / non-Firebase notification — let the OS present it normally.
    completionHandler(UNNotificationPresentationOptionSound |
                     UNNotificationPresentationOptionAlert |
                     UNNotificationPresentationOptionBadge);
  }
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@".expo/.virtual-metro-entry"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
