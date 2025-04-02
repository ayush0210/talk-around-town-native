import React, {useContext} from 'react';
import {Platform, View} from 'react-native';
import {
  NavigationContainer,
  NavigationContainerRef,
  LinkingOptions,
  RouteProp,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {AuthContext, AuthContextType} from '../context/AuthContext';
import {navigationRef} from '../ref/NavigationRef';
import RemoteNotification from '../components/RemoteNotification';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';

// Screens
import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import MainScreen from '../screens/MainScreen';
import AssistantScreen from '../screens/Assistant/MainScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import LocationListScreen from '../screens/LocationList';
import {Location} from 'react-native-get-location';
import TestWatchNotificationScreen from '../screens/TestWatchNotificationScreen';

// Types
export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined; // Corrected: No parameters as it's a navigator
  Main: undefined; // Corrected: No parameters as it's a navigator
  LocationList: {
    locations: Location[];
    details: {
      title: string;
      description: string;
      pinColor: string;
    }[];
  };
  TestWatchNotifications: undefined; // Added to fix the error
};

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: {token: string};
};
interface LocationListProps {
  locations: any;
  details: any;
  navigation: any;
}
type MainTabParamList = {
  Home: undefined;
  Assistant: undefined;
  // LocationList: LocationListProps;
};

// Linking configuration with corrected types
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
          LocationList: 'locations',
        },
      },
    },
  },
};

// Navigators
const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

// Icon configuration remains unchanged
const getIconName = (routeName: string, focused: boolean): string => {
  switch (routeName) {
    case 'Home':
      return focused ? 'home' : 'home-outline';
    case 'Assistant':
      return focused ? 'chatbubbles' : 'chatbubbles-outline';
    case 'LocationList':
      return focused ? 'list' : 'list-outline';
    default:
      return 'alert-circle';
  }
};

// Wrapper component remains unchanged
const ScreenWithNotification: React.FC<{children: React.ReactNode}> = ({
  children,
}) => (
  <View style={{flex: 1}}>
    {children}
    <RemoteNotification />
  </View>
);

// Tab Navigator remains unchanged
const TabNavigator = () => (
  <ScreenWithNotification>
    <MainTab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused, color, size}) => {
          const iconName = getIconName(route.name, focused);
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: Platform.OS === 'ios' ? '#007AFF' : '#6200EE',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
        tabBarStyle: {
          paddingVertical: Platform.OS === 'ios' ? 10 : 0,
          height: Platform.OS === 'ios' ? 88 : 60,
        },
      })}>
      <MainTab.Screen name="Home" component={MainScreen} />
      <MainTab.Screen name="Assistant" component={AssistantScreen} />
      {/* <MainTab.Screen
        name="LocationList"
        component={LocationListScreen as React.ComponentType<any>}
        options={{
          tabBarIcon: ({focused, color, size}) => (
            <Ionicons
              name={focused ? 'list' : 'list-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      /> */}
    </MainTab.Navigator>
  </ScreenWithNotification>
);

// Auth Navigator remains unchanged
const AuthNavigator = () => (
  <ScreenWithNotification>
    <AuthStack.Navigator screenOptions={{headerShown: false}}>
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

// Root Navigator remains unchanged
const RootNavigator = () => {
  const {userInfo, splashLoading} = useContext<AuthContextType>(AuthContext);
  
  return (
    <RootStack.Navigator screenOptions={{headerShown: false}}>
      {splashLoading ? (
        <RootStack.Screen name="Splash" component={SplashScreen} />
      ) : userInfo.access_token ? (
        <>
          <RootStack.Screen name="Main" component={TabNavigator} />
          <RootStack.Screen name="LocationList" component={LocationListScreen} />
          <RootStack.Screen
            name="TestWatchNotifications"
            component={TestWatchNotificationScreen}
          />
        </>
      ) : (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
    </RootStack.Navigator>
  );
};

// Main Navigation Component remains unchanged
const Navigation = () => (
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

export default Navigation;
