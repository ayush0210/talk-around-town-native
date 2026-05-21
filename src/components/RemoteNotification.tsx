import {useEffect, useContext, useRef, useCallback, useState} from 'react';
import Geolocation from '@react-native-community/geolocation';
import messaging from '@react-native-firebase/messaging';
import notifee, {EventType} from '@notifee/react-native';
import {AuthContext, AuthContextType} from '../context/AuthContext';
import {Alert, AppState, Linking, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {BASE_URL} from '../config';
import BackgroundFetch from 'react-native-background-fetch';

const RemoteNotification: React.FC = () => {
  const {userInfo} = useContext<AuthContextType>(AuthContext);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const lastLocationRef = useRef<{latitude: number; longitude: number} | null>(
    null,
  );
  const [isMoving, setIsMoving] = useState(false);
  const lastPressTime = useRef<number>(0);
  const isAuthenticatedRef = useRef(false);
  const setupCompleted = useRef(false);
  const appStateSubRef = useRef<ReturnType<typeof AppState.addEventListener> | null>(null);
  const isCheckingRef = useRef(false);

  const verifyAuth = async (token: string) => {
    try {
      console.log('[RemoteNotification] Verifying auth token...');
      const response = await fetch(`${BASE_URL}/api/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      console.log('[RemoteNotification] Auth verification response:', response.ok);
      isAuthenticatedRef.current = response.ok;
      return response.ok;
    } catch (error) {
      console.error('[RemoteNotification] Auth verification error:', error);
      isAuthenticatedRef.current = false;
      return false;
    }
  };

  const setupFCM = async () => {
    try {
      console.log('[RemoteNotification] Setting up FCM...');
      const token = await messaging().getToken();
      console.log('[RemoteNotification] FCM token obtained:', token?.substring(0, 20) + '...');
      if (userInfo?.access_token && token) {
        console.log('[RemoteNotification] Sending FCM token to server...');
        const response = await fetch(`${BASE_URL}/api/auth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userInfo.access_token}`,
          },
          body: JSON.stringify({token, platform: Platform.OS}),
        });
        const responseData = await response.json();
        console.log('[RemoteNotification] Server response:', response.ok, responseData);
        if (!response.ok) {throw new Error('Failed to update token on server');}
      } else {
        console.log('[RemoteNotification] Missing access_token or FCM token, skipping server update');
      }
      return token;
    } catch (error) {
      console.error('[RemoteNotification] Error setting up FCM:', error);
      return null;
    }
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000;
  };

  const locationCheck = useCallback(async () => {
    if (isCheckingRef.current) {
      console.log('[RemoteNotification] Location check already in progress, skipping');
      return;
    }
    console.log('[RemoteNotification] Location check - authenticated:', isAuthenticatedRef.current, 'hasToken:', !!userInfo?.access_token);
    if (!userInfo?.access_token || !isAuthenticatedRef.current) {
      console.log('[RemoteNotification] Skipping location check - not authenticated');
      return;
    }
    isCheckingRef.current = true;

    try {
      const position = await new Promise<any>((resolve, reject) => {
        Geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 60000,
          maximumAge: 10000,
        });
      });

      const {latitude, longitude} = position.coords;

      if (lastLocationRef.current) {
        const distance = calculateDistance(
          lastLocationRef.current.latitude,
          lastLocationRef.current.longitude,
          latitude,
          longitude,
        );
        setIsMoving(distance > 10);
      }

      lastLocationRef.current = {latitude, longitude};

      console.log('[RemoteNotification] Sending location to server:', {latitude, longitude});
      const response = await fetch(`${BASE_URL}/endpoint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.access_token}`,
        },
        body: JSON.stringify({latitude, longitude}),
      });

      if (!response.ok)
        {throw new Error(`HTTP error! status: ${response.status}`);}

      const result = await response.json();
      console.log('[RemoteNotification] Location response:', result);

      if (result.status === 'success' && result.location) {
        console.log(`[RemoteNotification] Geofence detected: ${result.location} (${result.type})`);
      }
    } catch (error) {
      console.error('[RemoteNotification] Location check error:', error);
      if (error instanceof Error && error.message.includes('401')) {
        isAuthenticatedRef.current = false;
      }
    } finally {
      isCheckingRef.current = false;
    }
  }, [userInfo?.access_token]);

  useEffect(() => {
    const setup = async () => {
      console.log('[RemoteNotification] Setup check - access_token:', !!userInfo?.access_token, 'setupCompleted:', setupCompleted.current);
      if (!userInfo?.access_token || setupCompleted.current) {
        console.log('[RemoteNotification] Skipping setup - no token or already completed');
        return;
      }

      // Mark as completed immediately to prevent race condition
      setupCompleted.current = true;

      try {
        const isValid = await verifyAuth(userInfo.access_token);
        if (!isValid) {
          console.log('[RemoteNotification] Auth verification failed, skipping setup');
          setupCompleted.current = false;
          return;
        }

        const authStatus = await messaging().requestPermission();
        if (authStatus !== messaging.AuthorizationStatus.AUTHORIZED) {
          console.log('[RemoteNotification] FCM permission not granted');
          setupCompleted.current = false;
          return;
        }

        await setupFCM();

        // On Android, prompt once to disable battery optimization so background
        // location checks (BackgroundFetch) are not deferred by the OS.
        if (Platform.OS === 'android') {
          const prompted = await AsyncStorage.getItem('batteryOptimizationPrompted');
          if (!prompted) {
            await AsyncStorage.setItem('batteryOptimizationPrompted', 'true');
            Alert.alert(
              'Enable Background Notifications',
              'To receive tips while ENACT is in the background, please set battery usage to "Unrestricted":\n\nSettings → Apps → ENACT → Battery → Unrestricted',
              [
                {text: 'Later', style: 'cancel'},
                {
                  text: 'Open Settings',
                  onPress: () => Linking.openSettings(),
                },
              ],
            );
          }
        }

        notifee.onForegroundEvent(({type, detail}) => {
          if (type === EventType.PRESS) {
            const now = Date.now();
            if (now - lastPressTime.current < 1000) {return;}
            lastPressTime.current = now;
            console.log('Notification pressed:', detail.notification);
          }
        });

        messaging().onNotificationOpenedApp(async remoteMessage => {
          console.log('Background notification pressed:', remoteMessage);
        });

        const initialNotification = await messaging().getInitialNotification();
        if (initialNotification) {
          console.log('Quit state notification pressed:', initialNotification);
        }

        // Start location checking with interval (foreground only)
        console.log('[RemoteNotification] Starting location check interval...');
        await locationCheck();
        locationIntervalRef.current = setInterval(
          locationCheck,
          isMoving ? 30000 : 60000,
        );

        // Fire an immediate location check when the app returns to the foreground
        // so the server receives a ping without waiting for the next interval tick
        const appStateSubscription = AppState.addEventListener(
          'change',
          nextState => {
            if (nextState === 'active') {
              console.log('[RemoteNotification] App foregrounded – running location check');
              locationCheck();
            }
          },
        );
        appStateSubRef.current = appStateSubscription;

        // Configure BackgroundFetch for background location checks
        console.log('[RemoteNotification] Configuring BackgroundFetch...');
        await BackgroundFetch.configure(
          {
            minimumFetchInterval: 15, // 15 minutes minimum (iOS limitation)
            stopOnTerminate: false,   // Keep running after app is closed
            startOnBoot: true,        // Start on device boot
            enableHeadless: true,     // Enable headless mode for Android
          },
          async (taskId: string) => {
            console.log('[BackgroundFetch] Fetch event:', taskId);
            // Skip if a foreground location check is already in progress
            if (isCheckingRef.current) {
              console.log('[BackgroundFetch] Foreground check in progress, skipping');
              BackgroundFetch.finish(taskId);
              return;
            }
            // Perform location check in background
            try {
              const position = await new Promise<any>((resolve, reject) => {
                Geolocation.getCurrentPosition(resolve, reject, {
                  enableHighAccuracy: false,
                  timeout: 30000,
                  maximumAge: 60000,
                });
              });

              const {latitude, longitude} = position.coords;
              console.log('[BackgroundFetch] Got location:', {latitude, longitude});

              const response = await fetch(`${BASE_URL}/endpoint`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${userInfo.access_token}`,
                },
                body: JSON.stringify({latitude, longitude}),
              });

              if (response.ok) {
                const result = await response.json();
                console.log('[BackgroundFetch] Server response:', result);
              }
            } catch (error) {
              console.error('[BackgroundFetch] Error:', error);
            }
            BackgroundFetch.finish(taskId);
          },
          async (taskId: string) => {
            console.log('[BackgroundFetch] Timeout:', taskId);
            BackgroundFetch.finish(taskId);
          },
        );

        await BackgroundFetch.start();
        console.log('[RemoteNotification] BackgroundFetch started');
      } catch (error) {
        console.error('[RemoteNotification] Setup error:', error);
        setupCompleted.current = false; // Reset on error to allow retry
      }
    };

    if (userInfo?.access_token) {setup();}

    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
      if (appStateSubRef.current) {
        appStateSubRef.current.remove();
        appStateSubRef.current = null;
      }
      // Note: BackgroundFetch continues running intentionally for background location
    };
  // isMoving intentionally omitted: including it would cause the interval to be
  // cleared and never recreated (setupCompleted blocks re-setup). The interval
  // runs at a fixed 60s cadence; adaptive timing is a future improvement.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInfo?.access_token, locationCheck]);

  return null;
};

export default RemoteNotification;
