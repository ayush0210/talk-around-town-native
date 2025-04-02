import React from 'react';
import { View, Button, Text, StyleSheet, SafeAreaView } from 'react-native';
import PushNotification from 'react-native-push-notification';

const TestWatchNotificationScreen = () => {
  const testWatchNotification = () => {
    PushNotification.localNotification({
      channelId: 'location-tips',
      title: 'ENACT Watch Test',
      message: 'This is a test notification for Apple Watch with interactive actions',
      userInfo: {
        tipId: 'test-' + Date.now(),
        locationName: 'Test Location',
        locationType: 'Test',
        // Include any other data you want to pass with the notification
      },
      // iOS specific options for Apple Watch
      category: 'location_tip',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Apple Watch Notification Test</Text>
      <Text style={styles.description}>
        Press the button below to send a test notification.
        The notification should appear on both your iPhone and Apple Watch.
        On the watch, you can long-press to see the interactive buttons.
      </Text>
      <Button
        title="Send Test Watch Notification"
        onPress={testWatchNotification}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1, 
    padding: 20,
    backgroundColor: '#f0f0f5',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#4A90E2',
  },
  description: {
    fontSize: 16,
    marginBottom: 30,
    lineHeight: 22,
  },
});

export default TestWatchNotificationScreen;