import React, {useState, useContext, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import {RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {Location} from '../types';
import {AuthContext} from '../context/AuthContext';
import {fetchWithAuth} from '../api/auth';
import Spinner from 'react-native-loading-spinner-overlay';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {BASE_URL} from '../config';

type RootStackParamList = {
  LocationList: {
    locations: Location[];
    details: Array<{
      id: number; // Make sure this is defined as number, not string
      title: string;
      description: string;
      pinColor: string;
    }>;
  };
};

type LocationListScreenProps = {
  route: RouteProp<RootStackParamList, 'LocationList'>;
  navigation: NativeStackNavigationProp<RootStackParamList, 'LocationList'>;
};

const LocationListScreen: React.FC<LocationListScreenProps> = ({
  route,
  navigation,
}) => {
  const {userInfo} = useContext(AuthContext);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [locationsList, setLocationsList] = useState(
    route.params?.locations || [],
  );
  const [locationDetails, setLocationDetails] = useState(
    route.params?.details || [],
  );
  const [loading, setLoading] = useState(false);

  console.log('Initial details from params:', route.params?.details);

  // Function to fetch locations
  const fetchLocations = async () => {
    try {
      setLoading(true);

      console.log('Fetching locations...');

      const response = await fetchWithAuth(`${BASE_URL}/endpoint/locations`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.access_token}`,
        },
      });

      if (response.status === 200) {
        const data = await response.json();
        console.log('Locations response:', data);

        // Check if ids are included in details
        if (data.details && data.details.length > 0) {
          console.log('First location ID:', data.details[0].id);
        }

        setLocationsList(data.locations);
        setLocationDetails(data.details);
      } else {
        console.error('Error fetching locations:', response.status);
      }
    } catch (error) {
      console.error('Exception fetching locations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh locations when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchLocations();
      return () => {};
    }, [userInfo]),
  );

  const initialRegion =
    locationsList.length > 0
      ? {
          latitude: locationsList[0].latitude,
          longitude: locationsList[0].longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }
      : null;

  const handleLocationPress = (index: number) => {
    setSelectedLocation(index);
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: locationsList[index].latitude,
          longitude: locationsList[index].longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000,
      );
    }
  };

  const deleteLocation = async (index: number) => {
    try {
      setLoading(true);

      // Get the ID from locationDetails
      const locationId = locationDetails[index]?.id;

      console.log('Attempting to delete location:', {
        index,
        locationDetail: locationDetails[index],
        locationId,
      });

      // Check if ID exists
      if (locationId === undefined) {
        Alert.alert('Error', 'Cannot delete: Missing location ID');
        setLoading(false);
        return;
      }

      // Make the API call to delete the location
      const response = await fetchWithAuth(
        `${BASE_URL}/endpoint/deleteLocation`,
        {
          method: 'DELETE',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userInfo.access_token}`,
          },
          body: JSON.stringify({
            id: locationId,
          }),
        },
      );

      console.log('Delete response status:', response.status);

      let responseData = null;
      try {
        responseData = await response.json();
        console.log('Delete response data:', responseData);
      } catch (e) {
        console.error('Could not parse response JSON:', e);
      }

      // Process response and update UI
      if (response.status >= 200 && response.status < 300) {
        // Update local state to remove the deleted location
        const newLocations = [...locationsList];
        newLocations.splice(index, 1);
        setLocationsList(newLocations);

        const newDetails = [...locationDetails];
        newDetails.splice(index, 1);
        setLocationDetails(newDetails);

        // Reset selected location if needed
        if (selectedLocation === index) {
          setSelectedLocation(null);
        } else if (selectedLocation !== null && selectedLocation > index) {
          setSelectedLocation(selectedLocation - 1);
        }

        Alert.alert('Success', 'Location deleted successfully');

        // Refresh the locations list to ensure it's up to date
        fetchLocations();
      } else {
        // Construct a more detailed error message
        let errorMessage = 'Failed to delete location';
        if (responseData && responseData.error) {
          errorMessage = `${responseData.error}`;
          if (responseData.details) {
            errorMessage += `\n\nDetails: ${responseData.details}`;
          }
          if (responseData.code) {
            errorMessage += `\n\nCode: ${responseData.code}`;
          }
        }

        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      console.error('Exception during deletion:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      Alert.alert('Error', `Failed to delete location: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const mapRef = React.useRef<MapView>(null);

  const renderItem = ({item, index}: {item: any; index: number}) => (
    <TouchableOpacity
      style={[
        styles.locationItem,
        selectedLocation === index && styles.selectedLocation,
      ]}
      onPress={() => handleLocationPress(index)}>
      <View style={styles.locationHeader}>
        <Icon
          name="location-on"
          size={24}
          color={selectedLocation === index ? '#fff' : '#007AFF'}
        />
        <Text
          style={[
            styles.locationTitle,
            selectedLocation === index && styles.selectedText,
          ]}>
          {locationDetails[index]?.title || `Location ${index + 1}`}
          {/* {locationDetails[index]?.id ? ` (ID: ${locationDetails[index].id})` : ''} */}
        </Text>
        <View style={styles.spacer} />
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => {
            Alert.alert(
              'Delete Location',
              'Are you sure you want to delete this location?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Delete',
                  onPress: () => deleteLocation(index),
                  style: 'destructive',
                },
              ],
              {cancelable: true},
            );
          }}>
          <Icon
            name="delete"
            size={22}
            color={selectedLocation === index ? '#fff' : '#FF3B30'}
          />
        </TouchableOpacity>
      </View>
      <Text
        style={[
          styles.locationDescription,
          selectedLocation === index && styles.selectedText,
        ]}>
        {locationDetails[index]?.description || 'No description available'}
      </Text>
      <Text
        style={[
          styles.coordinates,
          selectedLocation === index && styles.selectedText,
        ]}>
        Lat: {item.latitude.toFixed(6)}, Long: {item.longitude.toFixed(6)}
      </Text>
    </TouchableOpacity>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Icon name="location-off" size={50} color="#ccc" />
      <Text style={styles.emptyText}>No locations found</Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.goBack()}>
        <Text style={styles.addButtonText}>Add New Location</Text>
      </TouchableOpacity>
    </View>
  );

  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={['#EFF6FF', '#FFFFFF', '#F5F3FF']}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={styles.container}>
      <View
        style={{
          flex: 1,
          paddingTop: Platform.OS === 'ios' ? insets.top - 10 : insets.top,
        }}>
        <Spinner visible={loading} />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={20} color="#1F2937" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Saved Locations ({locationsList.length})
          </Text>
        </View>

        {initialRegion && locationsList.length > 0 ? (
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={initialRegion}>
              {locationsList.map((location, index) => (
                <Marker
                  key={index}
                  coordinate={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                  }}
                  title={
                    locationDetails[index]?.title || `Location ${index + 1}`
                  }
                  description={locationDetails[index]?.description}
                  pinColor={selectedLocation === index ? '#007AFF' : '#FF3B30'}
                  onPress={() => setSelectedLocation(index)}
                />
              ))}
            </MapView>
          </View>
        ) : null}

        <FlatList
          data={locationsList}
          renderItem={renderItem}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={styles.listContainer}
          style={styles.list}
          ListEmptyComponent={renderEmptyList}
        />
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 16,
    position: 'relative',
  },
  backButton: {
    zIndex: 1, // ensures it’s clickable above the centered title
  },

  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  mapContainer: {
    height: Dimensions.get('window').height * 0.4,
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  map: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  locationItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedLocation: {
    backgroundColor: '#007AFF',
  },
  selectedText: {
    color: 'white',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginLeft: 8,
    flex: 1,
  },
  spacer: {
    flex: 1,
  },
  deleteButton: {
    padding: 5,
  },
  locationDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  coordinates: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LocationListScreen;
