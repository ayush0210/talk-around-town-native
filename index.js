// AppRegistry.registerComponent(appName, () => App);
/**
 * @format
 */
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import 'react-native-get-random-values';
import PushNotification from 'react-native-push-notification';
import {navigationRef} from './src/ref/NavigationRef';
import {Platform} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, {AndroidImportance} from '@notifee/react-native';
import BackgroundFetch from 'react-native-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import {BASE_URL} from './src/config';

// Improved navigation function with retry mechanism
const navigateToNotification = (title, message, data) => {
  console.log('⭐ NAVIGATION ATTEMPT with data:', {
    title,
    message,
    locationType: data?.locationType,
    locationName: data?.locationName,
    dataKeys: Object.keys(data || {}),
  });

  // Use a more robust approach with multiple retries
  const maxAttempts = 5;
  let attempts = 0;

  const attemptNavigation = () => {
    attempts++;
    console.log(`Navigation attempt ${attempts}/${maxAttempts}`);

    if (navigationRef.current) {
      try {
        // First ensure we're in the Main navigator
        const currentRoute = navigationRef.current.getCurrentRoute();
        console.log('Current route:', currentRoute?.name);

        if (currentRoute?.name !== 'Main') {
          console.log('Navigating to Main first');
          navigationRef.current.navigate('Main');

          // Then navigate to Tips after a longer delay
          setTimeout(() => {
            console.log('Now navigating to Tips screen with notification data');
            navigationRef.current.navigate('Tips', {
              notificationData: {
                title,
                message,
                ...data,
              },
            });
            console.log('Navigation completed');
          }, 500); // Increased delay for better reliability
        } else {
          // Already in Main, navigate directly
          console.log('Already in Main, navigating to Tips');
          navigationRef.current.navigate('Tips', {
            notificationData: {
              title,
              message,
              ...data,
            },
          });
          console.log('Navigation completed');
        }
        return true; // Navigation succeeded
      } catch (error) {
        console.error('Navigation error:', error);
        return false; // Navigation failed
      }
    } else {
      console.log('Navigation ref not available');
      return false;
    }
  };

  // Try immediately
  if (attemptNavigation()) {
    return; // Success on first try
  }

  // If first attempt fails, retry a few times with increasing delays
  const retryInterval = setInterval(() => {
    if (attempts >= maxAttempts || attemptNavigation()) {
      clearInterval(retryInterval);
      if (attempts >= maxAttempts) {
        console.error('Failed to navigate after maximum attempts');
      }
    }
  }, 800);
};

// Enable comprehensive notification logging
const enableNotificationLogging = () => {
  // Log FCM token refreshes
  messaging().onTokenRefresh(token => {
    console.log('FCM token refreshed:', token);
  });

  // Handle app opened by tapping a background notification (iOS)
  messaging().onNotificationOpenedApp(message => {
    console.log('App opened via notification:', message);
    const { data, notification } = message;
    const title = data?.title || notification?.title || 'New Notification';
    const body = data?.message || data?.body || notification?.body || '';
    navigateToNotification(title, body, {
      ...data,
      tipDetail: body,
      tipCategory: data?.locationType || 'Tip',
    });
  });

  // Handle app launched from killed state by tapping a notification (iOS)
  messaging()
    .getInitialNotification()
    .then(message => {
      if (message) {
        console.log('App launched via notification:', message);
        const { data, notification } = message;
        const title = data?.title || notification?.title || 'New Notification';
        const body = data?.message || data?.body || notification?.body || '';
        // Delay navigation to allow the navigator to mount first
        setTimeout(() => {
          navigateToNotification(title, body, {
            ...data,
            tipDetail: body,
            tipCategory: data?.locationType || 'Tip',
          });
        }, 1000);
      }
    });
};

// Call this function to enable all notification logging
enableNotificationLogging();

console.log('🔔 Registering FCM message handlers...');

// Register notifee background event handler (required for notifee to work in background)
notifee.onBackgroundEvent(async ({type, detail}) => {
  console.log('📲 Notifee background event:', type, detail.notification?.id);
  if (type === 3 /* EventType.PRESS */ && detail.notification?.data) {
    const d = detail.notification.data;
    // Skip recording-related notifications — they don't navigate to tips
    if (d.type === 'recording') {return;}
    const title = d.title || 'New Notification';
    const body = d.message || d.body || '';
    console.log('📲 Notifee background press:', {title, body});
    navigateToNotification(title, body, {
      ...d,
      tipDetail: body,
      tipCategory: d.locationType || 'Tip',
    });
  }
});

// Handle foreground notifee notification taps (both iOS and Android)
notifee.onForegroundEvent(({type, detail}) => {
  if (type === 3 /* EventType.PRESS */ && detail.notification?.data) {
    const d = detail.notification.data;
    // Skip recording-related notifications — they don't navigate to tips
    if (d.type === 'recording') {return;}
    const title = d.title || 'New Notification';
    const body = d.message || d.body || '';
    console.log('📲 Notifee foreground press:', {title, body});
    navigateToNotification(title, body, {
      ...d,
      tipDetail: body,
      tipCategory: d.locationType || 'Tip',
    });
  }
});

