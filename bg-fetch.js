import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundFetch from 'react-native-background-fetch';
import GetLocation1 from 'react-native-get-location';

BackgroundFetch.configure(
    {
      minimumFetchInterval: 15, // Minimum interval in minutes
      stopOnTerminate: false, // Keep running in the background
    },
    async taskID => {
      // Perform background tasks here

      // await fetchLocationAndSendData();
      BackgroundFetch.finish(taskID);
    },
    error => {
      console.error('Background fetch error:', error);
    },
  );
