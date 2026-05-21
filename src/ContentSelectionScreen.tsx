import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {NavigationProp} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

interface ContentSelectionScreenProps {
  navigation: NavigationProp<any>;
}

interface ContentArea {
  id: string;
  title: string;
  description: string;
  icon: string;
  selected: boolean;
  available: boolean;
}

const ContentSelectionScreen: React.FC<ContentSelectionScreenProps> = ({
  navigation,
}) => {
  // Initial content areas with selected state and availability
  const [contentAreas, setContentAreas] = useState<ContentArea[]>([
    {
      id: 'Language Development',
      title: 'Language Skills',
      description:
        'Activities and tips that encourage vocabulary growth, communication skills, and language patterns.',
      icon: 'chat',
      selected: true, // Default selected
      available: true, // Available for selection
    },
    {
      id: 'Early Science Skills',
      title: 'Science Skills',
      description:
        'Explorations and experiments that nurture curiosity, critical thinking, and understanding of the world.',
      icon: 'science',
      selected: false,
      available: true, // Available for selection
    },
    {
      id: 'Literacy Foundations',
      title: 'Literacy Skills',
      description:
        'Reading and writing activities that build pre-literacy skills and foster a love for stories and books.',
      icon: 'menu-book',
      selected: false,
      available: true, // Coming soon
    },
    {
      id: 'Social-Emotional Learning',
      title: 'Social-Emotional Skills',
      description:
        'Guidance for developing emotional intelligence, relationship skills, and healthy self-awareness.',
      icon: 'people',
      selected: false,
      available: true, // Coming soon
    },
  ]);

  // Load saved preferences when component mounts
  useEffect(() => {
    const loadSavedPreferences = async () => {
      try {
        const savedPreferences = await AsyncStorage.getItem(
          'contentPreferences',
        );
        if (savedPreferences) {
          const savedPreferenceIds = JSON.parse(savedPreferences);

          setContentAreas(prev =>
            prev.map(area => ({
              ...area,
              selected: savedPreferenceIds.includes(area.id),
            })),
          );
        }
      } catch (error) {
        console.error('Error loading content preferences:', error);
      }
    };

    loadSavedPreferences();
  }, []);

  // Toggle selection for a content area
  const toggleSelection = (id: string) => {
    const area = contentAreas.find(area => area.id === id);

    console.log(id, area);

    if (area && area.available) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setContentAreas(
        contentAreas.map(area =>
          area.id === id ? {...area, selected: !area.selected} : area,
        ),
      );
    } else if (area && !area.available) {
      // Show "Coming Soon" alert for unavailable content areas
      Alert.alert(
        'Coming Soon',
        `${area.title} content will be available in a future update!`,
        [{text: 'OK', style: 'default'}],
      );
    }
  };

  // Count selected content areas
  const selectedCount = contentAreas.filter(area => area.selected).length;

  // Save preferences and go back
  const savePreferences = async () => {
    try {
      // Get selected content areas
      const selectedAreas = contentAreas
        .filter(area => area.selected)
        .map(area => area.id);

      // Save to AsyncStorage
      await AsyncStorage.setItem(
        'contentPreferences',
        JSON.stringify(selectedAreas),
      );

      console.log('Saved content areas:', selectedAreas);

      // Show confirmation message
      if (selectedAreas.length > 0) {
        const selectedTopics = contentAreas
          .filter(area => area.selected)
          .map(area => area.title)
          .join(' and ');

        Alert.alert(
          'Preferences Saved',
          `Your content preferences have been updated. You will now receive ${selectedTopics}-focused parenting tips.`,
          [{text: 'Great!', onPress: () => navigation.goBack()}],
        );
      } else {
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error saving content preferences:', error);
      navigation.goBack();
    }
  };

  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={['#3B82F6', '#8B5CF6']}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={{flex: 1}}>
      <View
        style={{
          flex: 1,
          marginTop: insets.top + 5,
        }}>
        <StatusBar
          barStyle="light-content"
          translucent
          backgroundColor="#4A90E2"
        />
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Content Preferences</Text>
          <View style={styles.placeholderView} />
        </View>

        <View style={styles.border} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.contentContainer}>
            <Text style={styles.tagline}>
              Personalize Your Parenting Support
            </Text>

            <Text style={styles.description}>
              Select the developmental areas you'd like to focus on. ENACT will
              prioritize these topics when delivering location-based tips and
              resources for your family.
            </Text>

            {/* <View style={styles.betaBadgeContainer}>
              <View style={styles.betaBadge}>
                <Text style={styles.betaBadgeText}>BETA</Text>
              </View>
              <Text style={styles.betaText}>
                Currently, only Language Development and Science Skills content
                are available. Other content areas coming soon!
              </Text>
            </View> */}

            <Text style={styles.selectionStatus}>
              {selectedCount === 0
                ? 'No areas selected yet'
                : `${selectedCount} area${
                    selectedCount !== 1 ? 's' : ''
                  } selected`}
            </Text>

            {contentAreas.map(area => (
              <TouchableOpacity
                key={area.id}
                style={[
                  styles.contentAreaItem,
                  area.selected && styles.contentAreaSelected,
                  !area.available && styles.contentAreaComingSoon,
                ]}
                onPress={() => toggleSelection(area.id)}
                activeOpacity={0.7}>
                <View style={styles.contentAreaHeader}>
                  <Icon
                    name={area.icon}
                    size={22}
                    color={
                      area.selected
                        ? '#FFFFFF'
                        : area.available
                        ? '#3B82F6'
                        : '#999999'
                    }
                    style={styles.contentIcon}
                  />
                  <Text
                    style={[
                      styles.contentAreaTitle,
                      area.selected && styles.selectedText,
                      !area.available && styles.comingSoonText,
                    ]}>
                    {area.title}
                    {!area.available && ' (Coming Soon)'}
                  </Text>
                  {area.available ? (
                    <Icon
                      name={
                        area.selected
                          ? 'check-circle'
                          : 'radio-button-unchecked'
                      }
                      size={22}
                      color={area.selected ? '#FFFFFF' : '#4A90E2'}
                    />
                  ) : (
                    <Icon name="lock" size={20} color="#999999" />
                  )}
                </View>
                <Text
                  style={[
                    styles.contentAreaDescription,
                    area.selected && styles.selectedText,
                    !area.available && styles.comingSoonText,
                  ]}>
                  {area.description}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[
                {borderRadius: 12, overflow: 'hidden', marginBottom: 12},
                selectedCount === 0 && styles.saveButtonDisabled,
              ]}
              onPress={savePreferences}
              disabled={selectedCount === 0}>
              <LinearGradient
                colors={['#3B82F6', '#7C4DFF']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={styles.ctaGradient}>
                <Text style={styles.saveButtonText}>Save Preferences</Text>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.footerNote}>
              You can change these preferences anytime in your profile settings.
            </Text>
          </View>
        </ScrollView>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#4A90E2',
  },
  gradientBackground: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Platform.select({ios: 20, android: 16, default: 16}),
  },
  backButton: {
    padding: Platform.select({ios: 8, android: 6, default: 6}),
  },
  headerTitle: {
    fontSize: Platform.select({ios: 20, android: 18, default: 18}),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeholderView: {
    width: 40, // Same width as back button for center alignment
  },
  border: {
    borderBottomColor: 'rgba(255, 255, 255, 0.8)',
    borderBottomWidth: 1,
    marginVertical: Platform.select({ios: 12, android: 8, default: 8}),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Platform.select({ios: 30, android: 24, default: 24}),
  },
  contentContainer: {
    padding: Platform.select({ios: 20, android: 14, default: 14}),
    backgroundColor: '#FFFFFF',
    margin: Platform.select({ios: 16, android: 14, default: 14}),
    borderRadius: Platform.select({ios: 16, android: 14, default: 14}),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tagline: {
    fontSize: Platform.select({ios: 24, android: 20, default: 20}),
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: Platform.select({ios: 12, android: 8, default: 8}),
  },
  description: {
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    color: '#666666',
    lineHeight: Platform.select({ios: 22, android: 20, default: 20}),
    marginBottom: Platform.select({ios: 24, android: 16, default: 16}),
  },
  betaBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  betaBadge: {
    backgroundColor: '#3B82F6',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  betaBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  betaText: {
    flex: 1,
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  selectionStatus: {
    fontSize: Platform.select({ios: 14, android: 12, default: 12}),
    color: '#666666',
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
    textAlign: 'center',
  },
  contentAreaItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    padding: Platform.select({ios: 16, android: 12, default: 12}),
    marginBottom: Platform.select({ios: 12, android: 10, default: 10}),
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  contentAreaSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  contentAreaComingSoon: {
    backgroundColor: '#F8F9FA',
    borderColor: '#EAEAEA',
    opacity: 0.7,
  },
  contentAreaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Platform.select({ios: 8, android: 6, default: 6}),
  },
  contentIcon: {
    marginRight: Platform.select({ios: 12, android: 10, default: 10}),
  },
  contentAreaTitle: {
    flex: 1,
    fontSize: Platform.select({ios: 18, android: 16, default: 16}),
    fontWeight: '600',
    color: '#333333',
  },
  contentAreaDescription: {
    fontSize: Platform.select({ios: 14, android: 12, default: 12}),
    color: '#666666',
    lineHeight: Platform.select({ios: 20, android: 18, default: 18}),
    paddingLeft: Platform.select({ios: 40, android: 34, default: 34}),
  },
  selectedText: {
    color: '#FFFFFF',
  },
  comingSoonText: {
    color: '#999999',
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  ctaGradient: {
    height: Platform.select({ios: 44, android: 40, default: 40}),
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#A5C8F2',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    fontWeight: '600',
  },
  footerNote: {
    fontSize: Platform.select({ios: 14, android: 12, default: 12}),
    color: '#999999',
    textAlign: 'center',
  },
});

export default ContentSelectionScreen;