// Enhanced background message handler with better data preservation
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('📩 Background message received:', remoteMessage);

  // Android messages are data-only — no notification field, so no OS auto-display.
  // Always display via notifee here.
  // (iOS background messages use the notification field for auto-display and are
  // handled by APNs directly; this handler primarily runs on Android.)

  const title =
    remoteMessage.data?.title ||
    remoteMessage.notification?.title ||
    'New notification';

  const message =
    remoteMessage.data?.message ||
    remoteMessage.data?.body ||
    remoteMessage.notification?.body ||
    'You have a new notification';

  const enhancedData = {
    ...remoteMessage.data,
    title,
    message,
    _receivedAt: new Date().toISOString(),
    _isBackground: 'true',
  };

  // Note: remoteMessage.data.tips is already a string (JSON), which is valid for notifee.
  // Do not parse it here — keep it as a string so notifee doesn't reject it.

  // Android: use notifee — creates the channel inline and works reliably
  // in headless/background mode (unlike react-native-push-notification).
  const channelId = await notifee.createChannel({
    id: 'location-tips',
    name: 'Location Tips',
    importance: AndroidImportance.HIGH,
  });

  await notifee.displayNotification({
    title,
    body: message,
    data: enhancedData,
    android: {
      channelId,
      importance: AndroidImportance.HIGH,
      pressAction: {id: 'default'},
    },
  });
});

// Foreground notification handling (both iOS and Android)
console.log('🔔 Registering foreground message handler...');
messaging().onMessage(async remoteMessage => {
  console.log('📩 Foreground message received:', remoteMessage);

  const title =
    remoteMessage.data?.title ||
    remoteMessage.notification?.title ||
    'New notification';

  const message =
    remoteMessage.data?.message ||
    remoteMessage.data?.body ||
    remoteMessage.notification?.body ||
    'You have a new notification';

  const enhancedData = {
    ...remoteMessage.data,
    title,
    message,
    _receivedAt: new Date().toISOString(),
    _isForeground: 'true',
  };

  // Note: remoteMessage.data.tips is already a string (JSON), which is valid for notifee.
  // Do not parse it here — keep it as a string so notifee doesn't reject it.

  // Use notifee for foreground display — reliable on both Android and iOS.
  // (On iOS, FCM suppresses notification-type messages while in foreground,
  // so we must display them manually regardless of platform.)
  const channelId = await notifee.createChannel({
    id: 'location-tips',
    name: 'Location Tips',
    importance: AndroidImportance.HIGH,
  });

  await notifee.displayNotification({
    title,
    body: message,
    data: enhancedData,
    android: {
      channelId,
      importance: AndroidImportance.HIGH,
      pressAction: {id: 'default'},
    },
    ios: {
      sound: 'default',
      foregroundPresentationOptions: {
        alert: true,
        badge: true,
        sound: true,
      },
    },
  });
});

// Request permissions explicitly for iOS
if (Platform.OS === 'ios') {
  messaging()
    .requestPermission()
    .then(authStatus => {
      console.log('iOS notification permission status:', authStatus);
    });
}

// Create notification channels (don't delete existing - just ensure they exist)
console.log('📱 Setting up notification channels...');

PushNotification.channelExists('location-tips', exists => {
  if (!exists) {
    PushNotification.createChannel(
      {
        channelId: 'location-tips',
        channelName: 'Location Tips',
        channelDescription: 'Notifications for location updates',
        importance: 4,
        vibrate: true,
      },
      created => console.log(`Main channel created: ${created}`),
    );
  } else {
    console.log('Main channel already exists');
  }
});

PushNotification.channelExists('app-reminders', exists => {
  if (!exists) {
    PushNotification.createChannel(
      {
        channelId: 'app-reminders',
        channelName: 'App Reminders',
        channelDescription: 'Reminders to open the app',
        importance: 4,
        vibrate: true,
      },
      created => console.log(`Reminders channel created: ${created}`),
    );
  } else {
    console.log('Reminders channel already exists');
  }
});

// Enhanced notification configuration with better debugging
PushNotification.configure({
  onRegister: function (token) {
    console.log('PushNotification TOKEN:', token);
  },

  onNotification: function (notification) {
    // Navigation on tap is handled by messaging().onNotificationOpenedApp()
    // and messaging().getInitialNotification() to avoid double navigation.
    // Required on iOS
    notification.finish && notification.finish();
  },

  permissions: {
    alert: true,
    badge: true,
    sound: true,
  },

  popInitialNotification: true,
  requestPermissions: true,
});

// Headless task for BackgroundFetch - runs when app is killed
const headlessTask = async (event) => {
  const taskId = event.taskId;
  const isTimeout = event.timeout;

  if (isTimeout) {
    console.log('[BackgroundFetch Headless] Task timed out:', taskId);
    BackgroundFetch.finish(taskId);
    return;
  }

  console.log('[BackgroundFetch Headless] Starting task:', taskId);

  try {
    const userInfoStr = await AsyncStorage.getItem('userInfo');
    if (!userInfoStr) {
      console.log('[BackgroundFetch Headless] No user info, skipping');
      BackgroundFetch.finish(taskId);
      return;
    }

    const userInfo = JSON.parse(userInfoStr);
    if (!userInfo.access_token) {
      console.log('[BackgroundFetch Headless] No access token, skipping');
      BackgroundFetch.finish(taskId);
      return;
    }

    // Get current position
    const coords = await new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        error => reject(error),
        {
          enableHighAccuracy: false,
          timeout: 30000,
          maximumAge: 60000,
        },
      );
    });

    console.log('[BackgroundFetch Headless] Got location:', coords);

    // Send to server for geofence check
    const response = await fetch(`${BASE_URL}/endpoint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userInfo.access_token}`,
      },
      body: JSON.stringify({
        latitude: coords.latitude,
        longitude: coords.longitude,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('[BackgroundFetch Headless] Server response:', result);
    }
  } catch (error) {
    console.error('[BackgroundFetch Headless] Error:', error);
  }

  BackgroundFetch.finish(taskId);
};

// Register the headless task for Android
BackgroundFetch.registerHeadlessTask(headlessTask);

// Required by notifee to display foreground service notifications on Android.
// The promise must stay pending for the duration of the foreground service.
notifee.registerForegroundService(() => new Promise(() => {}));

AppRegistry.registerComponent(appName, () => App);
