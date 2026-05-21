import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  Alert,
  Text,
  Button,
  TouchableOpacity,
  TextInput,
  Pressable,
} from 'react-native';
import MapView, {PROVIDER_GOOGLE, Marker, Circle} from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import {
  GooglePlacesAutocomplete,
  GooglePlacesAutocompleteRef,
} from 'react-native-google-places-autocomplete';
import RemoteNotification from './RemoteNotification';
import {Icon} from 'react-native-elements';

// RemoteNotification()
interface Location {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}


const App: React.FC = () => {
  const [location, setLocation] = useState<Location | null>();
  const ref = useRef<GooglePlacesAutocompleteRef>(null);
  // add a loader state variable
  const [loading, setLoading] = useState<boolean>(true);
  // const [pinged, SetPinged] = useState<boolean>(false);
  const [newLocation, setNewLocation] = useState<Location | null>(null);
  // a state variable for name and description
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [locations, setLocations] = useState<Location[]>([
    {
      latitude: 29.646868333333334,
      longitude: -82.33709333333333,
      latitudeDelta: 0.015,
      longitudeDelta: 0.0121,
    },
    {
      latitude: 29.644218333333335,
      longitude: -82.33938666666667,
      latitudeDelta: 0.015,
      longitudeDelta: 0.0121,
    },
  ]);
  const [details, setDetails] = useState<
    Array<{title: string; desription: string; pinColor: string}>
  >([
    {
      title: 'Norman Hall',
      desription: 'This is a description of Norman Hall',
      pinColor: 'blue',
    },
    {
      title: 'Road next to Norman Hall',
      desription: 'This is a description of the road next to Norman Hall',
      pinColor: 'green',
    },
  ]);
  const addLocation = () => {
    console.log('Add location');
    if (newLocation) {
      setLocations([...locations, newLocation]);
      setDetails([
        ...details,
        {title: name, desription: description, pinColor: 'red'},
      ]);
      setNewLocation(null);
      setName('');
      setDescription('');
    }
  };

  useEffect(() => {
    // RemoteNotification()
    const fetchLocationAndSendData = async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This app needs access to your location.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Location permission denied');
          return;
        }
      }
      Geolocation.getCurrentPosition(
        async position => {
          // console.log(position);
          const {latitude, longitude} = position.coords;
          console.log(latitude, longitude);
          setLocation({
            latitude,
            longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.0121,
          });
          setLoading(false);
          // Now send the location data to your server
          try {
            const response = await fetch('https://enact.education.ufl.edu/endpoint', {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                latitude,
                longitude,
              }),
            });
            // const jsonResponse = await response.json();
            console.log('Data sent to server:', response.status);
          } catch (error) {
            console.error('Error sending location data:', error);
          }
        },
        error => {
          Alert.alert('Error', 'Unable to fetch location');
          console.log(error);
        },
        {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
      );
    };

    // Set up the interval to call fetchLocationAndSendData every 5 seconds
    const intervalId = setInterval(fetchLocationAndSendData, 5000);

    // Call fetchLocationAndSendData immediately when the component mounts
    // fetchLocationAndSendData();

    // Clean up the interval on component unmount
    return () => clearInterval(intervalId);
  }, []);
  if(loading) {
    return (
      <View>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {location && (
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          region={newLocation ? newLocation : location}
          showsUserLocation
          mapType="standard"
          userInterfaceStyle="light">
          {locations.map((loc, index) => (
            <React.Fragment key={index}>
              <Marker
                coordinate={loc}
                title={details[index].title}
                description={details[index].desription}
                pinColor={details[index].pinColor}
              />
              <Circle
                center={loc}
                radius={100} // radius in meters
                strokeColor="rgba(0,0,255,0.5)"
                fillColor="rgba(0,0,255,0.1)"
                zIndex={2}
              />
            </React.Fragment>
          ))}
        </MapView>
      )}
      <>
        <GooglePlacesAutocomplete
          placeholder="Search"
          fetchDetails={true}
          styles={styles1}
          onPress={(data, details = null) => {
            // 'details' is provided when fetchDetails = true
            if (details) {
              const latitude = details.geometry.location.lat;
              const longitude = details.geometry.location.lng;
              console.log('Latitude:', latitude);
              console.log('Longitude:', longitude);
              setNewLocation({
                latitude,
                longitude,
                latitudeDelta: 0.015,
                longitudeDelta: 0.0121,
              });
            }
          }}
          query={{
            key: 'AIzaSyBczo2yBRbSwa4IVQagZKNfTje0JJ_HEps',
            language: 'en',
          }}
          renderRightButton={() => (
            <TouchableOpacity
              style={styles1.clearButton}
              onPress={() => {
                ref.current && ref.current.clear();
                setNewLocation(null);
              }}>
              <Icon name="close" size={25} color="black" />
            </TouchableOpacity>
          )}
          ref={ref}
        />
        {/* two text input boxes, one for title and one for description. Only visible when newLocation not null */}
        {newLocation && (
          <>
            <View style={styles.bg}>
              <TextInput
                placeholder="Title"
                style={styles.input}
                value={name}
                onChange={e => {
                  setName(e.nativeEvent.text);
                }}
              />
              <TextInput
                placeholder="Description"
                style={styles.input}
                value={description}
                onChange={e => {
                  setDescription(e.nativeEvent.text);
                }}
              />
            </View>
          </>
        )}
        {/* <Button title="Add location" onPress={addLocation}> */}

        {/* <Text>Add location</Text> */}
        {/* <Button style={styles1.button} title="Add location" onPress={addLocation}>
          <Text>Add location</Text>
        </Button> */}
        <Pressable style={styles1.button} onPress={addLocation}>
          <Text style={styles1.buttonText}>Add location</Text>
        </Pressable>
        <Text>Current Location</Text>
        <Text>{location?.latitude}</Text>
        <Text>{location?.longitude}</Text>
      </>
      <RemoteNotification />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    // justifyContent: 'center',
    // alignItems: 'center',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    height: '70%',
    // margin: '3%',
    // marginTop: '17%',
    borderBlockColor: 'black',
  },
  bar: {
    // height: '10%',
    margin: '3%',
  },
  input: {
    height: 40,
    borderColor: 'black',
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  bg: {
    backgroundColor: 'white',
    padding: 10,
  },
});

