import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, Platform } from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import AntDesign from '@expo/vector-icons/AntDesign';
import LinearGradient from 'react-native-linear-gradient';
import { Location, LocationFormData, SavedLocation } from '../types';

interface LocationFormProps {
  location: Location;
  onSubmit: (data: LocationFormData) => Promise<void>;
  existingLocations: SavedLocation[];
}

const LOCATION_TYPES = [
  { label: 'Grocery Store', value: 'Grocery Store' },
  { label: 'Bus/Walk', value: 'Bus/Walk' },
  { label: 'Library', value: 'Library' },
  { label: 'Park', value: 'Park' },
  { label: 'Restaurant', value: 'Restaurant' },
  { label: 'Waiting Room', value: 'Waiting Room' },
  { label: "Other's Home", value: "Other's Home" },
  { label: 'Other', value: 'Other' },
];

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const LocationForm: React.FC<LocationFormProps> = React.memo(({
  location,
  onSubmit,
  existingLocations,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLocationNearby = useCallback((lat: number, lon: number): boolean => {
    const threshold = 100;
    return existingLocations.some(loc =>
      calculateDistance(lat, lon, loc.latitude, loc.longitude) <= threshold
    );
  }, [existingLocations]);

  const validateForm = useCallback((): boolean => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter a location name');
      return false;
    }
    if (!description.trim()) {
      Alert.alert('Validation Error', 'Please enter a description');
      return false;
    }
    if (!selectedType) {
      Alert.alert('Validation Error', 'Please select a location type');
      return false;
    }
    if (isLocationNearby(location.latitude, location.longitude)) {
      Alert.alert(
        'Duplicate Location',
        'A location already exists within 100 meters. Please choose a different location.'
      );
      return false;
    }
    return true;
  }, [name, description, selectedType, location, isLocationNearby]);

  const doSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        type: selectedType!,
        latitude: location.latitude,
        longitude: location.longitude,
      });
      setName('');
      setDescription('');
      setSelectedType(null);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [onSubmit, name, description, selectedType, location]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm() || isSubmitting) {return;}

    if (name.trim().toLowerCase() === 'home') {
      Alert.alert(
        'Home Location Not Recommended',
        "Just a reminder: to ensure your privacy, please don't save your home address as a location to receive tips.\n\nIf you're adding a friend's or relative's home, feel free to proceed.",
        [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Proceed Anyway', onPress: () => doSubmit()},
        ],
      );
      return;
    }

    await doSubmit();
  }, [validateForm, isSubmitting, name, doSubmit]);

  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.98)']}
      style={styles.container}>
      <Text style={styles.title}>Add New Location</Text>

      <Dropdown
        style={styles.dropdown}
        placeholderStyle={styles.placeholderStyle}
        selectedTextStyle={styles.selectedTextStyle}
        data={LOCATION_TYPES}
        maxHeight={300}
        labelField="label"
        valueField="value"
        placeholder="Select location type"
        value={selectedType}
        onChange={(item) => setSelectedType(item.value)}
        renderLeftIcon={() => (
          <AntDesign style={styles.icon} color="#333" name="Safety" size={20} />
        )}
      />

      <TextInput
        style={styles.input}
        placeholder="Location name"
        value={name}
        onChangeText={setName}
        placeholderTextColor="#666"
        maxLength={50}
        autoCapitalize="words"
        autoCorrect={false}
      />

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        placeholderTextColor="#666"
        multiline
        numberOfLines={3}
        maxLength={200}
        autoCapitalize="sentences"
      />

      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}>
        <Text style={styles.submitButtonText}>
          {isSubmitting ? 'Adding...' : 'Add Location'}
        </Text>
      </TouchableOpacity>
    </LinearGradient>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.select({ios: 20, android: 16, default: 16}),
    left: 16,
    right: 16,
    borderRadius: Platform.select({ios: 16, android: 14, default: 14}),
    padding: Platform.select({ios: 20, android: 14, default: 14}),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: Platform.select({ios: 20, android: 18, default: 18}),
    fontWeight: '600',
    color: '#333',
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
  },
  dropdown: {
    height: Platform.select({ios: 50, android: 44, default: 44}),
    borderColor: '#E8E8E8',
    borderWidth: 1,
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    paddingHorizontal: Platform.select({ios: 12, android: 10, default: 10}),
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
    backgroundColor: '#FFFFFF',
  },
  placeholderStyle: {
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    color: '#666',
  },
  selectedTextStyle: {
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    color: '#333',
  },
  icon: {
    marginRight: 8,
  },
  input: {
    height: Platform.select({ios: 50, android: 44, default: 44}),
    borderColor: '#E8E8E8',
    borderWidth: 1,
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    paddingHorizontal: Platform.select({ios: 16, android: 12, default: 12}),
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    color: '#333',
    backgroundColor: '#FFFFFF',
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
  },
  textArea: {
    height: Platform.select({ios: 100, android: 84, default: 84}),
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  submitButton: {
    backgroundColor: '#4A90E2',
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    height: Platform.select({ios: 50, android: 44, default: 44}),
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    fontWeight: '600',
  },
});
