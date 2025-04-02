/**
 * @format
 */
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import 'react-native-get-random-values';
import PushNotification from 'react-native-push-notification';
import { navigationRef } from './src/ref/NavigationRef';
import {Platform} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Clear existing channels and create main channel
if (Platform.OS === 'ios') {
  // Set up categories for Apple Watch interactive notifications
  PushNotification.setNotificationCategories([
    {
      id: 'location_tip',
      actions: [
        {
          id: 'view_tip',
          title: 'View Tip',
          options: { foreground: true }
        },
        {
          id: 'save_tip',
          title: 'Save for Later',
          options: { foreground: false }
        }
      ]
    }
  ]);
  
  messaging().onMessage(async remoteMessage => {
    console.log('Foreground message received on iOS:', remoteMessage);
    
    // Create a notification with Apple Watch specific properties
    PushNotification.localNotification({
      channelId: 'location-tips',
      title: remoteMessage.notification?.title || 'New notification',
      message: remoteMessage.notification?.body || 'You have a new notification',
      userInfo: remoteMessage.data || {},
      playSound: true,
      soundName: 'default',
      
      // iOS specific options for Apple Watch
      category: 'location_tip',
      threadId: 'enact-parenting',
      
      // Optional: Add a subtitle for Apple Watch
      subtitle: remoteMessage.data?.location || 'Parenting Tip',
    });
  });
}

// For Android, clear and recreate notification channels
PushNotification.getChannels(function (channel_ids) {
  channel_ids.forEach(id => {
    PushNotification.deleteChannel(id);
  });
});

// Create single persistent channel
PushNotification.createChannel(
  {
    channelId: 'location-tips',
    channelName: 'Location Tips',
    channelDescription: 'Notifications for location updates',
    importance: 4,
    vibrate: true,
  },
  created => console.log(`Main channel created: ${created}`),
);

// Helper function to save tips for later viewing
// Handles the "Save for Later" action from Apple Watch
const saveTipForLater = async (data) => {
  try {
    // Get existing saved tips
    const savedTipsJson = await AsyncStorage.getItem('savedTips');
    const savedTips = savedTipsJson ? JSON.parse(savedTipsJson) : [];
    
    // Add the new tip if it doesn't already exist
    if (!savedTips.some(tip => tip.id === data.tipId)) {
      savedTips.push({
        id: data.tipId,
        title: data.title || 'Parenting Tip',
        message: data.message || '',
        location: data.location || '',
        savedAt: new Date().toISOString(),
      });
      
      // Save the updated list
      await AsyncStorage.setItem('savedTips', JSON.stringify(savedTips));
      console.log('Tip saved for later from Apple Watch');
    }
  } catch (error) {
    console.error('Error saving tip for later:', error);
  }
};

// Navigation helper function
const navigateToNotification = (title, message, data) => {
  if (navigationRef.current) {
    // First ensure we're in the Main navigator
    if (navigationRef.current.getCurrentRoute()?.name !== 'Main') {
      navigationRef.current.navigate('Main');
    }
    
    // Check if data contains a specific screen to navigate to
    const targetScreen = data.screen || 'Home';
    
    // Then navigate to the appropriate tab or screen
    navigationRef.current.navigate('Main', {
      screen: targetScreen,
      params: {
        notificationData: {
          title,
          message,
          ...data
        }
      }
    });
  }
};

// Configure push notifications
PushNotification.configure({
  onRegister: function (token) {
    console.log('TOKEN:', token);
  },
  
  onNotification: function (notification) {
    const {message, title, userInteraction, foreground, data, actionIdentifier} = notification;
    
    // Safety checks for notification content
    const safeTitle = title || 'New Notification';
    const safeMessage = message || 'You have a new notification';
    
    console.log('NOTIFICATION RECEIVED:', {
      title: safeTitle,
      body: safeMessage,
      userInteraction,
      foreground,
      data,
      actionIdentifier, // This will contain the ID of the action selected on Apple Watch
    });
    
    // Handle Apple Watch action responses
    if (actionIdentifier) {
      if (actionIdentifier === 'view_tip') {
        // Navigate to the tip detail screen
        navigateToNotification(safeTitle, safeMessage, {
          ...data,
          screen: 'TipDetail', // Update this to match your actual screen name
        });
      } else if (actionIdentifier === 'save_tip') {
        // Save the tip for later
        saveTipForLater({
          tipId: data.tipId || new Date().getTime().toString(),
          title: safeTitle,
          message: safeMessage,
          location: data.location,
          ...data,
        });
      }
    }
    
    // Only create local notification if it's a new FCM notification
    // and not user clicking an existing notification
    if (!userInteraction && !foreground && !actionIdentifier) {
      PushNotification.localNotification({
        channelId: 'location-tips',
        title: safeTitle,
        message: safeMessage,
        userInfo: data,
        autoCancel: true,
        onlyAlertOnce: true,
        importance: 'high',
        priority: 'high',
        // iOS specific options for Apple Watch
        category: 'location_tip',
        threadId: 'enact-parenting',
        subtitle: data?.location || 'Parenting Tip',
        // Add data for navigation when clicked
        data: {
          ...data,
          navigateOnClick: true,
        }
      });
    }
    
    // Handle normal notification click (not from an action)
    if (userInteraction && !actionIdentifier) {
      console.log('User clicked notification:', {
        title: safeTitle,
        message: safeMessage,
        data,
      });
      
      // Navigate when notification is clicked
      navigateToNotification(safeTitle, safeMessage, data);
    }
    
    // Required on iOS
    notification.finish && notification.finish();
  },
  
  // iOS permissions - include all needed for Apple Watch
  permissions: {
    alert: true,
    badge: true,
    sound: true,
    criticalAlert: true, // Important for urgent notifications
  },
  
  popInitialNotification: true,
  requestPermissions: true,
});

// For FCM background handling
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Message handled in the background!', remoteMessage);
  // No need to create a notification here as the system will do it
  return Promise.resolve();
});

AppRegistry.registerComponent(appName, () => App);