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
import DLogger from './src/diagnostics/DiagnosticsLogger';

// ─── Diagnostic: app startup ────────────────────────────────────────────────
DLogger.log('APP_STARTUP', {
  platform: Platform.OS,
  platformVersion: String(Platform.Version),
  deviceInfo: DLogger.deviceInfo,
  timestamp: new Date().toISOString(),
});

// Improved navigation function with retry mechanism
const navigateToNotification = (title, message, data) => {
  DLogger.log('NAV_ATTEMPT', {
    title,
    locationType: data?.locationType,
    locationName: data?.locationName,
    dataKeys: Object.keys(data || {}),
  });

  console.log('⭐ NAVIGATION ATTEMPT with data:', {
    title,
    message,
    locationType: data?.locationType,
    locationName: data?.locationName,
    dataKeys: Object.keys(data || {}),
  });

  const maxAttempts = 5;
  let attempts = 0;

  const attemptNavigation = () => {
    attempts++;
    DLogger.log('NAV_TRY', {attempt: attempts, maxAttempts, hasRef: !!navigationRef.current});
    console.log(`Navigation attempt ${attempts}/${maxAttempts}`);

    if (!navigationRef.current) {
      console.log('Navigation ref not available');
      return false;
    }

    try {
      const currentRoute = navigationRef.current.getCurrentRoute();
      console.log('Current route:', currentRoute?.name);

      // Tips is in the RootStack — navigate directly from any screen.
      navigationRef.current.navigate('Tips', {
        notificationData: {title, message, ...data},
      });
      DLogger.log('NAV_SUCCESS', {attempt: attempts, route: 'Tips', title}, true);
      console.log('Navigation to Tips completed');
      return true;
    } catch (error) {
      DLogger.log('NAV_ERROR', {attempt: attempts, error: String(error?.message ?? error)}, true);
      console.error('Navigation error:', error);
      return false;
    }
  };

  if (attemptNavigation()) {
    return;
  }

  const retryInterval = setInterval(() => {
    if (attempts >= maxAttempts || attemptNavigation()) {
      clearInterval(retryInterval);
      if (attempts >= maxAttempts) {
        DLogger.log('NAV_EXHAUSTED', {maxAttempts, title}, true);
        console.error('Failed to navigate after maximum attempts');
      }
    }
  }, 800);
};

// Enable comprehensive notification logging
const enableNotificationLogging = () => {
  messaging().onTokenRefresh(token => {
    DLogger.log('FCM_TOKEN_REFRESH', {tokenPrefix: token?.substring(0, 16)});
    console.log('FCM token refreshed:', token);
  });

  // Handle app opened by tapping a background notification
  messaging().onNotificationOpenedApp(message => {
    const {data, notification} = message;
    const title = data?.title || notification?.title || 'New Notification';
    const body = data?.message || data?.body || notification?.body || '';
    DLogger.log('FCM_APP_OPENED_FROM_NOTIFICATION', {title, hasData: !!data, hasNotif: !!notification}, true);
    DLogger.updateState({lastNotificationTapped: {timestamp: new Date().toISOString(), title}});
    console.log('App opened via notification:', message);
    navigateToNotification(title, body, {
      ...data,
      tipDetail: body,
      tipCategory: data?.locationType || 'Tip',
    });
  });

  // Handle app launched from killed state by tapping a notification
  messaging()
    .getInitialNotification()
    .then(message => {
      if (message) {
        const {data, notification} = message;
        const title = data?.title || notification?.title || 'New Notification';
        const body = data?.message || data?.body || notification?.body || '';
        DLogger.log('FCM_INITIAL_NOTIFICATION', {title, hasData: !!data, hasNotif: !!notification}, true);
        DLogger.updateState({lastNotificationTapped: {timestamp: new Date().toISOString(), title}});
        console.log('App launched via notification:', message);
        setTimeout(() => {
          navigateToNotification(title, body, {
            ...data,
            tipDetail: body,
            tipCategory: data?.locationType || 'Tip',
          });
        }, 1000);
      } else {
        DLogger.log('FCM_INITIAL_NOTIFICATION_NONE', {});
      }
    });
};

