// import { initializeApp } from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import app from '@react-native-firebase/app';
import { Platform } from 'react-native';

// const firebaseConfig = {
//   apiKey: "AIzaSyDCQ5FKEmRdjopvTruLWRqkQyY7ATJIPzs",
//   authDomain: "talk-around-town-423916-ec889.firebaseapp.com",
//   projectId: "talk-around-town-423916-ec889",
//   storageBucket: "talk-around-town-423916-ec889.firebasestorage.app",
//   messagingSenderId: "96534916371",
//   appId: "1:96534916371:android:9de26ff9db83dc02b6bee6"
// };

// Your secondary Firebase project credentials for Android...
const androidCredentials = {
  clientId: '116743296838008978882',
  appId: '1:96534916371:android:9de26ff9db83dc02b6bee6',
  apiKey: 'AIzaSyDCQ5FKEmRdjopvTruLWRqkQyY7ATJIPzs',
  messagingSenderId: '96534916371',
  projectId: 'talk-around-town-423916-ec889',
};

// Your secondary Firebase project credentials for iOS...
const iosCredentials = {
  clientId: '116743296838008978882',
  appId: '1:96534916371:ios:5b5d3c06744c3831b6bee6',
  apiKey: 'AIzaSyDCQ5FKEmRdjopvTruLWRqkQyY7ATJIPzs',
  messagingSenderId: '96534916371',
  projectId: 'talk-around-town-423916-ec889',
};

// Select the relevant credentials
const credentials = Platform.select({
  android: androidCredentials,
  ios: iosCredentials,
});

const config = {
  name: 'SECONDARY_APP',
};


// Initialize Firebase if it hasn't been initialized yet
if (!auth().app) {
  app.initializeApp(credentials, config);
}

export default app;
