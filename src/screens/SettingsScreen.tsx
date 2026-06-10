import React, {useContext, useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Modal,
  Pressable,
  FlatList,
  SafeAreaView,
  Platform,
  TextInput,
  PermissionsAndroid,
} from 'react-native';
import {AuthContext, AuthContextType} from '../context/AuthContext';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {NavigationProp, useNavigation, useFocusEffect} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ChildInfoModal from './ChildInfoModal';
import {useChildrenInfo} from '../hooks/useChildrenInfo';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import PersonalizationSurvey from '../components/PersonalizationSurvey';
import {fetchWithAuth} from '../api/auth';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {LayoutDashboard} from 'lucide-react-native';
import LikedTipsModal from '../components/SettingsScreen/LikedTipsModal';
import {BASE_URL} from '../config';
import {useAudioRecording} from '../context/AudioRecordingContext';

const API_ENDPOINTS = {
  BASE_URL: BASE_URL,
};

interface SettingsScreenProps {
  navigation: NavigationProp<any>;
}

// Tip type for saved/liked tips
interface Tip {
  id: number;
  title: string;
  body: string;
  details: string;
  audioUrl: string | null;
  categories?: string[];
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({navigation}) => {
  const {userInfo, logout, deleteAccount, isAdmin} =
    useContext<any>(AuthContext);
  const {isRecording, startRecording, stopRecording, recordingDuration, formatDuration} = useAudioRecording();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showChildInfo, setShowChildInfo] = useState(false);
  const [selectedContentAreas, setSelectedContentAreas] = useState<string[]>(
    [],
  );
  // const [savedTips, setSavedTips] = useState<Tip[]>([]);
  const [likedTips, setLikedTips] = useState<Tip[]>([]);
  const [showSavedTipsModal, setShowSavedTipsModal] = useState(false);
  const [showLikedTipsModal, setShowLikedTipsModal] = useState(false);
  const [showMostLikedModal, setShowMostLikedModal] = useState(false);
  const [mostLikedTips, setMostLikedTips] = useState<Tip[]>([]);
  const [mostLikedLoading, setMostLikedLoading] = useState(false);
  const [activeAudioIndex, setActiveAudioIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoadingIndex, setAudioLoadingIndex] = useState<number | null>(
    null,
  );
  const [childDataShouldLoadFromCache, setChildDataShouldLoadFromCache] =
    useState<boolean>(true);
  const audioCache = React.useRef<Map<number, string>>(new Map());
  const currentSound = React.useRef<any>(null);
  const nav = useNavigation();

  // Personalization survey state
  const [showPersonalizationSurvey, setShowPersonalizationSurvey] =
    useState(false);
  const [surveyCompleted, setSurveyCompleted] = useState(false);
  const [surveyData, setSurveyData] = useState<any>(null);
  const [hasSurveyPersonalization, setHasSurveyPersonalization] =
    useState(false);