enableNotificationLogging();

console.log('🔔 Registering FCM message handlers...');
DLogger.log('FCM_HANDLER_REGISTRATION_START', {platform: Platform.OS});

// Register notifee background event handler
notifee.onBackgroundEvent(async ({type, detail}) => {
  DLogger.log('NOTIFEE_BG_EVENT', {
    type,
    notifId: detail.notification?.id,
    title: detail.notification?.title,
    dataType: detail.notification?.data?.type,
  }, true);
  console.log('📲 Notifee background event:', type, detail.notification?.id);

  if (type === 3 /* EventType.PRESS */ && detail.notification?.data) {
    const d = detail.notification.data;
    if (d.type === 'recording') {return;}
    const title = d.title || 'New Notification';
    const body = d.message || d.body || '';
    DLogger.log('NOTIFEE_BG_TAP', {title, body: body.substring(0, 60)}, true);
    DLogger.updateState({lastNotificationTapped: {timestamp: new Date().toISOString(), title}});
    console.log('📲 Notifee background press:', {title, body});
    navigateToNotification(title, body, {
      ...d,
      tipDetail: body,
      tipCategory: d.locationType || 'Tip',
    });
  }
});

// Handle foreground notifee notification taps
notifee.onForegroundEvent(({type, detail}) => {
  DLogger.log('NOTIFEE_FG_EVENT', {
    type,
    notifId: detail.notification?.id,
    title: detail.notification?.title,
    dataType: detail.notification?.data?.type,
  }, true);

  if (type === 3 /* EventType.PRESS */ && detail.notification?.data) {
    const d = detail.notification.data;
    if (d.type === 'recording') {return;}
    const title = d.title || 'New Notification';
    const body = d.message || d.body || '';
    DLogger.log('NOTIFEE_FG_TAP', {title, body: body.substring(0, 60)}, true);
    DLogger.updateState({lastNotificationTapped: {timestamp: new Date().toISOString(), title}});
    console.log('📲 Notifee foreground press:', {title, body});
    navigateToNotification(title, body, {
      ...d,
      tipDetail: body,
      tipCategory: d.locationType || 'Tip',
    });
  }
});

// Enhanced background message handler
messaging().setBackgroundMessageHandler(async remoteMessage => {
  // iOS: the backend sends a proper notification+apns payload so APNs already
  // displayed the banner. Calling notifee.displayNotification here would
  // produce a duplicate. Tap navigation is handled by onNotificationOpenedApp
  // and getInitialNotification. Return early and let APNs own display.
  if (Platform.OS === 'ios') {
    DLogger.log('FCM_BG_MESSAGE_IOS_SKIP', {
      title: remoteMessage.data?.title,
      hasNotification: !!remoteMessage.notification,
    }, true);
    return;
  }

  const title =
    remoteMessage.data?.title ||
    remoteMessage.notification?.title ||
    'New notification';
  const message =
    remoteMessage.data?.message ||
    remoteMessage.data?.body ||
    remoteMessage.notification?.body ||
    'You have a new notification';

  DLogger.log('FCM_BG_MESSAGE_RECEIVED', {
    title,
    hasNotificationField: !!remoteMessage.notification,
    hasDataField: !!remoteMessage.data,
    dataKeys: Object.keys(remoteMessage.data || {}),
    hasTips: !!remoteMessage.data?.tips,
  }, true);
  DLogger.updateState({
    lastNotificationReceived: {timestamp: new Date().toISOString(), title, source: 'fcm_background'},
  });

  console.log('📩 Background message received:', remoteMessage);

  const enhancedData = {
    ...remoteMessage.data,
    title,
    message,
    _receivedAt: new Date().toISOString(),
    _isBackground: 'true',
  };

  let channelId;
  try {
    channelId = await notifee.createChannel({
      id: 'location-tips',
      name: 'Location Tips',
      importance: AndroidImportance.HIGH,
    });
    DLogger.log('NOTIFEE_CHANNEL_CREATED', {channelId});
  } catch (chanErr) {
    DLogger.log('NOTIFEE_CHANNEL_ERROR', {error: String(chanErr?.message)}, true);
    channelId = 'location-tips';
  }

  DLogger.log('NOTIFEE_DISPLAY_ATTEMPT', {title, channelId, appState: 'background'}, true);
  try {
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
    DLogger.log('NOTIFEE_DISPLAY_SUCCESS', {title, channelId}, true);
    DLogger.updateState({
      lastNotificationDisplayed: {timestamp: new Date().toISOString(), title},
    });
  } catch (displayErr) {
    DLogger.log('NOTIFEE_DISPLAY_ERROR', {title, error: String(displayErr?.message), channelId}, true);
    console.error('📩 notifee.displayNotification failed:', displayErr);
  }
});

