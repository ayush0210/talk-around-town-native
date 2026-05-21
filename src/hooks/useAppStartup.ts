import { useState, useEffect, useCallback, useContext } from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../context/AuthContext';
import { useLocationTracking } from './useLocationTracking';

/**
 * Custom hook to manage app startup sequence and handle connectivity issues
 */
export const useAppStartup = () => {
  const { userInfo, isLoading: authLoading } = useContext(AuthContext);
  const { location, isLoading: locationLoading, retryLocation } = useLocationTracking();

  const [isNetworkAvailable, setIsNetworkAvailable] = useState(true);
  const [startupComplete, setStartupComplete] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [retryAttempts, setRetryAttempts] = useState(0);

  // Function to check network connectivity
  const checkNetwork = useCallback(async () => {
    try {
      const state = await NetInfo.fetch();
      setIsNetworkAvailable(state.isConnected || false);
      return state.isConnected;
    } catch (error) {
      console.error('Failed to check network status:', error);
      return false;
    }
  }, []);

  // Function to handle startup retry with exponential backoff
  const retryStartup = useCallback(async () => {
    if (retryAttempts > 3) {
      setStartupError('Multiple connection attempts failed. Please check your internet connection and try again.');
      return;
    }

    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.pow(2, retryAttempts) * 1000;

    // Clear any previous error
    setStartupError(null);

    // Wait for the backoff period
    await new Promise(resolve => setTimeout(resolve, delay));

    // Check network first
    const networkAvailable = await checkNetwork();
    if (!networkAvailable) {
      setStartupError('No internet connection available.');
      setRetryAttempts(prev => prev + 1);
      return;
    }

    // Try location services again
    retryLocation();

    // Increment retry counter
    setRetryAttempts(prev => prev + 1);
  }, [retryAttempts, checkNetwork, retryLocation]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && !startupComplete) {
        // App came to foreground but startup isn't complete
        retryStartup();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [startupComplete, retryStartup]);

  // Monitor startup completion
  useEffect(() => {
    const determineStartupStatus = async () => {
      // If auth is still loading, wait for it
      if (authLoading) {return;}

      // Check if we're logged in (have a token)
      const isLoggedIn = Boolean(userInfo?.access_token);

      if (!isLoggedIn) {
        // If not logged in, we can consider startup complete
        // (login screen doesn't need location or other data)
        setStartupComplete(true);
        return;
      }

      // For logged in users, ensure we have network connectivity
      const networkAvailable = await checkNetwork();
      if (!networkAvailable) {
        setStartupError('No internet connection. Please check your network settings.');
        return;
      }

      // For logged in users, check if location is available
      if (locationLoading) {return;}

      if (!location && retryAttempts < 3) {
        // If location isn't available yet and we haven't exhausted retries
        // trigger a retry
        retryStartup();
        return;
      }

      // If we have auth and either have location or have tried enough times,
      // consider startup complete
      setStartupComplete(true);
    };

    determineStartupStatus();
  }, [userInfo, authLoading, locationLoading, location, retryAttempts, checkNetwork, retryStartup]);

  // Persist last known good state to recover from crashes
  useEffect(() => {
    const persistAppState = async () => {
      if (location && userInfo?.access_token) {
        try {
          // Save last known good state
          await AsyncStorage.setItem('lastKnownLocation', JSON.stringify(location));
          await AsyncStorage.setItem('lastStartupSuccess', Date.now().toString());
        } catch (error) {
          console.error('Failed to persist app state:', error);
        }
      }
    };

    if (startupComplete && !startupError) {
      persistAppState();
    }
  }, [startupComplete, startupError, location, userInfo]);

  return {
    startupComplete,
    startupError,
    retryStartup,
    isNetworkAvailable,
  };
};
