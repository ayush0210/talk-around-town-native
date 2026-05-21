import React, { useCallback, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { GooglePlacesAutocomplete, GooglePlacesAutocompleteRef } from 'react-native-google-places-autocomplete';
import { Icon } from 'react-native-elements';
import { Location } from '../types';

interface LocationSearchBarProps {
  onLocationSelect: (location: Location) => void;
  onClear: () => void;
}

export const LocationSearchBar: React.FC<LocationSearchBarProps> = React.memo(({
  onLocationSelect,
  onClear,
}) => {
  const ref = useRef<GooglePlacesAutocompleteRef>(null);

  const handlePress = useCallback((data: any, details: any) => {
    if (details?.geometry?.location) {
      const { lat, lng } = details.geometry.location;
      onLocationSelect({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.015,
        longitudeDelta: 0.0121,
      });
    }
  }, [onLocationSelect]);

  const handleClear = useCallback(() => {
    ref.current?.clear();
    onClear();
  }, [onClear]);

  return (
    <View style={styles.searchWrapper}>
      <View style={styles.searchContainer}>
        <GooglePlacesAutocomplete
          placeholder="Search location..."
          fetchDetails={true}
          styles={searchStyles}
          onPress={handlePress}
          onFail={(error) => console.error('Search error:', error)}
          onNotFound={() => console.log('No results found')}
          query={{
            key: 'AIzaSyBczo2yBRbSwa4IVQagZKNfTje0JJ_HEps',
            language: 'en',
          }}
          renderRightButton={() => (
            <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
              <Icon name="close" size={20} color="#666" />
            </TouchableOpacity>
          )}
          ref={ref}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  searchWrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
  },
  searchContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  clearButton: {
    padding: 12,
  },
});

const searchStyles = {
  container: { flex: 0 },
  textInputContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 0,
  },
  textInput: {
    height: Platform.select({ios: 45, android: 40, default: 40}),
    color: '#333',
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    paddingHorizontal: Platform.select({ios: 15, android: 12, default: 12}),
  },
  listView: {
    backgroundColor: 'white',
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    marginTop: 5,
  },
  row: {
    padding: Platform.select({ios: 13, android: 10, default: 10}),
    height: Platform.select({ios: 50, android: 44, default: 44}),
  },
};
