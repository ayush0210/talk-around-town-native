import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, PermissionsAndroid, Alert, AppState } from 'react-native';
import Geolocation, { GeolocationResponse, GeolocationError } from '@react-native-community/geolocation';
import { Location } from '../types';

interface LocationError {
  code: number;
  message: string;
}

export const useLocationTracking = () => {
  const [location, setLocation] = useState<Location | null>(null);
  const [locationError, setLocationError] = useState<LocationError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const watchIdRef = useRef<number | null>(null);
  const lastLocationRef = useRef<Location | null>(null);

  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }, []);

  const clearLocationWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const handleLocationError = useCallback((error: GeolocationError) => {
    console.error('Location error:', error);
    setLocationError({ code: error.code, message: error.message });
    setIsLoading(false);

    if (AppState.currentState === 'active') {
      const errorMessages: Record<number, string> = {
        1: 'Please enable location permissions in settings',
        2: 'Location services are unavailable',
        3: 'Location request timed out. Please try again',
      };
      Alert.alert('Location Error', errorMessages[error.code] || 'Unknown location error');
    }
  }, []);

  const handleLocationSuccess = useCallback((position: GeolocationResponse) => {
    const { latitude, longitude } = position.coords;
    const newLocation: Location = {
      latitude,
      longitude,
      latitudeDelta: 0.015,
      longitudeDelta: 0.0121,
    };

    // Only update if location has changed significantly (> 10 meters)
    if (!lastLocationRef.current ||
        calculateDistance(
          lastLocationRef.current.latitude,
          lastLocationRef.current.longitude,
          latitude,
          longitude
        ) > 10) {
      setLocation(newLocation);
      lastLocationRef.current = newLocation;
      console.log('Location updated:', newLocation);
    }

    setLocationError(null);
    setIsLoading(false);
  }, [calculateDistance]);

  const requestLocationPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      return new Promise((resolve) => {
        Geolocation.requestAuthorization(
          () => resolve(true),
          () => resolve(false)
        );
      });
    }

    if (Platform.OS === 'android') {
      try {
        const fineLocationGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'ENACT needs location access to provide contextual parenting tips',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        if (fineLocationGranted === PermissionsAndroid.RESULTS.GRANTED) {
          // Request background location for Android 10+
          if (Platform.Version >= 29) {
            const backgroundGranted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
              {
                title: 'Background Location',
                message: 'Allow ENACT to access location in the background for location-based tips?',
                buttonNeutral: 'Ask Me Later',
                buttonNegative: 'Cancel',
                buttonPositive: 'OK',
              }
            );
            console.log('Background location:', backgroundGranted === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied');
          }
          return true;
        }
        return false;
      } catch (err) {
        console.warn('Permission error:', err);
        return false;
      }
    }
    return false;
  }, []);

  const startLocationTracking = useCallback(async () => {
    const hasPermission = await requestLocationPermissions();
    if (!hasPermission) {
      setLocationError({ code: 1, message: 'Permission denied' });
      setIsLoading(false);
      return;
    }

    // Use watchPosition for efficient location tracking
    watchIdRef.current = Geolocation.watchPosition(
      handleLocationSuccess,
      handleLocationError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000, // Use cached location if less than 30 seconds old
        distanceFilter: 10, // Only update if moved 10+ meters
      }
    );
  }, [handleLocationSuccess, handleLocationError, requestLocationPermissions]);

  const getCurrentLocation = useCallback((fromBackground = false) => {
    const timeout = fromBackground ? 30000 : 15000;

    setIsLoading(true);
    Geolocation.getCurrentPosition(
      handleLocationSuccess,
      handleLocationError,
      {
        enableHighAccuracy: !fromBackground, // Use less accuracy from background
        timeout,
        maximumAge: fromBackground ? 0 : 10000,
      }
    );
  }, [handleLocationSuccess, handleLocationError]);

  const retryLocation = useCallback(() => {
    setLocationError(null);
    setIsLoading(true);
    startLocationTracking();
  }, [startLocationTracking]);

  useEffect(() => {
    startLocationTracking();

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && !isLoading) {
        console.log('App active - refreshing location');
        getCurrentLocation(true);
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      clearLocationWatch();
      appStateSubscription.remove();
    };
  }, [startLocationTracking, getCurrentLocation, clearLocationWatch, isLoading]);

  return {
    location,
    locationError,
    isLoading,
    getCurrentLocation,
    retryLocation,
    clearLocationWatch,
  };
};