// Foreground notification handling
console.log('🔔 Registering foreground message handler...');
messaging().onMessage(async remoteMessage => {
  const title =
    remoteMessage.data?.title ||
    remoteMessage.notification?.title ||
    'New notification';
  const message =
    remoteMessage.data?.message ||
    remoteMessage.data?.body ||
    remoteMessage.notification?.body ||
    'You have a new notification';

  DLogger.log('FCM_FG_MESSAGE_RECEIVED', {
    title,
    hasNotificationField: !!remoteMessage.notification,
    hasDataField: !!remoteMessage.data,
    hasTips: !!remoteMessage.data?.tips,
  }, true);
  DLogger.updateState({
    lastNotificationReceived: {timestamp: new Date().toISOString(), title, source: 'fcm_foreground'},
  });

  console.log('📩 Foreground message received:', remoteMessage);

  const enhancedData = {
    ...remoteMessage.data,
    title,
    message,
    _receivedAt: new Date().toISOString(),
    _isForeground: 'true',
  };

  let channelId;
  try {
    channelId = await notifee.createChannel({
      id: 'location-tips',
      name: 'Location Tips',
      importance: AndroidImportance.HIGH,
    });
  } catch (_) {
    channelId = 'location-tips';
  }

  DLogger.log('NOTIFEE_FG_DISPLAY_ATTEMPT', {title, channelId}, true);
  try {
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
    DLogger.log('NOTIFEE_FG_DISPLAY_SUCCESS', {title}, true);
    DLogger.updateState({
      lastNotificationDisplayed: {timestamp: new Date().toISOString(), title},
    });
  } catch (displayErr) {
    DLogger.log('NOTIFEE_FG_DISPLAY_ERROR', {title, error: String(displayErr?.message)}, true);
    console.error('📩 notifee fg displayNotification failed:', displayErr);
  }
});

// Request permissions explicitly for iOS
if (Platform.OS === 'ios') {
  messaging()
    .requestPermission()
    .then(authStatus => {
      DLogger.log('IOS_FCM_PERMISSION', {authStatus});
      console.log('iOS notification permission status:', authStatus);
    });
}

