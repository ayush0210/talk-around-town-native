import React, {useEffect, useContext, useRef, useCallback, useState} from 'react';
import Geolocation from '@react-native-community/geolocation';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import {AuthContext, AuthContextType} from '../context/AuthContext';
import {Alert, AppState, Linking, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {BASE_URL} from '../config';
import BackgroundFetch from 'react-native-background-fetch';
import DLogger from '../diagnostics/DiagnosticsLogger';

const RemoteNotification: React.FC = () => {
  const {userInfo} = useContext<AuthContextType>(AuthContext);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const lastLocationRef = useRef<{latitude: number; longitude: number} | null>(
    null,
  );
  const [isMoving, setIsMoving] = useState(false);
  const isAuthenticatedRef = useRef(false);
  const setupCompleted = useRef(false);
  const appStateSubRef = useRef<ReturnType<typeof AppState.addEventListener> | null>(null);
  const isCheckingRef = useRef(false);

  // Keep DLogger's user context in sync with auth state
  useEffect(() => {
    if (userInfo?.access_token) {
      const userId = userInfo?.id ?? userInfo?.user?.id ?? null;
      DLogger.setUser(userId ? String(userId) : null, userInfo.access_token);
      DLogger.log('USER_CONTEXT_SET', {hasUserId: !!userId, hasToken: true});
    } else {
      DLogger.setUser(null, null);
    }
  }, [userInfo?.access_token, userInfo?.id, userInfo?.user?.id]);

  const verifyAuth = async (token: string) => {
    DLogger.log('AUTH_VERIFY_START', {tokenPrefix: token.substring(0, 16)});
    try {
      console.log('[RemoteNotification] Verifying auth token...');
      const response = await fetch(`${BASE_URL}/api/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const ok = response.ok;
      DLogger.log(ok ? 'AUTH_VERIFY_SUCCESS' : 'AUTH_VERIFY_FAIL', {httpStatus: response.status});
      console.log('[RemoteNotification] Auth verification response:', ok);
      isAuthenticatedRef.current = ok;
      return ok;
    } catch (error: any) {
      DLogger.log('AUTH_VERIFY_ERROR', {error: String(error?.message)});
      console.error('[RemoteNotification] Auth verification error:', error);
      isAuthenticatedRef.current = false;
      return false;
    }
  };

  const setupFCM = async () => {
    DLogger.log('FCM_SETUP_START', {platform: Platform.OS});
    try {
      console.log('[RemoteNotification] Setting up FCM...');
      const token = await messaging().getToken();
      DLogger.log('FCM_TOKEN_OBTAINED', {
        tokenPrefix: token?.substring(0, 20),
        tokenLength: token?.length,
        platform: Platform.OS,
      }, true);
      console.log('[RemoteNotification] FCM token obtained:', token?.substring(0, 20) + '...');
      await DLogger.updateState({fcmToken: token});

      if (userInfo?.access_token && token) {
        DLogger.log('FCM_TOKEN_SENDING_TO_SERVER', {platform: Platform.OS});
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
        DLogger.log(
          response.ok ? 'FCM_TOKEN_SERVER_SUCCESS' : 'FCM_TOKEN_SERVER_FAIL',
          {httpStatus: response.status, response: responseData},
          true,
        );
        console.log('[RemoteNotification] Server response:', response.ok, responseData);
        if (!response.ok) {throw new Error('Failed to update token on server');}
      } else {
        DLogger.log('FCM_TOKEN_SKIP_SERVER', {hasAccessToken: !!userInfo?.access_token, hasToken: !!token});
        console.log('[RemoteNotification] Missing access_token or FCM token, skipping server update');
      }
      return token;
    } catch (error: any) {
      DLogger.log('FCM_SETUP_ERROR', {error: String(error?.message)}, true);
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
      DLogger.log('LOCATION_CHECK_SKIP_IN_PROGRESS', {appState: AppState.currentState});
      console.log('[RemoteNotification] Location check already in progress, skipping');
      return;
    }
    if (!userInfo?.access_token || !isAuthenticatedRef.current) {
      DLogger.log('LOCATION_CHECK_SKIP_NOT_AUTH', {
        hasToken: !!userInfo?.access_token,
        isAuthenticated: isAuthenticatedRef.current,
      });
      console.log('[RemoteNotification] Skipping location check - not authenticated');
      return;
    }

    isCheckingRef.current = true;
    DLogger.log('LOCATION_CHECK_START', {
      appState: AppState.currentState,
      isMoving,
    }, true);
    console.log('[RemoteNotification] Location check - authenticated:', isAuthenticatedRef.current, 'hasToken:', !!userInfo?.access_token);

    try {
      const position = await new Promise<any>((resolve, reject) => {
        Geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 60000,
          maximumAge: 10000,
        });
      });

      const {latitude, longitude, accuracy} = position.coords;
      DLogger.log('LOCATION_ACQUIRED', {latitude, longitude, accuracy});

      if (lastLocationRef.current) {
        const distance = calculateDistance(
          lastLocationRef.current.latitude,
          lastLocationRef.current.longitude,
          latitude,
          longitude,
        );
        setIsMoving(distance > 10);
        DLogger.log('LOCATION_MOVED', {distanceMeters: Math.round(distance), isMoving: distance > 10});
      }

      lastLocationRef.current = {latitude, longitude};

      // Read content preferences so personalized tips are generated
      let contentPreferences: string[] = [];
      try {
        const prefsStr = await AsyncStorage.getItem('contentPreferences');
        if (prefsStr) {contentPreferences = JSON.parse(prefsStr);}
      } catch (_) {}

      DLogger.log('LOCATION_REQUEST_SENDING', {latitude, longitude, contentPreferences}, true);
      console.log('[RemoteNotification] Sending location to server:', {latitude, longitude});

      const response = await fetch(`${BASE_URL}/endpoint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.access_token}`,
        },
        body: JSON.stringify({latitude, longitude, contentPreferences}),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      DLogger.log('LOCATION_RESPONSE_RECEIVED', {
        httpStatus: response.status,
        status: result?.status,
        location: result?.location,
        type: result?.type,
      }, true);
      await DLogger.updateState({
        lastLocationPoll: {
          timestamp: new Date().toISOString(),
          result: result?.status ?? `HTTP ${response.status}`,
          coords: {latitude, longitude},
        },
      });
      console.log('[RemoteNotification] Location response:', result);

      if (result.status === 'success' && result.location) {
        DLogger.log('GEOFENCE_TRIGGERED', {location: result.location, type: result.type}, true);
        console.log(`[RemoteNotification] Geofence detected: ${result.location} (${result.type})`);
      }
    } catch (error: any) {
      DLogger.log('LOCATION_CHECK_ERROR', {
        error: String(error?.message ?? error),
        is401: error?.message?.includes('401'),
      }, true);
      console.error('[RemoteNotification] Location check error:', error);
      if (error instanceof Error && error.message.includes('401')) {
        isAuthenticatedRef.current = false;
      }
    } finally {
      isCheckingRef.current = false;
    }
  }, [userInfo?.access_token, isMoving]);

  useEffect(() => {
    const setup = async () => {
      DLogger.log('SETUP_CHECK', {
        hasToken: !!userInfo?.access_token,
        setupCompleted: setupCompleted.current,
      });
      console.log('[RemoteNotification] Setup check - access_token:', !!userInfo?.access_token, 'setupCompleted:', setupCompleted.current);
      if (!userInfo?.access_token || setupCompleted.current) {
        DLogger.log('SETUP_SKIP', {
          reason: !userInfo?.access_token ? 'no_token' : 'already_completed',
        });
        console.log('[RemoteNotification] Skipping setup - no token or already completed');
        return;
      }

      setupCompleted.current = true;

      try {
        DLogger.log('SETUP_START', {platform: Platform.OS}, true);

        const isValid = await verifyAuth(userInfo.access_token);
        if (!isValid) {
          DLogger.log('SETUP_ABORT_AUTH_FAIL', {});
          console.log('[RemoteNotification] Auth verification failed, skipping setup');
          setupCompleted.current = false;
          return;
        }

        DLogger.log('FCM_PERMISSION_REQUEST_START', {platform: Platform.OS});
        const authStatus = await messaging().requestPermission();
        DLogger.log('FCM_PERMISSION_RESULT', {authStatus, platform: Platform.OS}, true);
        if (authStatus !== messaging.AuthorizationStatus.AUTHORIZED) {
          DLogger.log('SETUP_ABORT_NO_FCM_PERMISSION', {authStatus}, true);
          console.log('[RemoteNotification] FCM permission not granted');
          setupCompleted.current = false;
          return;
        }

        await setupFCM();

        // On Android, prompt once to disable battery optimization
        if (Platform.OS === 'android') {
          const prompted = await AsyncStorage.getItem('batteryOptimizationPrompted');
          DLogger.log('BATTERY_OPT_PROMPT_CHECK', {alreadyPrompted: !!prompted});
          if (!prompted) {
            await AsyncStorage.setItem('batteryOptimizationPrompted', 'true');
            DLogger.log('BATTERY_OPT_PROMPT_SHOWN', {});
            Alert.alert(
              'Enable Background Notifications',
              'To receive tips while ENACT is in the background, please set battery usage to "Unrestricted":\n\nSettings → Apps → ENACT → Battery → Unrestricted',
              [
                {text: 'Later', style: 'cancel'},
                {
                  text: 'Open Settings',
                  onPress: () => {
                    DLogger.log('BATTERY_OPT_SETTINGS_OPENED', {});
                    Linking.openSettings();
                  },
                },
              ],
            );
          }
        }

        DLogger.log('LOCATION_INTERVAL_START', {intervalMs: isMoving ? 30000 : 60000});
        console.log('[RemoteNotification] Starting location check interval...');
        await locationCheck();
        locationIntervalRef.current = setInterval(
          locationCheck,
          isMoving ? 30000 : 60000,
        );

        const appStateSubscription = AppState.addEventListener(
          'change',
          nextState => {
            DLogger.log('APPSTATE_CHANGE', {nextState, prevState: AppState.currentState});
            console.log('[RemoteNotification] App state changed to:', nextState);
            if (nextState === 'active') {
              DLogger.log('APPSTATE_ACTIVE_LOCATION_TRIGGER', {});
              console.log('[RemoteNotification] App foregrounded – running location check');
              locationCheck();
            }
          },
        );
        appStateSubRef.current = appStateSubscription;

        DLogger.log('BG_FETCH_CONFIGURE_START', {
          minimumFetchInterval: 15,
          stopOnTerminate: false,
          startOnBoot: true,
          enableHeadless: true,
        });
        console.log('[RemoteNotification] Configuring BackgroundFetch...');
        const bfStatus = await BackgroundFetch.configure(
          {
            minimumFetchInterval: 15,
            stopOnTerminate: false,
            startOnBoot: true,
            enableHeadless: true,
          },
          async (taskId: string) => {
            DLogger.log('BG_FETCH_TASK_FIRED', {taskId}, true);
            await DLogger.updateState({
              lastBgFetchExecution: {timestamp: new Date().toISOString(), taskId},
            });
            console.log('[BackgroundFetch] Fetch event:', taskId);

            if (isCheckingRef.current) {
              DLogger.log('BG_FETCH_SKIP_FOREGROUND_ACTIVE', {taskId});
              console.log('[BackgroundFetch] Foreground check in progress, skipping');
              BackgroundFetch.finish(taskId);
              return;
            }

            try {
              const position = await new Promise<any>((resolve, reject) => {
                Geolocation.getCurrentPosition(resolve, reject, {
                  enableHighAccuracy: false,
                  timeout: 30000,
                  maximumAge: 60000,
                });
              });

              const {latitude, longitude} = position.coords;
              DLogger.log('BG_FETCH_LOCATION_ACQUIRED', {latitude, longitude});
              console.log('[BackgroundFetch] Got location:', {latitude, longitude});

              let contentPreferences: string[] = [];
              try {
                const prefsStr = await AsyncStorage.getItem('contentPreferences');
                if (prefsStr) {contentPreferences = JSON.parse(prefsStr);}
              } catch (_) {}

              DLogger.log('BG_FETCH_REQUEST_SENDING', {latitude, longitude, contentPreferences}, true);

              const response = await fetch(`${BASE_URL}/endpoint`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${userInfo.access_token}`,
                },
                body: JSON.stringify({latitude, longitude, contentPreferences}),
              });

              if (response.ok) {
                const result = await response.json();
                DLogger.log('BG_FETCH_RESPONSE', {
                  httpStatus: response.status,
                  status: result?.status,
                  location: result?.location,
                }, true);
                await DLogger.updateState({
                  lastLocationPoll: {
                    timestamp: new Date().toISOString(),
                    result: result?.status ?? `HTTP ${response.status}`,
                    coords: {latitude, longitude},
                  },
                });
                console.log('[BackgroundFetch] Server response:', result);
              } else {
                DLogger.log('BG_FETCH_HTTP_ERROR', {httpStatus: response.status}, true);
              }
            } catch (error: any) {
              DLogger.log('BG_FETCH_ERROR', {error: String(error?.message)}, true);
              console.error('[BackgroundFetch] Error:', error);
            }
            DLogger.log('BG_FETCH_TASK_FINISH', {taskId});
            BackgroundFetch.finish(taskId);
          },
          async (taskId: string) => {
            DLogger.log('BG_FETCH_TASK_TIMEOUT', {taskId}, true);
            console.log('[BackgroundFetch] Timeout:', taskId);
            BackgroundFetch.finish(taskId);
          },
        );

        DLogger.log('BG_FETCH_CONFIGURE_COMPLETE', {
          status: bfStatus,
          statusLabel: bfStatus === 2 ? 'AVAILABLE' : bfStatus === 1 ? 'RESTRICTED' : 'DENIED',
        }, true);
        await DLogger.updateState({bgFetchConfigureStatus: bfStatus});

        await BackgroundFetch.start();
        DLogger.log('BG_FETCH_STARTED', {status: bfStatus});
        console.log('[RemoteNotification] BackgroundFetch started');
      } catch (error: any) {
        DLogger.log('SETUP_ERROR', {error: String(error?.message)}, true);
        console.error('[RemoteNotification] Setup error:', error);
        setupCompleted.current = false;
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
    };
  // isMoving intentionally omitted: including it would cause the interval to be
  // cleared and never recreated (setupCompleted blocks re-setup).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInfo?.access_token, locationCheck]);

  return null;
};

export default RemoteNotification;
