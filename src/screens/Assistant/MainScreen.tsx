import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useContext,
} from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Voice from '@react-native-voice/voice';
import Sound from 'react-native-sound';
import {Platform, PermissionsAndroid} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Loader from './Loader';
import ChildInfoModal from '../ChildInfoModal';
import {AuthContext, AuthContextType} from '../../context/AuthContext';
import DashboardScreen from './DashboardScreen';
interface Child {
  id: number;
  nickname?: string;
  date_of_birth: string;
  age?: number;
}

interface Tip {
  id: number;
  title: string;
  body: string;
  details: string;
  audioUrl: string;
}

const calculateAge = (dateOfBirth: string): number => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
};

const detectChildNameInQuery = (query: string, childrenInfo: Child[]) => {
  if (!childrenInfo || childrenInfo.length === 0) {
    return null;
  }
  
  // Normalize the query (lowercase for case-insensitive matching)
  const normalizedQuery = query.toLowerCase();
  
  // Check for each child's name in the query
  for (const child of childrenInfo) {
    const nickname = child.nickname?.toLowerCase();
    
    // Skip if no nickname is available
    if (!nickname) continue;
    
    // Simple check if the nickname appears in the query
    // We can look for variants like "for [name]" or "[name]'s" or just the name itself
    const patterns = [
      ` for ${nickname}`,
      ` ${nickname}'s `,
      ` ${nickname} `,
      `^${nickname} `,       // At the beginning of the query
      ` ${nickname}$`,       // At the end of the query
      `^${nickname}$`        // Query is just the name
    ];
    
    if (patterns.some(pattern => normalizedQuery.match(pattern))) {
      return child;
    }
  }
  
  return null;
};

const API_BASE_URL = 'http://68.183.102.75:4000';
const CRUD_API_BASE_URL = 'http://68.183.102.75:1337';