  // Report an Issue state
  const [showReportIssueModal, setShowReportIssueModal] = useState(false);
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitResult, setReportSubmitResult] = useState<'success' | 'error' | null>(null);

  // Use the enhanced children info hook
  const {
    children: childrenInfo,
    isLoading: childrenLoading,
    error: childrenError,
    isFromCache,
    loadFromCache: childrenLoadFromCache,
    fetchChildren,
    updateChildren,
    clearError,
    retryFetch,
    needsProfileCompletion,
  } = useChildrenInfo();

  const closeReportIssueModal = () => {
    setShowReportIssueModal(false);
    setReportDescription('');
    setReportSubmitResult(null);
  };

  const submitIssueReport = async () => {
    const trimmed = reportDescription.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please describe the issue before submitting.');
      return;
    }

    setReportSubmitting(true);
    setReportSubmitResult(null);

    try {
      let locationPerm = 'unknown';
      let notifPerm = 'unknown';
      if (Platform.OS === 'android') {
        const locGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        locationPerm = locGranted ? 'granted' : 'denied';
        if (Platform.Version >= 33) {
          const notifGranted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
          notifPerm = notifGranted ? 'granted' : 'denied';
        } else {
          notifPerm = 'n/a (pre-Android-13)';
        }
      }

      const deviceModel =
        Platform.OS === 'android'
          ? (Platform.constants as any)?.Model ?? 'Unknown Android'
          : 'iOS Device';

      const payload = {
        description: trimmed,
        device_model: deviceModel,
        os_name: Platform.OS,
        os_version: String(Platform.Version),
        app_version: '0.0.1',
        location_permission: locationPerm,
        notification_permission: notifPerm,
      };

      const response = await fetchWithAuth(`${BASE_URL}/api/issue-reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo?.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setReportSubmitResult('success');
        setReportDescription('');
      } else {
        setReportSubmitResult('error');
      }
    } catch {
      setReportSubmitResult('error');
    } finally {
      setReportSubmitting(false);
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: handleDeleteAccount,
        },
      ],
      {cancelable: true},
    );
  };

  const debugStorage = async () => {
    try {
      const generalSetting = await AsyncStorage.getItem(
        'generalRemindersEnabled',
      );
      const specificSetting = await AsyncStorage.getItem('specificReminders');

      console.log('General reminders enabled:', generalSetting);
      console.log('Specific reminders:', specificSetting);

      Alert.alert(
        'Stored Reminders',
        `General: ${generalSetting}\n\nSpecific: ${JSON.stringify(
          JSON.parse(specificSetting || '{}'),
          null,
          2,
        )}`,
        [{text: 'OK'}],
      );
    } catch (error) {
      console.error('Error reading storage:', error);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const success = await deleteAccount();
      if (success) {
        Alert.alert(
          'Account Deleted',
          'Your account has been successfully deleted.',
          [{text: 'OK'}],
        );
      }
    } catch (error) {
      console.error('Delete account handling error:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const loadContentPreferences = async () => {
    try {
      const preferences = await AsyncStorage.getItem('contentPreferences');
      if (preferences) {
        setSelectedContentAreas(JSON.parse(preferences));
      }
    } catch (error) {
      console.error('Error loading content preferences:', error);
    }
  };

  // Survey completion handler
  const handleSurveyComplete = async (completedSurveyData: any) => {
    try {
      const response = await fetchWithAuth(
        `${API_ENDPOINTS.BASE_URL}/api/personalization/survey`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userInfo.access_token}`,
          },
          body: JSON.stringify({
            surveyData: completedSurveyData,
            completedAt: new Date().toISOString(),
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save survey');
      }

      setSurveyData(completedSurveyData);
      setSurveyCompleted(true);
      setHasSurveyPersonalization(true);
      setShowPersonalizationSurvey(false);

      Alert.alert(
        'Thank you!',
        "Your preferences have been saved. You'll now receive more personalized parenting tips!",
        [{text: 'Great!'}],
      );
    } catch (error) {
      console.error('Survey completion error:', error);
      Alert.alert(
        'Error',
        'Failed to save your preferences. Please try again.',
      );
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadContentPreferences();
      // Check server for survey completion status so the badge persists across app launches
      if (userInfo?.access_token) {
        fetch(`${BASE_URL}/api/personalization/survey-status`, {
          headers: {Authorization: `Bearer ${userInfo.access_token}`},
        })
          .then(r => (r.ok ? r.json() : null))
          .then(json => {
            if (json?.hasCompletedSurvey) {
              setSurveyCompleted(true);
            }
          })
          .catch(() => {});
      }
    }, [userInfo?.access_token]),
  );

  // Handle children info button press with error handling
  const handleChildrenInfoPress = () => {
    clearError(); // Clear any previous errors
    setShowChildInfo(true);
  };

  // Enhanced children info modal close handler
  const handleChildInfoClose = () => {
    setShowChildInfo(false);
    clearError();
  };

  // Fixed: Create a wrapper function that matches the expected ChildInfoModal signature
  // const handleChildrenUpdateWrapper = () => {
  //   // This function will be called by ChildInfoModal after it updates children
  //   // The actual update logic is handled by the ChildInfoModal itself
  //   // We just need to refresh our data after the modal closes
  //   fetchChildren(true); // Force refresh after update
  // };

  // Render children info menu item with status indicators
  const renderChildrenInfoMenuItem = () => {
    const getStatusIcon = () => {
      if (childrenLoading) {return 'hourglass-empty';}
      if (childrenError && !isFromCache) {return 'error';}
      if (isFromCache) {return 'cached';}
      if (needsProfileCompletion) {return 'warning';}
      return 'child-care';
    };

    const getStatusColor = () => {
      if (childrenLoading) {return '#FF9500';}
      if (childrenError && !isFromCache) {return '#FF3B30';}
      if (isFromCache) {return '#FF9500';}
      if (needsProfileCompletion) {return '#FF9500';}
      return '#5856D6';
    };

    return (
      <TouchableOpacity
        style={styles.menuItem}
        onPress={handleChildrenInfoPress}
        disabled={childrenLoading}>
        <View style={styles.itemLeft}>
          <Icon
            name={getStatusIcon()}
            size={24}
            color={getStatusColor()}
            style={styles.menuIcon}
          />
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuText}>Children Information</Text>
            {childrenError && !isFromCache && (
              <Text style={styles.errorSubtext}>Tap to retry</Text>
            )}
            {isFromCache && <Text style={styles.cacheSubtext} />}
            {needsProfileCompletion && !childrenError && (
              <Text style={styles.warningSubtext}>Profile incomplete</Text>
            )}
            {childrenLoading && (
              <Text style={styles.loadingSubtext}>Loading...</Text>
            )}
          </View>
        </View>

        <View style={styles.menuRightContainer}>
          {childrenInfo.length > 0 && (
            <View style={styles.childrenCountBadge}>
              <Text style={styles.childrenCountText}>
                {childrenInfo.length}
              </Text>
            </View>
          )}
          {childrenLoading ? (
            <ActivityIndicator
              size="small"
              color="#5856D6"
              style={styles.menuLoader}
            />
          ) : (
            <Icon name="chevron-right" size={22} color="#1F2937" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Load saved/liked tips from AsyncStorage
  const loadTipsFromStorage = useCallback(async () => {
    try {
      // const savedTipsData = await AsyncStorage.getItem('savedTips');
      // if (savedTipsData) setSavedTips(JSON.parse(savedTipsData));
      const likedTipsData = await AsyncStorage.getItem('likedTips');
      if (likedTipsData) {setLikedTips(JSON.parse(likedTipsData));}
    } catch (error) {
      console.warn('Failed to load saved/liked tips:', error);
    }
  }, []);

  useEffect(() => {
    loadTipsFromStorage();
    const unsubscribe = navigation.addListener('focus', () => {
      loadTipsFromStorage();
    });
    return unsubscribe;
  }, [loadTipsFromStorage, navigation]);

  const fetchMostLikedTips = useCallback(async () => {
    setMostLikedLoading(true);
    try {
      const res = await fetchWithAuth(
        `${API_ENDPOINTS.BASE_URL}/api/tips/most-liked?limit=10`,
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setMostLikedTips(
          data.map((t: any) => ({
            id: t.id,
            title: t.title,
            body: t.description,
            details: '',
            audioUrl: null,
            categories: t.type ? [t.type] : [],
          })),
        );
      }
    } catch {}
    setMostLikedLoading(false);
  }, []);

  // Audio functions (copied from MainScreen)
  const loadAudio = async (tip: Tip, index: number) => {
    if (audioCache.current.has(tip.id)) {
      return audioCache.current.get(tip.id);
    }
    if (tip.audioUrl) {
      const fullAudioUrl = `http://https://enact.education.ufl.edu:4000/audio${tip.audioUrl}`;
      audioCache.current.set(tip.id, fullAudioUrl);
      return fullAudioUrl;
    }
    setAudioLoadingIndex(index);
    try {
      const response = await fetch(
        'http://https://enact.education.ufl.edu:4000/generate-tip-audio',
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            tipId: tip.id,
            title: tip.title,
            body: tip.body,
            details: tip.details,
          }),
        },
      );
      if (!response.ok) {throw new Error('Failed to generate audio');}
      const {audioUrl} = await response.json();
      const fullAudioUrl = `http://https://enact.education.ufl.edu:4000/audio${audioUrl}`;
      tip.audioUrl = audioUrl;
      audioCache.current.set(tip.id, fullAudioUrl);
      return fullAudioUrl;
    } catch (error) {
      Alert.alert('Error', 'Failed to generate audio. Please try again.');
      return null;
    } finally {
      setAudioLoadingIndex(null);
    }
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
  const speakTip = useCallback(async (tip: Tip, index: number) => {
    cleanupSound();
    setActiveAudioIndex(index);
    try {
      const audioUrl = await loadAudio(tip, index);
      if (!audioUrl) {return;}
      setIsPlaying(true);
      currentSound.current = new (require('react-native-sound'))(
        audioUrl,
        '',
        (error: any) => {
          if (error) {
            Alert.alert('Error', 'Failed to play audio. Please try again.');
            cleanupSound();
            return;
          }
          currentSound.current?.play((success: boolean) => {
            if (!success) {
              Alert.alert('Error', 'Audio playback failed. Please try again.');
            }
            cleanupSound();
          });
        },
      );
    } catch (error) {
      cleanupSound();
    }
  }, []);

  // Render a tip item (copied from MainScreen, only play button)
  const renderTipItem = (tip: Tip, index: number) => (
    <View key={index} style={{marginBottom: 16}}>
      <LinearGradient
        colors={['#ffffff', '#f8f9fa']}
        style={{borderRadius: 16, padding: 20}}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 12,
          }}>
          <Icon
            name="lightbulb"
            size={24}
            color="#FFA726"
            style={{marginRight: 12}}
          />
          <Text
            style={{fontSize: 18, fontWeight: 'bold', color: '#333', flex: 1}}>
            {tip.title || ''}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 16,
            color: '#444',
            lineHeight: 24,
            marginBottom: 12,
          }}>
          {tip.body || ''}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: '#666',
            lineHeight: 20,
            marginBottom: 16,
          }}>
          {tip.details || ''}
        </Text>
        <View style={{flexDirection: 'row', marginTop: 12}}>
          <TouchableOpacity
            style={{
              backgroundColor: '#007AFF',
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 6,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
            }}
            onPress={() => {
              if (activeAudioIndex === index && isPlaying) {
                cleanupSound();
              } else {
                speakTip(tip, index);
              }
            }}
            disabled={audioLoadingIndex === index}>
            {audioLoadingIndex === index ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Icon
                name={
                  activeAudioIndex === index && isPlaying
                    ? 'stop'
                    : 'play-arrow'
                }
                size={16}
                color="white"
              />
            )}
            <Text
              style={{
                color: 'white',
                fontSize: 12,
                fontWeight: '600',
                marginLeft: 4,
              }}>
              {audioLoadingIndex === index
                ? 'Loading...'
                : activeAudioIndex === index && isPlaying
                ? 'Stop'
                : 'Play'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );

  // // Saved Tips Modal
  // const SavedTipsModal = () => (
  //   <Modal visible={showSavedTipsModal} animationType="slide" presentationStyle="pageSheet">
  //     <SafeAreaView style={{ flex: 1, backgroundColor: '#f0f2f5' }}>
  //       <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E8E8E8' }}>
  //         <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>Saved Tips ({savedTips.length})</Text>
  //         <TouchableOpacity style={{ padding: 8 }} onPress={() => setShowSavedTipsModal(false)}>
  //           <Icon name="close" size={24} color="#666" />
  //         </TouchableOpacity>
  //       </View>
  //       <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
  //         {savedTips.length > 0 ? (
  //           savedTips.map((tip, index) => renderTipItem(tip, index))
  //         ) : (
  //           <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 }}>
  //             <Icon name="bookmark-border" size={64} color="#ccc" />
  //             <Text style={{ fontSize: 18, fontWeight: '600', color: '#999', marginTop: 16 }}>No Saved Tips</Text>
  //             <Text style={{ fontSize: 14, color: '#ccc', textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
  //               Save tips by tapping the bookmark icon on any tip
  //             </Text>
  //           </View>
  //         )}
  //         <View style={{ height: 20 }} />
  //       </ScrollView>
  //     </SafeAreaView>
  //   </Modal>
  // );

  // Liked Tips Modal
  // const LikedTipsModal = () => (
  //   <Modal
  //     visible={showLikedTipsModal}
  //     animationType="slide"
  //     presentationStyle="pageSheet">
  //     <SafeAreaView style={{flex: 1, backgroundColor: '#f0f2f5'}}>
  //       <View
  //         style={{
  //           flexDirection: 'row',
  //           justifyContent: 'space-between',
  //           alignItems: 'center',
  //           paddingHorizontal: 20,
  //           paddingVertical: 16,
  //           backgroundColor: 'white',
  //           borderBottomWidth: 1,
  //           borderBottomColor: '#E8E8E8',
  //         }}>
  //         <Text style={{fontSize: 20, fontWeight: 'bold', color: '#333'}}>
  //           Liked Tips ({likedTips.length})
  //         </Text>
  //         <TouchableOpacity
  //           style={{padding: 8}}
  //           onPress={() => setShowLikedTipsModal(false)}>
  //           <Icon name="close" size={24} color="#666" />
  //         </TouchableOpacity>
  //       </View>
  //       <ScrollView
  //         style={{flex: 1, paddingHorizontal: 16, paddingTop: 16}}
  //         showsVerticalScrollIndicator={false}>
  //         {likedTips.length > 0 ? (
  //           likedTips.map((tip, index) => renderTipItem(tip, index))
  //         ) : (
  //           <View
  //             style={{
  //               alignItems: 'center',
  //               paddingVertical: 40,
  //               paddingHorizontal: 20,
  //             }}>
  //             <Icon name="favorite-border" size={64} color="#ccc" />
  //             <Text
  //               style={{
  //                 fontSize: 18,
  //                 fontWeight: '600',
  //                 color: '#999',
  //                 marginTop: 16,
  //               }}>
  //               No Liked Tips
  //             </Text>
  //             <Text
  //               style={{
  //                 fontSize: 14,
  //                 color: '#ccc',
  //                 textAlign: 'center',
  //                 marginTop: 8,
  //                 lineHeight: 20,
  //               }}>
  //               Like tips by tapping the heart icon on any tip
  //             </Text>
  //           </View>
  //         )}
  //         <View style={{height: 20}} />
  //       </ScrollView>
  //     </SafeAreaView>
  //   </Modal>
  // );

  useEffect(() => {
    if (!userInfo || !userInfo.access_token) {
      // @ts-ignore: route name type may be restricted by navigation type
      nav.reset && nav.reset({index: 0, routes: [{name: 'Login' as any}]});
      // If using navigation prop directly, fallback:
      // navigation.reset({ index: 0, routes: [{ name: 'Login' as any }] });
    }
  }, [userInfo]);

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
        />

        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.placeholderView} />
        </View>

        <View style={styles.border} />

        {/* Content area with proper top margin */}
        <View style={[styles.contentArea]}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              {paddingBottom: insets.bottom + 30},
            ]}
            showsVerticalScrollIndicator={false}>
            {/* Admin Section - Only visible to admins */}
            {isAdmin && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Admin Settings</Text>

                <View style={styles.menuItem}>
                  <View style={styles.itemLeft}>
                    <Icon
                      name="verified-user"
                      size={22}
                      color="#4CAF50"
                      style={styles.menuIcon}
                    />
                    <Text style={styles.menuText}>Admin Status</Text>
                  </View>

                  <View style={styles.adminBadge}>
                    <Icon name="verified-user" size={14} color="#fff" />
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                </View>

                <Pressable
                  style={styles.menuItem}
                  onPress={() => navigation.navigate('Dashboard')}>
                  <View style={styles.itemLeft}>
                    <LayoutDashboard
                      size={22}
                      color="#6366F1"
                      style={styles.menuIcon}
                    />
                    <Text style={styles.menuText}>Admin Dashboard</Text>
                  </View>

                  <Icon name="chevron-right" size={20} color="#1F2937" />
                </Pressable>

                <Pressable
                  style={styles.dangerMenuItem}
                  onPress={() =>
                    Alert.alert(
                      'Feature Coming Soon',
                      'User management will be available in the next update.',
                    )
                  }>
                  <View style={styles.itemLeft}>
                    <Icon
                      name="people-outline"
                      size={22}
                      color="#6366F1"
                      style={styles.menuIcon}
                    />
                    <Text style={styles.menuText}>Manage Users</Text>
                  </View>

                  <Icon name="chevron-right" size={20} color="#1F2937" />
                </Pressable>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account</Text>

              <Pressable
                style={styles.menuItem}
                onPress={() => navigation.navigate('ChangePassword')}>
                <View style={styles.itemLeft}>
                  <Icon
                    name="lock-outline"
                    size={22}
                    color="#6366F1"
                    style={styles.menuIcon}
                  />
                  <Text style={styles.menuText}>Change Password</Text>
                </View>

                <Icon name="chevron-right" size={20} color="#1F2937" />
              </Pressable>

              {/* Enhanced Children Information Button */}
              {renderChildrenInfoMenuItem()}

              <Pressable
                style={styles.dangerMenuItem}
                onPress={confirmDeleteAccount}
                disabled={isDeleting}>
                <View style={styles.itemLeft}>
                  <Icon
                    name="delete-outline"
                    size={22}
                    color="#FF3B30"
                    style={styles.menuIcon}
                  />
                  <Text style={styles.dangerMenuText}>
                    {isDeleting ? 'Deleting Account...' : 'Delete Account'}
                  </Text>
                </View>

                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FF3B30" />
                ) : (
                  <Icon name="chevron-right" size={20} color="#FF3B30" />
                )}
              </Pressable>
            </View>

            {/* Session Recording - only visible if enabled on dashboard */}
            {Boolean(userInfo?.user?.recording) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Session Recording</Text>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={isRecording ? stopRecording : startRecording}>
                  <View style={styles.itemLeft}>
                    <Ionicons
                      name={isRecording ? 'mic' : 'mic-outline'}
                      size={22}
                      color={isRecording ? '#FF3B30' : '#6366F1'}
                      style={styles.menuIcon}
                    />
                    <View style={styles.menuTextContainer}>
                      <Text style={styles.menuText}>
                        {isRecording ? 'Recording...' : 'Start Session Recording'}
                      </Text>
                      {isRecording && (
                        <Text style={[styles.cacheSubtext, {color: '#FF3B30'}]}>
                          {formatDuration(recordingDuration)} — tap to stop
                        </Text>
                      )}
                    </View>
                  </View>
                  <Icon
                    name={isRecording ? 'stop-circle' : 'chevron-right'}
                    size={22}
                    color={isRecording ? '#FF3B30' : '#1F2937'}
                  />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>App</Text>

              <Pressable
                style={styles.menuItem}
                onPress={() => navigation.navigate('About')}>
                <View style={styles.itemLeft}>
                  <Icon
                    name="info-outline"
                    size={22}
                    color="#6366F1"
                    style={styles.menuIcon}
                  />
                  <Text style={styles.menuText}>About ENACT</Text>
                </View>

                <Icon name="chevron-right" size={20} color="#1F2937" />
              </Pressable>

              <Pressable
                style={styles.menuItem}
                onPress={() => navigation.navigate('ReminderSettings')}>
                <View style={styles.itemLeft}>
                  <Icon
                    name="notifications-none"
                    size={22}
                    color="#6366F1"
                    style={styles.menuIcon}
                  />
                  <Text style={styles.menuText}>Reminder Settings</Text>
                </View>

                <Icon name="chevron-right" size={20} color="#1F2937" />
              </Pressable>

              {/* Content Selection Button */}
              <Pressable
                style={styles.menuItem}
                onPress={() => navigation.navigate('ContentSelection')}>
                <View style={styles.itemLeft}>
                  <Ionicons
                    name="school-outline"
                    color="#6366F1"
                    size={22}
                    style={styles.menuIcon}
                  />
                  <Text style={styles.menuText}>Content Preferences</Text>
                </View>

                <View style={styles.contentPrefsContainer}>
                  {selectedContentAreas.length > 0 ? (
                    <View style={styles.contentBadge}>
                      <Text style={styles.contentBadgeText}>
                        {selectedContentAreas.length} selected
                      </Text>
                    </View>
                  ) : (
                    <Icon name="chevron-right" size={20} color="#1F2937" />
                  )}
                </View>
              </Pressable>

              <Pressable
                style={styles.menuItem}
                onPress={() => setShowReportIssueModal(true)}>
                <View style={styles.itemLeft}>
                  <Icon
                    name="bug-report"
                    size={22}
                    color="#6366F1"
                    style={styles.menuIcon}
                  />
                  <Text style={styles.menuText}>Report an Issue</Text>
                </View>
                <Icon name="chevron-right" size={20} color="#1F2937" />
              </Pressable>

              <Pressable style={styles.dangerMenuItem} onPress={() => logout()}>
                <View style={styles.itemLeft}>
                  <Icon
                    name="logout"
                    size={22}
                    color="#6366F1"
                    style={styles.menuIcon}
                  />
                  <Text style={styles.menuText}>Logout</Text>
                </View>

                <Icon name="chevron-right" size={20} color="#1F2937" />
              </Pressable>
            </View>

            {/* Tips Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tips</Text>
              {/* <TouchableOpacity style={styles.menuItem} onPress={() => setShowSavedTipsModal(true)}>
              <Icon name="bookmark" size={24} color="#4A90E2" style={styles.menuIcon} />
              <Text style={styles.menuText}>View Saved Tips</Text>
              <Icon name="chevron-right" size={20} color="#1F2937" />
            </TouchableOpacity> */}
              <Pressable
                style={styles.menuItem}
                onPress={() => setShowLikedTipsModal(true)}>
                <View style={styles.itemLeft}>
                  <Icon
                    name="favorite"
                    size={22}
                    color="#FF3B30"
                    style={styles.menuIcon}
                  />
                  <Text style={styles.menuText}>View Liked Tips</Text>
                </View>

                <Icon name="chevron-right" size={20} color="#1F2937" />
              </Pressable>

              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  fetchMostLikedTips();
                  setShowMostLikedModal(true);
                }}>
                <View style={styles.itemLeft}>
                  <Icon
                    name="trending-up"
                    size={22}
                    color="#F59E0B"
                    style={styles.menuIcon}
                  />
                  <Text style={styles.menuText}>Most Liked Tips</Text>
                </View>
                <Icon name="chevron-right" size={20} color="#1F2937" />
              </Pressable>

              <Pressable
                style={styles.dangerMenuItem}
                onPress={() => setShowPersonalizationSurvey(true)}>
                <View style={styles.itemLeft}>
                  <Icon
                    name="psychology"
                    size={22}
                    color="#6366F1"
                    style={styles.menuIcon}
                  />
                  <Text style={styles.menuText}>Personalization Survey</Text>
                  {surveyCompleted && (
                    <View style={styles.completedBadge}>
                      <Icon name="check-circle" size={16} color="#4CAF50" />
                    </View>
                  )}
                </View>

                <Icon name="chevron-right" size={20} color="#1F2937" />
              </Pressable>
            </View>


            {/* Error banner for children info */}
            {childrenError && !isFromCache && (
              <View style={styles.errorBanner}>
                <Icon
                  name="error"
                  size={20}
                  color="#FF3B30"
                  style={styles.errorIcon}
                />
                <Text style={styles.errorBannerText}>{childrenError}</Text>
                <TouchableOpacity
                  onPress={retryFetch}
                  style={styles.retryButton}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Developer diagnostics — only visible in debug builds */}
            {__DEV__ && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Developer</Text>
                <Pressable
                  style={styles.menuItem}
                  onPress={() => navigation.navigate('Diagnostics' as any)}>
                  <View style={styles.itemLeft}>
                    <Icon
                      name="bug-report"
                      size={22}
                      color="#dc2626"
                      style={styles.menuIcon}
                    />
                    <View style={styles.menuTextContainer}>
                      <Text style={styles.menuText}>Notification Diagnostics</Text>
                      <Text style={styles.cacheSubtext}>Pipeline debug screen</Text>
                    </View>
                  </View>
                  <Icon name="chevron-right" size={20} color="#1F2937" />
                </Pressable>
              </View>
            )}

            <View style={styles.versionContainer}>
              <Text style={styles.versionText}>ENACT v1.0</Text>
            </View>
          </ScrollView>
        </View>

        {userInfo?.access_token ? (
          <ChildInfoModal
            onChildrenUpdate={() => fetchChildren(true)}
            visible={showChildInfo}
            onClose={handleChildInfoClose}
            children={childrenInfo}
            // setChildDataShouldLoadFromCache={setChildDataShouldLoadFromCache}
            // childDataShouldLoadFromCache={childDataShouldLoadFromCache}
            userToken={userInfo.access_token}
          />
        ) : (
          showChildInfo && (
            <Modal
              visible={true}
              transparent={true}
              animationType="slide"
              onRequestClose={handleChildInfoClose}>
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Not Logged In</Text>
                  <Text style={styles.modalText}>
                    Please log in to view and manage children information.
                  </Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={handleChildInfoClose}>
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          )
        )}

        {/* <SavedTipsModal /> */}
        <LikedTipsModal
          likedTips={likedTips}
          setShowLikedTipsModal={setShowLikedTipsModal}
          showLikedTipsModal={showLikedTipsModal}
        />

        {/* Most Liked Tips Modal */}
        <Modal
          visible={showMostLikedModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowMostLikedModal(false)}>
          <SafeAreaView style={{flex: 1, backgroundColor: '#F9FAFB'}}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: '#E5E7EB',
                backgroundColor: '#fff',
              }}>
              <Text
                style={{fontSize: 18, fontWeight: '700', color: '#1F2937'}}>
                Most Liked Tips
              </Text>
              <TouchableOpacity onPress={() => setShowMostLikedModal(false)}>
                <Icon name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {mostLikedLoading ? (
              <ActivityIndicator
                style={{marginTop: 40}}
                size="large"
                color="#F59E0B"
              />
            ) : mostLikedTips.length === 0 ? (
              <View
                style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
                <Icon name="trending-up" size={48} color="#D1D5DB" />
                <Text
                  style={{
                    marginTop: 12,
                    fontSize: 16,
                    color: '#9CA3AF',
                    textAlign: 'center',
                  }}>
                  No liked tips yet.{'\n'}Start liking tips to see them here!
                </Text>
              </View>
            ) : (
              <FlatList
                data={mostLikedTips}
                keyExtractor={item => String(item.id)}
                contentContainerStyle={{padding: 16, gap: 12}}
                renderItem={({item, index}) => (
                  <View
                    style={{
                      backgroundColor: '#fff',
                      borderRadius: 14,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      shadowColor: '#000',
                      shadowOpacity: 0.04,
                      shadowRadius: 4,
                      shadowOffset: {width: 0, height: 2},
                      elevation: 1,
                    }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 8,
                        gap: 8,
                      }}>
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: '#FEF3C7',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: '#D97706',
                          }}>
                          {index + 1}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '600',
                          color: '#1F2937',
                          flex: 1,
                        }}
                        numberOfLines={2}>
                        {item.title}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 14,
                        color: '#4B5563',
                        lineHeight: 20,
                      }}>
                      {item.body}
                    </Text>
                    {item.categories && item.categories.length > 0 && (
                      <View
                        style={{
                          marginTop: 10,
                          alignSelf: 'flex-start',
                          backgroundColor: '#EEF2FF',
                          paddingHorizontal: 10,
                          paddingVertical: 3,
                          borderRadius: 20,
                        }}>
                        <Text
                          style={{fontSize: 12, color: '#6366F1', fontWeight: '500'}}>
                          {item.categories[0]}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              />
            )}
          </SafeAreaView>
        </Modal>

        {/* Personalization Survey Modal */}
        <PersonalizationSurvey
          visible={showPersonalizationSurvey}
          onClose={() => setShowPersonalizationSurvey(false)}
          onComplete={handleSurveyComplete}
        />

        {/* Report an Issue Modal */}
        <Modal
          visible={showReportIssueModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeReportIssueModal}>
          <SafeAreaView style={{flex: 1, backgroundColor: '#F9FAFB'}}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: '#E5E7EB',
                backgroundColor: '#fff',
              }}>
              <Text
                style={{fontSize: 18, fontWeight: '700', color: '#1F2937'}}>
                Report an Issue
              </Text>
              <TouchableOpacity onPress={closeReportIssueModal}>
                <Icon name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{flex: 1}}
              contentContainerStyle={{padding: 20}}
              keyboardShouldPersistTaps="handled">
              {reportSubmitResult === 'success' ? (
                <View
                  style={{alignItems: 'center', paddingVertical: 48}}>
                  <Icon name="check-circle" size={64} color="#10B981" />
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: '700',
                      color: '#1F2937',
                      marginTop: 16,
                      marginBottom: 8,
                    }}>
                    Report Submitted!
                  </Text>
                  <Text
                    style={{
                      fontSize: 15,
                      color: '#6B7280',
                      textAlign: 'center',
                      lineHeight: 22,
                    }}>
                    Thank you for letting us know. We will look into this as
                    soon as possible.
                  </Text>
                  <TouchableOpacity
                    onPress={closeReportIssueModal}
                    style={{
                      marginTop: 32,
                      backgroundColor: '#6366F1',
                      paddingHorizontal: 32,
                      paddingVertical: 12,
                      borderRadius: 10,
                    }}>
                    <Text
                      style={{
                        color: '#fff',
                        fontWeight: '600',
                        fontSize: 15,
                      }}>
                      Done
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text
                    style={{
                      fontSize: 14,
                      color: '#4B5563',
                      marginBottom: 8,
                      lineHeight: 20,
                    }}>
                    Describe the issue you experienced. We will also attach
                    basic device and permission information to help us
                    investigate.
                  </Text>

                  <TextInput
                    multiline
                    numberOfLines={6}
                    value={reportDescription}
                    onChangeText={setReportDescription}
                    placeholder="What went wrong? Include any steps that led to the issue."
                    placeholderTextColor="#9CA3AF"
                    style={{
                      backgroundColor: '#fff',
                      borderWidth: 1,
                      borderColor: '#D1D5DB',
                      borderRadius: 10,
                      padding: 14,
                      fontSize: 15,
                      color: '#1F2937',
                      minHeight: 140,
                      textAlignVertical: 'top',
                      marginBottom: 16,
                    }}
                    maxLength={2000}
                  />

                  <Text
                    style={{
                      fontSize: 12,
                      color: '#9CA3AF',
                      marginBottom: 24,
                      textAlign: 'right',
                    }}>
                    {reportDescription.length}/2000
                  </Text>

                  {reportSubmitResult === 'error' && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#FEF2F2',
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 16,
                        gap: 8,
                      }}>
                      <Icon name="error-outline" size={18} color="#EF4444" />
                      <Text style={{fontSize: 13, color: '#B91C1C', flex: 1}}>
                        Failed to submit. Please check your connection and try
                        again.
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={submitIssueReport}
                    disabled={reportSubmitting}
                    style={{
                      backgroundColor: reportSubmitting ? '#A5B4FC' : '#6366F1',
                      paddingVertical: 14,
                      borderRadius: 10,
                      alignItems: 'center',
                    }}>
                    {reportSubmitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text
                        style={{
                          color: '#fff',
                          fontWeight: '700',
                          fontSize: 15,
                        }}>
                        Submit Report
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  // Header wrapper gives shadow (not applied to LinearGradient to avoid warnings)
  headerShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    borderBottomLeftRadius: Platform.select({ios: 28, android: 24, default: 24}),
    borderBottomRightRadius: Platform.select({ios: 28, android: 24, default: 24}),
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 6,
  },

  gradientBackground: {
    borderBottomLeftRadius: Platform.select({ios: 28, android: 24, default: 24}),
    borderBottomRightRadius: Platform.select({ios: 28, android: 24, default: 24}),
    // justifyContent: 'flex-end',
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
    fontWeight: '700',
    color: '#FFFFFF',
  },

  placeholderView: {
    width: 40,
  },

  border: {
    borderBottomColor: 'rgba(255, 255, 255, 0.8)',
    borderBottomWidth: 1,
    marginVertical: Platform.select({ios: 12, android: 8, default: 8}),
  },

  contentArea: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
    paddingHorizontal: Platform.select({ios: 16, android: 14, default: 14}),
    paddingTop: Platform.select({ios: 16, android: 12, default: 12}),
  },

  scrollContent: {
    paddingBottom: Platform.select({ios: 30, android: 24, default: 24}),
  },

  contentPrefsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  section: {
    marginBottom: Platform.select({ios: 24, android: 14, default: 14}),
    backgroundColor: '#fff',
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    padding: Platform.select({ios: 16, android: 12, default: 12}),
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  contentBadge: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: Platform.select({ios: 10, android: 8, default: 8}),
    paddingVertical: Platform.select({ios: 4, android: 3, default: 3}),
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
  },

  contentBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  sectionTitle: {
    fontSize: Platform.select({ios: 18, android: 16, default: 16}),
    fontWeight: '600',
    color: '#333',
    marginBottom: Platform.select({ios: 16, android: 10, default: 10}),
  },

  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Platform.select({ios: 16, android: 12, default: 12}),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },

  dangerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.select({ios: 16, android: 12, default: 12}),
    borderBottomWidth: 0,
  },

  menuIcon: {
    marginRight: Platform.select({ios: 16, android: 12, default: 12}),
  },

  menuTextContainer: {
    // flex: 1,
  },

  menuText: {
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    color: '#1F2937',
  },

  menuRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  menuLoader: {
    marginLeft: 8,
  },

  errorSubtext: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 2,
  },

  cacheSubtext: {
    fontSize: 12,
    color: '#FF9500',
    marginTop: 2,
  },

  warningSubtext: {
    fontSize: 12,
    color: '#FF9500',
    marginTop: 2,
  },

  loadingSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },

  childrenCountBadge: {
    backgroundColor: '#5856D6',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },

  childrenCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  dangerMenuText: {
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    color: '#FF3B30',
    fontWeight: '500',
  },

  errorBanner: {
    backgroundColor: '#FFE6E6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },

  errorIcon: {
    marginRight: 8,
  },

  errorBannerText: {
    flex: 1,
    color: '#FF3B30',
    fontSize: 14,
  },

  retryButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },

  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  versionContainer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },

  versionText: {
    color: '#DBEAFE',
    fontSize: 14,
  },

  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },

  adminBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Platform.select({ios: 20, android: 16, default: 16}),
  },

  modalContent: {
    backgroundColor: 'white',
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    padding: Platform.select({ios: 20, android: 16, default: 16}),
    width: '90%',
    maxWidth: 400,
  },

  modalTitle: {
    fontSize: Platform.select({ios: 20, android: 18, default: 18}),
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },

  modalText: {
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    marginBottom: 16,
    textAlign: 'center',
  },

  closeButton: {
    backgroundColor: '#007AFF',
    padding: Platform.select({ios: 12, android: 10, default: 10}),
    borderRadius: Platform.select({ios: 8, android: 7, default: 7}),
  },

  closeButtonText: {
    color: 'white',
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    textAlign: 'center',
    fontWeight: '500',
  },

  completedBadge: {
    marginLeft: 8,
  },

  featuresCard: {
    marginBottom: Platform.select({ios: 24, android: 14, default: 14}),
    backgroundColor: '#fff',
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    padding: Platform.select({ios: 16, android: 12, default: 12}),
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featuresHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Platform.select({ios: 16, android: 10, default: 10}),
    gap: 8,
  },
  featuresTitle: {
    fontSize: Platform.select({ios: 18, android: 16, default: 16}),
    fontWeight: '600',
    color: '#333',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Platform.select({ios: 12, android: 10, default: 10}),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  featureIconWrap: {
    width: Platform.select({ios: 40, android: 36, default: 36}),
    height: Platform.select({ios: 40, android: 36, default: 36}),
    borderRadius: Platform.select({ios: 10, android: 9, default: 9}),
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTextWrap: {
    flex: 1,
  },
  featureName: {
    fontSize: Platform.select({ios: 15, android: 14, default: 14}),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 3,
  },
  featureDesc: {
    fontSize: Platform.select({ios: 13, android: 12, default: 12}),
    color: '#6B7280',
    lineHeight: 18,
  },
});

export default SettingsScreen;
