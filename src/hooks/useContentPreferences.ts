import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useContentPreferences = () => {
  const [contentPreferences, setContentPreferences] = useState<string[]>(['language']); // Default to language
  const [loading, setLoading] = useState<boolean>(true);

  // Load preferences from AsyncStorage
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setLoading(true);
        const savedPreferences = await AsyncStorage.getItem('contentPreferences');
        if (savedPreferences) {
          const parsedPreferences = JSON.parse(savedPreferences);
          setContentPreferences(parsedPreferences.length > 0 ? parsedPreferences : ['language']);
        }
      } catch (error) {
        console.error('Error loading content preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, []);

  return {
    contentPreferences,
    loading,
  };
};
