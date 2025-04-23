import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import React, { createContext, useEffect, useState } from 'react';
import { BASE_URL } from '../config';
import { Alert } from 'react-native';

export interface UserInfo {
  access_token?: string;
  refresh_token?: string;
  number_of_children?: number;
  children?: number[];
  isAdmin?: boolean;
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
    location: { latitude: number; longitude: number },
    childrenData?: {
      numberOfChildren: number;
      childrenDetails: Array<{
        nickname: string;
        date_of_birth: string;
      }>;
    }
  ) => Promise<boolean>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<boolean>; // Added deleteAccount function
  setAITips: React.Dispatch<React.SetStateAction<boolean>>;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userInfo, setUserInfo] = useState<UserInfo>({});
  const [isLoading, setIsLoading] = useState(false);
  const [splashLoading, setSplashLoading] = useState(false);
  const [aiTips, setAITips] = useState<boolean>(false);
  const isAdmin = Boolean(userInfo?.isAdmin);

  // Create axios instance with interceptors
  const axiosInstance = axios.create({
    baseURL: `${BASE_URL}/api/auth`, // Add the /api/auth prefix
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Add request interceptor to add token to headers
  axiosInstance.interceptors.request.use(
    async (config) => {
      const userInfoString = await AsyncStorage.getItem('userInfo');
      if (userInfoString) {
        const userInfo = JSON.parse(userInfoString);
        if (userInfo.access_token) {
          config.headers.Authorization = `Bearer ${userInfo.access_token}`;
        }
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Add response interceptor to handle token refresh
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
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
            refresh_token: currentUserInfo.refresh_token
          });
  
          const { access_token } = response.data;
  
          const updatedUserInfo = {
            ...currentUserInfo,
            access_token
          };
  
          await AsyncStorage.setItem('userInfo', JSON.stringify(updatedUserInfo));
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
    }
  );
  

  const register = async (
    name: string, 
    email: string, 
    password: string, 
    location: { latitude: number; longitude: number },
    childrenData?: {
      numberOfChildren: number;
      childrenDetails: Array<{
        nickname: string;
        date_of_birth: string;
      }>;
    }
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      const registrationData = {
        name,
        email,
        password,
        location,
        children: childrenData
      };
      
      const res = await axiosInstance.post('/register', registrationData);
      
      Alert.alert('Success', 'You can now login');
      setIsLoading(false);
      return true;
    } catch (e: any) {
      console.error('Registration error:', e.response?.data || e);
      Alert.alert(
        'Registration Failed', 
        e.response?.data?.error || 'Please check your credentials and try again.'
      );
      setIsLoading(false);
      return false;
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.post('/login', { email, password });
      
      // Store isAdmin in userInfo
      const userInfo = {
        ...res.data,
        isAdmin: res.data.isAdmin // Ensure isAdmin is saved in userInfo
      };
      
      setUserInfo(userInfo);
      await AsyncStorage.setItem('userInfo', JSON.stringify(userInfo));
    } catch (e: any) {
      console.error('Login error:', e.response?.data || e);
      Alert.alert(
        'Login Failed', 
        e.response?.data?.error || 'Please check your credentials and try again.'
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
        e.response?.data?.error || 'Failed to delete account. Please try again.'
      );
      return false;
    } finally {
      setIsLoading(false);
    }
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
        deleteAccount, // Added deleteAccount function to the context
        aiTips,
        setAITips,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;