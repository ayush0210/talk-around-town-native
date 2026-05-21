import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import React, {createContext, useEffect, useState} from 'react';
import {BASE_URL} from '../config';
import {Alert} from 'react-native';

export interface UserInfo {
  access_token?: string;
  refresh_token?: string;
  number_of_children?: number;
  children?: number[];
  isAdmin?: boolean;
  user?: {
    id?: number;
    name?: string;
    email?: string;
    recording?: boolean | number;
    [key: string]: any;
  };
}

export interface AuthContextType {
  isLoading: boolean;
  userInfo: UserInfo;
  splashLoading: boolean;
  aiTips: boolean;
  isAdmin: boolean;
  register: (
    name: string,
    email: string,
    password: string,
    childrenData?: {
      numberOfChildren: number;
      caregiverType: string;
      childrenDetails: Array<{
        nickname: string;
        age: number;
        date_of_birth: string;
      }>;
    },
  ) => Promise<boolean>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<boolean>;
  setAITips: React.Dispatch<React.SetStateAction<boolean>>;
  // Returns a guaranteed-fresh access token, refreshing silently if needed.
  getValidToken: () => Promise<string>;
}

export const AuthContext = createContext<AuthContextType>(
  {} as AuthContextType,
);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [userInfo, setUserInfo] = useState<UserInfo>({});
  const [isLoading, setIsLoading] = useState(false);
  const [splashLoading, setSplashLoading] = useState(false);
  const [aiTips, setAITips] = useState<boolean>(false);
  const isAdmin = Boolean(userInfo?.isAdmin);

  // Create axios instance with interceptors
  const axiosInstance = axios.create({
    baseURL: `${BASE_URL}/api/auth`, // Add the /api/auth prefix
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add request interceptor to add token to headers
  axiosInstance.interceptors.request.use(
    async config => {
      const userInfoString = await AsyncStorage.getItem('userInfo');
      if (userInfoString) {
        const userInfo = JSON.parse(userInfoString);
        if (userInfo.access_token) {
          config.headers.Authorization = `Bearer ${userInfo.access_token}`;
        }
      }
      return config;
    },
    error => {
      return Promise.reject(error);
    },
  );

  // Add response interceptor to handle token refresh
  axiosInstance.interceptors.response.use(
    response => response,
    async error => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const userInfoString = await AsyncStorage.getItem('userInfo');
          if (!userInfoString) {
            throw new Error('No user info found');
          }

          const currentUserInfo = JSON.parse(userInfoString);
          if (!currentUserInfo.refresh_token) {
            throw new Error('No refresh token found');
          }

          // Use the correct refresh endpoint
          const response = await axios.post(`${BASE_URL}/api/auth/refresh`, {
            refresh_token: currentUserInfo.refresh_token,
          });

          const {access_token} = response.data;

          const updatedUserInfo = {
            ...currentUserInfo,
            access_token,
          };

          await AsyncStorage.setItem(
            'userInfo',
            JSON.stringify(updatedUserInfo),
          );
          setUserInfo(updatedUserInfo);

          // Update the Authorization header
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return axiosInstance(originalRequest);
        } catch (refreshError) {
          // Clear user data and force re-login
          await AsyncStorage.removeItem('userInfo');
          setUserInfo({});
          return Promise.reject(refreshError);
        }
      }
      return Promise.reject(error);
    },
  );

  const register = async (
    name: string,
    email: string,
    password: string,
    childrenData?: {
      numberOfChildren: number;
      caregiverType: string;
      childrenDetails: Array<{
        nickname: string;
        age: number;
        date_of_birth: string;
      }>;
    },
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      const registrationData = {
        name,
        email,
        password,
        children: childrenData,
      };

      const res = await axiosInstance.post('/register', registrationData);

      Alert.alert('Success', 'You can now login');
      setIsLoading(false);
      return true;
    } catch (e: any) {
      console.error('Registration error:', e.response?.data || e);
      Alert.alert(
        'Registration Failed',
        e.response?.data?.error ||
          'Please check your credentials and try again.',
      );
      setIsLoading(false);
      return false;
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.post('/login', {
        email,
        password,
      });

      const userInfo = res.data;
      setUserInfo(userInfo);
      await AsyncStorage.setItem('userInfo', JSON.stringify(userInfo));
    } catch (e: any) {
      console.error('Login error:', e.response?.data || e);
      Alert.alert(
        'Login Failed',
        e.response?.data?.error ||
          'Please check your credentials and try again.',
      );
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      if (userInfo.access_token) {
        await axiosInstance.post('/logout');
      }
      await AsyncStorage.removeItem('userInfo');
      setUserInfo({});
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Add the deleteAccount function
  const deleteAccount = async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      if (!userInfo.access_token) {
        throw new Error('Not authenticated');
      }

      await axiosInstance.delete('/delete-account');

      // Clear user data
      await AsyncStorage.removeItem('userInfo');
      setUserInfo({});

      return true;
    } catch (e: any) {
      console.error('Delete account error:', e.response?.data || e);
      Alert.alert(
        'Error',
        e.response?.data?.error ||
          'Failed to delete account. Please try again.',
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Decode the expiry from a JWT without a library (JWT payload is base64url JSON).
  const getTokenExpiry = (token: string): number => {
    try {
      const part = token.split('.')[1];
      // base64url → base64
      const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(
        atob(b64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
      return JSON.parse(json).exp ?? 0;
    } catch {
      return 0;
    }
  };

  // Returns a valid access token, refreshing silently when it expires within 60 s.
  const getValidToken = async (): Promise<string> => {
    const stored = await AsyncStorage.getItem('userInfo');
    if (!stored) {throw new Error('Not authenticated');}

    const info = JSON.parse(stored) as UserInfo;
    const token = info.access_token;
    if (!token) {throw new Error('No access token');}

    const exp = getTokenExpiry(token);
    const nowSec = Math.floor(Date.now() / 1000);

    if (exp - nowSec > 60) {
      // Token still valid for more than 60 s — use as-is.
      return token;
    }

    // Token expired or expiring soon — try to refresh.
    if (!info.refresh_token) {throw new Error('No refresh token');}

    const res = await axios.post(`${BASE_URL}/api/auth/refresh`, {
      refresh_token: info.refresh_token,
    });

    const {access_token} = res.data;
    const updated = {...info, access_token};
    await AsyncStorage.setItem('userInfo', JSON.stringify(updated));
    setUserInfo(updated);
    return access_token;
  };

  const isLoggedIn = async () => {
    try {
      setSplashLoading(true);
      let userInfoString = await AsyncStorage.getItem('userInfo');

      if (!userInfoString) {
        setUserInfo({});
        return;
      }

      const storedUserInfo = JSON.parse(userInfoString);
      if (!storedUserInfo.access_token) {
        setUserInfo({});
        return;
      }

      try {
        await axiosInstance.post('/verify');
        setUserInfo(storedUserInfo);
      } catch (error) {
        // Token verification failed, but we'll let the interceptor handle the refresh
        console.error('Session verification error:', error);
      }
    } finally {
      setSplashLoading(false);
    }
  };

  useEffect(() => {
    isLoggedIn();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        userInfo,
        splashLoading,
        register,
        login,
        logout,
        deleteAccount,
        aiTips,
        setAITips,
        isAdmin,
        getValidToken,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