// Create notification channels
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
      created => {
        DLogger.log('PN_CHANNEL_CREATED', {channelId: 'location-tips', created});
        console.log(`Main channel created: ${created}`);
      },
    );
  } else {
    DLogger.log('PN_CHANNEL_EXISTS', {channelId: 'location-tips'});
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

PushNotification.configure({
  onRegister: function (token) {
    DLogger.log('PN_REGISTER', {tokenType: token.os, tokenPrefix: token.token?.substring(0, 16)});
    console.log('PushNotification TOKEN:', token);
  },

  onNotification: function (notification) {
    // Navigation on tap is handled by messaging().onNotificationOpenedApp()
    // and messaging().getInitialNotification() to avoid double navigation.
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

  try {
    // Attempt to set user context from AsyncStorage for critical log relay
    try {
      const userInfoStr = await AsyncStorage.getItem('userInfo');
      if (userInfoStr) {
        const ui = JSON.parse(userInfoStr);
        if (ui.id && ui.access_token) {
          DLogger.setUser(String(ui.id), ui.access_token);
        }
      }
    } catch (_) {}

    // Non-blocking — don't await so we don't consume the 30s HeadlessJsTask budget
    DLogger.updateState({
      lastBgFetchExecution: {timestamp: new Date().toISOString(), taskId},
    });

    if (isTimeout) {
      DLogger.log('HEADLESS_TASK_TIMEOUT', {taskId}, true);
      console.log('[BackgroundFetch Headless] Task timed out:', taskId);
      return;
    }

    DLogger.log('HEADLESS_TASK_START', {taskId, platform: Platform.OS}, true);
    console.log('[BackgroundFetch Headless] Starting task:', taskId);

    const userInfoStr = await AsyncStorage.getItem('userInfo');
    if (!userInfoStr) {
      DLogger.log('HEADLESS_TASK_NO_USER', {taskId}, true);
      console.log('[BackgroundFetch Headless] No user info, skipping');
      return;
    }

    const userInfo = JSON.parse(userInfoStr);
    if (!userInfo.access_token) {
      DLogger.log('HEADLESS_TASK_NO_TOKEN', {taskId}, true);
      console.log('[BackgroundFetch Headless] No access token, skipping');
      return;
    }

    // GPS timeout reduced to 10s — HeadlessJsTaskConfig hardcodes a 30s total
    // execution window; 30s GPS + HTTP overhead reliably exceeded that budget,
    // causing the task to be killed before BackgroundFetch.finish() was called.
    let coords;
    try {
      coords = await new Promise((resolve, reject) => {
        Geolocation.getCurrentPosition(
          position => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            });
          },
          error => reject(error),
          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 60000,
          },
        );
      });
      DLogger.log('HEADLESS_TASK_LOCATION_ACQUIRED', {coords}, true);
      console.log('[BackgroundFetch Headless] Got location:', coords);
    } catch (locErr) {
      DLogger.log('HEADLESS_TASK_LOCATION_ERROR', {
        taskId,
        code: locErr?.code,
        message: locErr?.message,
      }, true);
      return;
    }

    let contentPreferences = [];
    try {
      const prefsStr = await AsyncStorage.getItem('contentPreferences');
      if (prefsStr) {contentPreferences = JSON.parse(prefsStr);}
    } catch (_) {}

    DLogger.log('HEADLESS_TASK_REQUEST_SENDING', {
      taskId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      contentPreferences,
    }, true);

    const response = await fetch(`${BASE_URL}/endpoint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userInfo.access_token}`,
      },
      body: JSON.stringify({
        latitude: coords.latitude,
        longitude: coords.longitude,
        contentPreferences,
      }),
    });

    const result = await response.json();
    DLogger.log('HEADLESS_TASK_RESPONSE', {
      taskId,
      httpStatus: response.status,
      status: result?.status,
      location: result?.location,
    }, true);
    // Non-blocking — state update must not delay BackgroundFetch.finish()
    DLogger.updateState({
      lastLocationPoll: {
        timestamp: new Date().toISOString(),
        result: result?.status ?? `HTTP ${response.status}`,
        coords: {latitude: coords.latitude, longitude: coords.longitude},
      },
    });
    console.log('[BackgroundFetch Headless] Server response:', result);
  } catch (error) {
    DLogger.log('HEADLESS_TASK_ERROR', {taskId, error: String(error?.message ?? error)}, true);
    console.error('[BackgroundFetch Headless] Error:', error);
  } finally {
    // Guaranteed to run — previously missing try/finally meant any unhandled
    // throw above would exit without calling finish(), producing unknown:-1 completions.
    DLogger.log('HEADLESS_TASK_FINISH', {taskId});
    BackgroundFetch.finish(taskId);
  }
};

// Register the headless task for Android
DLogger.log('BG_FETCH_HEADLESS_REGISTER', {platform: Platform.OS});
BackgroundFetch.registerHeadlessTask(headlessTask);

// Required by notifee to display foreground service notifications on Android.
notifee.registerForegroundService(() => new Promise(() => {}));

AppRegistry.registerComponent(appName, () => App);