const styles1 = StyleSheet.create({
  clearButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 10,
  },
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    margin: 10,
  },
  textInput: {
    height: 40,
    color: '#5d5d5d',
    fontSize: 16,
    flex: 1,
  },
  button: {
    backgroundColor: 'blue',
    color: 'white',
    padding: 5,
    width: 120,
    margin: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
  },
});
export default App;


// import {Alert, PermissionsAndroid, Platform, StatusBar} from 'react-native';
// import Navigation from './src/components/Navigation';
// import {AuthProvider} from './src/context/AuthContext';
// import {LocationProvider} from './src/context/LocationContext';
// import Geolocation from '@react-native-community/geolocation';
// import React from 'react';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import GetLocation1 from 'react-native-get-location';
// import * as BackgroundFetch from 'expo-background-fetch';
// import * as TaskManager from 'expo-task-manager';
// // import * as Location from 'expo-location';
// import Geolocation2 from 'react-native-geolocation-service';
// const BACKGROUND_FETCH_TASK = 'background-fetch-task';
// // Navigation.geolocation = require('@react-native-community/geolocation');
// TaskManager.defineTask(BACKGROUND_FETCH_TASK, async ({data}) => {
//   console.log('Background fetch task:', data);
//   const now = Date.now();
//   console.log(
//     `Got background fetch call at date: ${new Date(now).toISOString()}`,
//   );

//   const userInfo = await AsyncStorage.getItem('userInfo');
//   if (!userInfo) {
//     console.log('No user info found');
//     return;
//   }
//   let access_token = JSON.parse(userInfo || '{}').access_token;
//   console.log('Access token:', access_token);
//   if (Platform.OS === 'android') {
//     const granted = await PermissionsAndroid.request(
//       PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
//       {
//         title: 'Location Permission',
//         message: 'This app needs access to your location.',
//         buttonNeutral: 'Ask Me Later',
//         buttonNegative: 'Cancel',
//         buttonPositive: 'OK',
//       },
//     );
//     console.log('granted: ', granted)
//     if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
//       Alert.alert('Location permission denied');
//       return;
//     }
//   }

//   Geolocation.getCurrentPosition(
//     async position => {
//       // console.log(position);
//       const {latitude, longitude} = position.coords;
//       console.log(latitude, longitude);
//       try {
//         const response = await fetch('https://enact.education.ufl.edu/endpoint', {
//           method: 'POST',
//           headers: {
//             Accept: 'application/json',
//             'Content-Type': 'application/json',
//             Authorization: `Bearer ${access_token}`,
//           },
//           body: JSON.stringify({
//             latitude,
//             longitude,
//           }),
//         });
//         // const jsonResponse = await response.json();
//         console.log('Data sent to server via bg:', response.status);
//       } catch (error) {
//         console.error('Error sending location data:', error);
//       }
//     },
//     error => {
//       // Alert.alert('Error', 'Unable to fetch location');
//       console.log(error);
//       return BackgroundFetch.BackgroundFetchResult.Failed;
//     },
//     {enableHighAccuracy: false},
//   );
//   GetLocation1.getCurrentPosition({
//     enableHighAccuracy: false,
//     timeout: 5000,
//     rationale: {
//       title: 'Cool Photo App Camera Permission',
//       message:
//         'Cool Photo App needs access to your camera ' +
//         'so you can take awesome pictures.',
//       buttonNeutral: 'Ask Me Later',
//       buttonNegative: 'Cancel',
//       buttonPositive: 'OK',
//     },
//   })
//     .then(async (location: any) => {
//       console.log(location);
//       // make the API call here
//       let {latitude, longitude} = location;
//       try {
//         const response = await fetch('https://enact.education.ufl.edu/endpoint', {
//           method: 'POST',
//           headers: {
//             Accept: 'application/json',
//             'Content-Type': 'application/json',
//             Authorization: `Bearer ${access_token}`,
//           },
//           body: JSON.stringify({
//             latitude,
//             longitude,
//           }),
//         });
//         // const jsonResponse = await response.json();
//         console.log('Data sent to server in:', response.status);
//       } catch (error) {
//         console.error('Error sending location data:', error);
//         return BackgroundFetch.BackgroundFetchResult.Failed;
//       }
//     })
//     .catch((error: any) => {
//       const {code, message} = error;
//       console.warn(code, message);
//       return BackgroundFetch.BackgroundFetchResult.Failed;
//     });
//     Geolocation2.getCurrentPosition(info => console.log(info));

//   // Be sure to return the successful result type!
//   return BackgroundFetch.BackgroundFetchResult.NewData;
// });

// const App = () => {
//   BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
//     minimumInterval: 60, // 60 seconds
//     stopOnTerminate: false, // android only,
//     startOnBoot: true, // android only
//   });
//   return (
//     <AuthProvider>
//       <LocationProvider>
//         <StatusBar backgroundColor="#06bcee" />
//         <Navigation />
//       </LocationProvider>
//     </AuthProvider>
//   );
// };

// export default App;

