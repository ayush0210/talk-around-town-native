// Enhanced useChildrenInfo hook with better error handling and debugging

import {useState, useEffect, useCallback, useRef} from 'react';
import {Alert} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {BASE_URL} from '../config';

interface Child {
  id: number;
  nickname: string;
  date_of_birth: string;
}

interface UseChildrenInfoReturn {
  children: Child[];
  isLoading: boolean;
  error: string | null;
  isFromCache: boolean;
  fetchChildren: (forceRefresh?: boolean) => Promise<void>;
  updateChildren: (children: Child[]) => void;
  clearError: () => void;
  retryFetch: () => Promise<void>;
  loadFromCache: () => Promise<Child[] | null>;
  needsProfileCompletion: boolean;
}

const CHILDREN_CACHE_KEY = 'childrenInfoCache';
const CACHE_EXPIRY_KEY = 'childrenCacheExpiry';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const API_BASE_URL = BASE_URL;

export const useChildrenInfo = (): UseChildrenInfoReturn => {
  const [children, setChildren] = useState<Child[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);

  // Use ref to prevent multiple simultaneous API calls
  const fetchingRef = useRef(false);
  const lastFetchTime = useRef(0);
  const retryCount = useRef(0);
  const maxRetries = 3;

  // Debug logging function
  const debugLog = (message: string, data?: any) => {
    console.log(`[ChildrenInfo] ${message}`, data || '');
  };

  // Check if cache is valid
  const isCacheValid = useCallback(async (): Promise<boolean> => {
    try {
      const expiryTime = await AsyncStorage.getItem(CACHE_EXPIRY_KEY);
      if (!expiryTime) {return false;}

      const isValid = Date.now() < parseInt(expiryTime);
      debugLog(`Cache validity check: ${isValid ? 'VALID' : 'EXPIRED'}`);
      return isValid;
    } catch (error) {
      debugLog('Error checking cache validity:', error);
      return false;
    }
  }, []);

  // Load from cache
  const loadFromCache = useCallback(async (): Promise<Child[] | null> => {
    try {
      debugLog('Loading from cache...');
      const cachedData = await AsyncStorage.getItem(CHILDREN_CACHE_KEY);

      if (cachedData) {
        const parsedData: Child[] = JSON.parse(cachedData);
        debugLog('Cached data loaded:', parsedData);
        setChildren(parsedData); // <-- update state here
        setIsFromCache(true);
        setNeedsProfileCompletion(parsedData.length === 0);
        return parsedData;
      }

      debugLog('No cached data found');
      return null;
    } catch (error) {
      debugLog('Error loading from cache:', error);
      return null;
    }
  }, []);

  // Save to cache
  const saveToCache = useCallback(async (data: Child[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(CHILDREN_CACHE_KEY, JSON.stringify(data));
      await AsyncStorage.setItem(
        CACHE_EXPIRY_KEY,
        (Date.now() + CACHE_DURATION).toString(),
      );
      debugLog('Data saved to cache:', data);
    } catch (error) {
      debugLog('Error saving to cache:', error);
    }
  }, []);

  // Check network connectivity
  const checkNetworkConnectivity = useCallback(async (): Promise<boolean> => {
    try {
      const netInfo = await NetInfo.fetch();
      const isConnected = netInfo.isConnected && netInfo.isInternetReachable;
      debugLog(`Network status: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
      return isConnected ?? false;
    } catch (error) {
      debugLog('Error checking network:', error);
      return false;
    }
  }, []);

  // Fetch from API with enhanced error handling
  const fetchFromAPI = useCallback(
    async (userToken: string): Promise<Child[]> => {
      debugLog(
        `Fetching from API (attempt ${retryCount.current + 1}/${maxRetries})`,
      );

      const response = await fetch(`${API_BASE_URL}/endpoint/children`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        debugLog(
          `API Error - Status: ${response.status}, Message: ${errorText}`,
        );
        throw new Error(
          `HTTP ${response.status}: ${
            errorText || 'Failed to fetch children info'
          }`,
        );
      }

      const data = await response.json();
      debugLog('API response received:', data.children);

      if (!Array.isArray(data.children)) {
        throw new Error('Invalid response format from server');
      }

      return data.children;
    },
    [],
  );

  // Main fetch function with improved logic
  const fetchChildren = useCallback(
    async (forceRefresh: boolean = false): Promise<void> => {
      // Prevent multiple simultaneous calls
      if (fetchingRef.current && !forceRefresh) {
        debugLog('Fetch already in progress, skipping...');
        return;
      }

      // Rate limiting - don't fetch more than once per 10 seconds unless forced
      const timeSinceLastFetch = Date.now() - lastFetchTime.current;
      if (timeSinceLastFetch < 10000 && !forceRefresh) {
        debugLog('Rate limited - last fetch was too recent');
        return;
      }

      try {
        fetchingRef.current = true;
        setIsLoading(true);
        setError(null);
        setIsFromCache(false);

        debugLog(`Starting fetch - forceRefresh: ${forceRefresh}`);

        // Get user token
        const userInfoStr = await AsyncStorage.getItem('userInfo');
        if (!userInfoStr) {
          throw new Error('User not authenticated');
        }

        const userInfo = JSON.parse(userInfoStr);
        const userToken = userInfo.access_token;

        if (!userToken) {
          throw new Error('No access token available');
        }
        // Check if we should use cache
        if (!forceRefresh) {
          console.log('inside if forceRefresh', forceRefresh);
          const cacheValid = await isCacheValid();
          if (cacheValid) {
            const cachedChildren = await loadFromCache();
            if (cachedChildren) {
              setChildren(cachedChildren);
              setNeedsProfileCompletion(cachedChildren.length === 0);
              debugLog('Using valid cached data');
              return;
            }
          }
        }

        // Check network connectivity
        const isOnline = await checkNetworkConnectivity();
        if (!isOnline) {
          debugLog('No network connection, trying cache...');
          const cachedChildren = await loadFromCache();
          if (cachedChildren) {
            setChildren(cachedChildren);
            setIsFromCache(true);
            setNeedsProfileCompletion(cachedChildren.length === 0);
            return;
          } else {
            throw new Error(
              'No network connection and no cached data available',
            );
          }
        }

        // Fetch from API with retry logic
        let apiData: Child[] | null = null;
        retryCount.current = 0;

        while (retryCount.current < maxRetries && !apiData) {
          try {
            apiData = await fetchFromAPI(userToken);
            debugLog('apiData', apiData);
            break;
          } catch (apiError) {
            retryCount.current++;
            debugLog(
              `API fetch failed (attempt ${retryCount.current}):`,
              apiError,
            );

            if (retryCount.current < maxRetries) {
              // Exponential backoff
              const delay = Math.pow(2, retryCount.current) * 1000;
              debugLog(`Retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              throw apiError;
            }
          }
        }

        if (apiData) {
          setChildren(apiData);
          setNeedsProfileCompletion(apiData.length === 0);
          await saveToCache(apiData);
          debugLog(`Successfully fetched ${apiData.length} children`);
          lastFetchTime.current = Date.now();
        }
      } catch (fetchError) {
        debugLog('Fetch error:', fetchError);

        // Try to fall back to cache on error
        const cachedChildren = await loadFromCache();
        if (cachedChildren) {
          setChildren(cachedChildren);
          setIsFromCache(true);
          setNeedsProfileCompletion(cachedChildren.length === 0);
          setError(
            `Using cached data: ${
              fetchError instanceof Error ? fetchError.message : 'Unknown error'
            }`,
          );
          debugLog('Fell back to cached data due to error');
        } else {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : 'Failed to load children information',
          );
          debugLog('No cached data available, showing error');
        }
      } finally {
        setIsLoading(false);
        fetchingRef.current = false;
        retryCount.current = 0;
      }
    },
    [
      isCacheValid,
      loadFromCache,
      saveToCache,
      checkNetworkConnectivity,
      fetchFromAPI,
    ],
  );

  // Update children in state and cache
  const updateChildren = useCallback(
    async (newChildren: Child[]): Promise<void> => {
      debugLog('Updating children:', newChildren);
      setChildren(newChildren);
      setNeedsProfileCompletion(newChildren.length === 0);
      await saveToCache(newChildren);
    },
    [saveToCache],
  );

  // Clear error state
  const clearError = useCallback((): void => {
    debugLog('Clearing error state');
    setError(null);
  }, []);

  // Retry fetch with force refresh
  const retryFetch = useCallback(async (): Promise<void> => {
    debugLog('Retrying fetch...');
    await fetchChildren(true);
  }, [fetchChildren]);

  // Load initial data on mount
  useEffect(() => {
    debugLog('Hook mounted, loading initial data...');
    fetchChildren(false);
  }, [fetchChildren]);

  return {
    children,
    isLoading,
    error,
    isFromCache,
    fetchChildren,
    updateChildren,
    clearError,
    retryFetch,
    loadFromCache,
    needsProfileCompletion,
  };
};