const RatingButtons: React.FC<{tipId: number}> = ({tipId}) => {
  const [rating, setRating] = useState<'up' | 'down' | null>(null);
  const [repeatPreference, setRepeatPreference] = useState<boolean | null>(
    null,
  );

  const handleRating = async (type: 'up' | 'down') => {
    try {
      const response = await fetch(`${CRUD_API_BASE_URL}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tipId,
          rating: type,
        }),
      });

      if (response.ok) {
        setRating(type);
        // Automatically set repeat preference based on rating
        const shouldRepeat = type === 'up';
        setRepeatPreference(shouldRepeat);
        handleRepeatPreference(shouldRepeat);
      }
    } catch (error) {
      console.error('Error sending rating:', error);
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    }
  };

  const handleRepeatPreference = async (shouldRepeat: boolean) => {
    try {
      const response = await fetch(
        `${CRUD_API_BASE_URL}/set-repeat-preference`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tipId,
            shouldRepeat,
          }),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to set repeat preference');
      }
    } catch (error) {
      console.error('Error setting repeat preference:', error);
      Alert.alert('Error', 'Failed to save preference. Please try again.');
    }
  };

  return (
    <View style={styles.ratingContainer}>
      <TouchableOpacity
        style={[styles.ratingButton, rating === 'up' && styles.ratingActive]}
        onPress={() => handleRating('up')}>
        <Icon
          name="thumb-up"
          size={20}
          color={rating === 'up' ? '#007AFF' : '#666'}
        />
        <Text
          style={[
            styles.ratingText,
            rating === 'up' && styles.ratingTextActive,
          ]}>
          Liked it!
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.ratingButton, rating === 'down' && styles.ratingActive]}
        onPress={() => handleRating('down')}>
        <Icon
          name="thumb-down"
          size={20}
          color={rating === 'down' ? '#FF3B30' : '#666'}
        />
        <Text
          style={[
            styles.ratingText,
            rating === 'down' && styles.ratingTextActive,
          ]}>
          Not Helpful
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const MainScreen: React.FC = () => {
  const navigation = useNavigation();
  const [isListening, setIsListening] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [tips, setTips] = useState<Tip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeAudioIndex, setActiveAudioIndex] = useState<number | null>(null);
  const [showAgePrompt, setShowAgePrompt] = useState(false);
  const [lastQuery, setLastQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const { userInfo, isLoading: contextLoading, isAdmin } = useContext<AuthContextType>(AuthContext);

  const currentSound = useRef<Sound | null>(null);
  const lastResult = useRef<string>('');
  const [showChildInfo, setShowChildInfo] = useState(false);
  const [childrenInfo, setChildrenInfo] = useState<Child[]>([]);
  console.log('Admin status check:', { isAdmin, userInfoIsAdmin: userInfo.isAdmin });

  const navigateToSettings = () => {
    // @ts-ignore - This tells TypeScript to ignore the type error for this line
    navigation.navigate('Settings');
  };


  const fetchChildrenInfo = async () => {
    if (!userInfo?.access_token) {
      console.error('No access token available');
      return;
    }

    try {
      setIsLoading(true); // Add loading state
      const response = await fetch(
        'http://68.183.102.75:1337/endpoint/children',
        {
          headers: {
            Authorization: `Bearer ${userInfo.access_token}`,
          },
        },
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data && data.children) {
        setChildrenInfo(data.children);
      } else {
        setChildrenInfo([]);
      }
    } catch (error) {
      console.error('Error fetching children info:', error);
      Alert.alert(
        'Error',
        'Failed to fetch children information. Please try again later.',
      );
      setChildrenInfo([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChildrenInfo();
  }, [userInfo.access_token]); // Add dependency to refresh when token changes

  const initializeVoice = async () => {
    try {
      await requestMicrophonePermission();
      Voice.onSpeechResults = onSpeechResults;
      Voice.onSpeechError = onSpeechError;
      Voice.onSpeechEnd = () => {
        if (isListening) {
          Voice.start('en-US');
        }
      };
    } catch (error) {
      console.error('Failed to initialize voice:', error);
    }
  };

  const cleanupVoice = () => {
    Voice.destroy().then(Voice.removeAllListeners);
  };

  const cleanupSound = () => {
    if (currentSound.current) {
      currentSound.current.stop();
      currentSound.current.release();
      currentSound.current = null;
    }
    setIsPlaying(false);
    setActiveAudioIndex(null);
  };

  const requestMicrophonePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message:
              'This app needs access to your microphone for voice recognition.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            'Permission Denied',
            'Voice recognition requires microphone access',
          );
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to request microphone permission');
        console.error(err);
      }
    }
  };

  const onSpeechResults = (e: any) => {
    if (e.value && e.value[0]) {
      const newResult = e.value[0];
      if (newResult !== lastResult.current) {
        lastResult.current = newResult;
        setSearchText(newResult);
      }
    }
  };

  const onSpeechError = (e: any) => {
    console.error('Speech recognition error:', e);
    if (isListening) {
      Voice.start('en-US').catch(error => {
        console.error('Failed to restart voice recognition:', error);
        setIsListening(false);
        Alert.alert(
          'Error',
          'Failed to restart voice recognition. Please try again.',
        );
      });
    }
  };

  const toggleListening = async () => {
    try {
      if (isListening) {
        await Voice.stop();
        setIsListening(false);
        if (searchText.trim()) {
          await getTips(searchText);
        }
        lastResult.current = '';
      } else {
        const isAvailable = await Voice.isAvailable();
        if (isAvailable) {
          setSearchText('');
          lastResult.current = '';
          await Voice.start('en-US');
          setIsListening(true);
        } else {
          Alert.alert(
            'Error',
            'Voice recognition is not available on this device.',
          );
        }
      }
    } catch (error) {
      console.error('Voice toggle error:', error);
      Alert.alert('Error', 'Failed to toggle voice recognition');
      setIsListening(false);
    }
  };

  useEffect(() => {
    initializeVoice();
    return () => {
      cleanupVoice();
      cleanupSound();
    };
  }, []);

  const speakTip = useCallback(async (audioUrl: string, index: number) => {
    cleanupSound();

    setIsPlaying(true);
    setActiveAudioIndex(index);

    const fullAudioUrl = `${API_BASE_URL}/audio${audioUrl}`;

    currentSound.current = new Sound(fullAudioUrl, '', error => {
      if (error) {
        console.error('Failed to load sound:', error);
        Alert.alert('Error', 'Failed to play audio. Please try again.');
        cleanupSound();
        return;
      }

      currentSound.current?.play(success => {
        if (!success) {
          Alert.alert('Error', 'Audio playback failed. Please try again.');
        }
        cleanupSound();
      });
    });
  }, []);

  const renderTipItem = (tip: Tip, index: number) => (
    <View key={index} style={styles.tipItem}>
      <LinearGradient
        colors={['#ffffff', '#f8f9fa']}
        style={styles.tipGradient}>
        <View style={styles.tipHeader}>
          <Icon
            name="lightbulb"
            size={24}
            color="#FFA726"
            style={styles.tipIcon}
          />
          <Text style={styles.tipTitle}>{tip.title}</Text>
        </View>
        <Text style={styles.tipBody}>{tip.body}</Text>
        <Text style={styles.tipDetails}>{tip.details}</Text>
        <View style={styles.buttonContainerGap}>
          <TouchableOpacity
            style={[
              styles.playButton,
              activeAudioIndex === index && isPlaying && styles.stopButton,
            ]}
            onPress={() => {
              if (activeAudioIndex === index && isPlaying) {
                cleanupSound();
              } else {
                speakTip(tip.audioUrl, index);
              }
            }}>
            <Icon
              name={
                activeAudioIndex === index && isPlaying ? 'stop' : 'play-arrow'
              }
              size={20}
              color="white"
            />
            <Text style={styles.buttonText}>
              {activeAudioIndex === index && isPlaying ? 'Stop' : 'Play Audio'}
            </Text>
          </TouchableOpacity>
          <RatingButtons tipId={tip.id} />
        </View>
      </LinearGradient>
    </View>
  );
  const navigateToDashboard = () => {
    // @ts-ignore
    navigation.navigate('Dashboard');
  };
  const getTips = async (query = searchText) => {
    if (!query.trim()) {
      Alert.alert(
        'Input Required',
        'Please enter a question or use voice input'
      );
      return;
    }
  
    // Attempt to detect a child's name in the query
    const detectedChild = detectChildNameInQuery(query, childrenInfo);
    
    // If we detected a child, automatically include their age
    if (detectedChild) {
      const age = calculateAge(detectedChild.date_of_birth);
      // Modify the query to include the age information
      query = `${query} for ${age} year old`;
    }
  
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/generate-tips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: query }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error === 'age_required') {
          setLastQuery(query);
          setShowAgePrompt(true);
          return;
        }
        throw new Error(`Server responded with ${response.status}`);
      }
  
      const data = await response.json();
      setTips(data.tips);
      setHasSearched(true);
    } catch (error) {
      console.error('Error fetching tips:', error);
      Alert.alert(
        'Error',
        'Failed to fetch tips. Please check your connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (searchText.trim()) {
      getTips(searchText);
    }
  };

  const handleAgeSubmit = (age: string) => {
    setShowAgePrompt(false);
    const queryWithAge = `${lastQuery} for ${age} year old`;
    setSearchText(queryWithAge);
    getTips(queryWithAge);
  };

  const AgePromptModal = () => (
    <Modal visible={showAgePrompt} transparent={true} animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select Child</Text>
          <Text style={styles.modalText}>
            Please select which child you're asking about:
          </Text>
          {childrenInfo.map(child => {
            const age = calculateAge(child.date_of_birth);
            return (
              <TouchableOpacity
                key={child.id}
                style={styles.ageButton}
                onPress={() => handleAgeSubmit(age.toString())}>
                <Text style={styles.ageButtonText}>
                  {child.nickname || `Child ${child.id}`} ({age} year
                  {age !== 1 ? 's' : ''} old)
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setShowAgePrompt(false)}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#f0f2f5', '#ffffff']} style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Parenting Assistant</Text>
          <Text style={styles.headerSubtitle}>Ask any parenting question</Text>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchWrapper}>
            <Icon
              name="search"
              size={20}
              color="#666"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder={
                isListening ? 'Listening...' : 'Ask a parenting question...'
              }
              returnKeyType="search"
              onSubmitEditing={() => getTips()}
              editable={!isListening}
              placeholderTextColor="#999"
            />
          </View>
          <TouchableOpacity
            style={[styles.micButton, isListening && styles.micButtonActive]}
            onPress={toggleListening}>
            <Icon
              name={isListening ? 'mic-off' : 'mic'}
              size={24}
              color="white"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.searchButton, styles.buttonFlex]}
            onPress={() => getTips()}
            disabled={isLoading || isListening}>
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Icon name="psychology" size={20} color="white" />
                <Text style={styles.buttonText}>Get Parenting Tips</Text>
              </>
            )}
          </TouchableOpacity>

          {hasSearched && (
            <TouchableOpacity
              style={[styles.retryButton, styles.buttonFlex]}
              onPress={handleRetry}
              disabled={isLoading || isListening}>
              <Icon name="refresh" size={20} color="white" />
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {tips.map((tip, index) => renderTipItem(tip, index))}
          <View style={{height: 90}} />
        </ScrollView>

        <View style={styles.bottomButtonContainer}>
  <TouchableOpacity
    style={styles.childInfoButton}
    onPress={() => setShowChildInfo(true)}>
    <Icon
      name="child-care"
      size={20}
      color="white"
      style={styles.buttonIcon}
    />
    <Text style={styles.childInfoButtonText}>Children Information</Text>
  </TouchableOpacity>
  
  <TouchableOpacity
    style={styles.settingsButton}
    onPress={navigateToSettings}>
    <Icon
      name="settings"
      size={20}
      color="white"
      style={styles.buttonIcon}
    />
    <Text style={styles.settingsButtonText}>Settings</Text>
  </TouchableOpacity>

  {/* Only show Dashboard button for admin users */}

</View>

        {userInfo.access_token ? (
          <ChildInfoModal
            visible={showChildInfo}
            onClose={() => setShowChildInfo(false)}
            children={childrenInfo}
            userToken={userInfo.access_token}
            onChildrenUpdate={fetchChildrenInfo}
          />
        ) : (
          showChildInfo && (
            <Modal
              visible={true}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowChildInfo(false)}>
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Not Logged In</Text>
                  <Text style={styles.modalText}>
                    Please log in to view and manage children information.
                  </Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setShowChildInfo(false)}>
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          )
        )}

        <Loader isLoading={isLoading} />
        <AgePromptModal />
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  headerContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'center',
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    height: 50,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    height: '100%',
  },
  micButton: {
    width: 50,
    height: 50,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginLeft: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  micButtonActive: {
    backgroundColor: '#FF3B30',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  buttonFlex: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  searchButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  retryButton: {
    backgroundColor: '#34C759',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  tipItem: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tipGradient: {
    padding: 20,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipIcon: {
    marginRight: 8,
  },
  tipTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
  },
  tipBody: {
    fontSize: 16,
    marginBottom: 12,
    color: '#333',
    lineHeight: 24,
  },
  tipDetails: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 16,
    color: '#666',
  },
  dashboardButton: {
    flex: 1,
    backgroundColor: '#8E44AD', // Purple color for dashboard
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  dashboardButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  audioButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  playButton: {
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stopButton: {
    backgroundColor: '#FF3B30',
  },
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  childInfoButton: {
    flex: 1,
    backgroundColor: '#5856D6',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  settingsButton: {
    flex: 1,
    backgroundColor: '#FF9500',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  settingsButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // childInfoButton: {
  //   backgroundColor: '#5856D6',
  //   padding: 16,
  //   borderRadius: 12,
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   shadowColor: '#000',
  //   shadowOffset: {width: 0, height: 2},
  //   shadowOpacity: 0.25,
  //   shadowRadius: 4,
  //   elevation: 5,
  // },
  childInfoButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  testButton: {
    backgroundColor: '#FF9500', // Orange color to distinguish it
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },

  childItem: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  childName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#1C1C1E',
  },
  childInfo: {
    fontSize: 14,
    color: '#636366',
  },
  childrenList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  noChildrenText: {
    fontSize: 16,
    color: '#636366',
    textAlign: 'center',
    marginVertical: 20,
  },
  closeButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  ageButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  ageButtonText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  cancelButton: {
    padding: 12,
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
    gap: 10,
  },
  ratingButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  ratingActive: {
    backgroundColor: '#e6f7ff',
  },
  ratingText: {
    marginLeft: 5,
    color: '#666',
  },
  ratingTextActive: {
    color: '#007AFF',
  },
  buttonContainerGap: {
    flexDirection: 'column',
    gap: 8,
  },
});

export default MainScreen;
