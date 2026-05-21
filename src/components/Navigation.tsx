import React, {useContext} from 'react';
import {Platform, StatusBar, View} from 'react-native';
import {
  NavigationContainer,
  NavigationContainerRef,
  LinkingOptions,
} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {AuthContext, AuthContextType} from '../context/AuthContext';
import {navigationRef} from '../ref/NavigationRef';
import RemoteNotification from '../components/RemoteNotification';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import DashboardScreen from '../screens/Assistant/DashboardScreen';
// Screens
import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import MainScreen from '../screens/MainScreen';
// import AssistantScreen from '../screens/Assistant/MainScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import LocationListScreen from '../screens/LocationList';
import SettingsScreen from '../screens/SettingsScreen'; // Import SettingsScreen
import {Location} from 'react-native-get-location';
import AboutScreen from '../screens/AboutScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import ReminderSettingsScreen from '../screens/ReminderSettingsScreen';
import Tips from '../screens/TipsScreen';
import ContentSelectionScreen from '../ContentSelectionScreen';
import CustomTabBar from './CustomTabBar';
import {CopilotProvider, useCopilot} from 'react-native-copilot';

// Types
export type RootStackParamList = {
  Splash: undefined;
  About: undefined;
  Auth: undefined;
  Main: undefined;
  LocationList: {
    locations: Location[];
    details: Array<{
      id: number; // Added the id field to match LocationListScreen component
      title: string;
      description: string;
      pinColor: string;
    }>;
  };
  Settings: undefined;
  ChangePassword: undefined;
  Dashboard: undefined;
  ReminderSettings: undefined;
  ContentSelection: undefined;
  Tips: {
    notificationData?: {
      title: string;
      message: string;
      tipDetail?: string;
      tipCategory?: string;
      tipImage?: string;
    };
  };
};

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: {token: string};
};

type MainTabParamList = {
  Home: undefined;
  Assistant: undefined;
  Settings: undefined;
};

// Linking configuration
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['talkaroundtown://', 'https://talkaroundtown.com'],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
          ForgotPassword: 'forgot-password',
          Register: 'register',
          ResetPassword: 'reset-password/:token',
        },
      },
      Main: {
        screens: {
          Home: 'home',
          Assistant: 'assistant',
        },
      },
      LocationList: 'locations',
      Settings: 'settings',
      About: 'about',
      ChangePassword: 'change-password',
      Dashboard: 'dashboard',
      Tips: 'tips',
    },
  },
};

// Navigators
const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

const smoothStackOptions = {
  headerShown: false,
  animation: 'slide_from_right' as const,
  animationDuration: Platform.OS === 'android' ? 220 : undefined,
};

// Icon configuration
const getIconName = (routeName: string, focused: boolean): string => {
  switch (routeName) {
    case 'Home':
      return focused ? 'home' : 'home-outline';
    case 'Assistant':
      return focused ? 'chatbubbles' : 'chatbubbles-outline';
    case 'LocationList':
      return focused ? 'list' : 'list-outline';
    case 'Settings':
      return focused ? 'settings' : 'settings-outline'; // Add this for Settings
    default:
      return 'alert-circle';
  }
};

// Wrapper component
const ScreenWithNotification: React.FC<{children: React.ReactNode}> = ({
  children,
}) => (
  <View style={{flex: 1}}>
    {children}
    <RemoteNotification />
  </View>
);

// Tab Navigator
const TabNavigator = () => (
  <ScreenWithNotification>
    <MainTab.Navigator
      screenOptions={{headerShown: false}}
      // Completely hide the tab bar
      tabBar={() => null}>
      <MainTab.Screen name="Home" component={MainScreen} />
      <MainTab.Screen name="Settings" component={SettingsScreen} />
    </MainTab.Navigator>
  </ScreenWithNotification>
);

// Auth Navigator
const AuthNavigator = () => (
  <ScreenWithNotification>
    <AuthStack.Navigator screenOptions={smoothStackOptions}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
      />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  </ScreenWithNotification>
);

// Root Navigator - Split the rendering logic to avoid whitespace issues
const RootNavigator = () => {
  const {userInfo, splashLoading, isAdmin} =
    useContext<AuthContextType>(AuthContext);

  // Render different navigator configurations based on app state
  if (splashLoading) {
    return (
      <RootStack.Navigator screenOptions={smoothStackOptions}>
        <RootStack.Screen name="Splash" component={SplashScreen} />
      </RootStack.Navigator>
    );
  }

  if (userInfo.access_token) {
    return (
      <RootStack.Navigator screenOptions={smoothStackOptions}>
        <RootStack.Screen name="Main" component={TabNavigator} />
        <RootStack.Screen name="LocationList" component={LocationListScreen} />
        <RootStack.Screen name="Settings" component={SettingsScreen} />
        <RootStack.Screen name="About" component={AboutScreen} />
        <RootStack.Screen
          name="ChangePassword"
          component={ChangePasswordScreen}
        />
        <RootStack.Screen
          name="ContentSelection"
          component={ContentSelectionScreen}
        />
        <RootStack.Screen
          name="ReminderSettings"
          component={ReminderSettingsScreen}
          options={{headerShown: false}}
        />
        {/* Tips screen is now defined here as a stack screen, not a tab */}
        <RootStack.Screen
          name="Tips"
          component={Tips}
          options={{headerShown: false}}
        />
        {/* Only include Dashboard in routes if user is admin */}
        {isAdmin && (
          <RootStack.Screen name="Dashboard" component={DashboardScreen} />
        )}
      </RootStack.Navigator>
    );
  }

  return (
    <RootStack.Navigator screenOptions={smoothStackOptions}>
      <RootStack.Screen name="Auth" component={AuthNavigator} />
    </RootStack.Navigator>
  );
};

// Main Navigation Component
const Navigation = () => {
  return (
    <NavigationContainer
      ref={
        navigationRef as React.RefObject<
          NavigationContainerRef<RootStackParamList>
        >
      }
      linking={linking}
      fallback={<SplashScreen />}>
      <RootNavigator />
    </NavigationContainer>
  );
};

export default Navigation;
