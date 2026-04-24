import React, {
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import {
  View,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  Alert,
  Text,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Modal,
  ActivityIndicator,
  Keyboard,
  Animated,
  Easing,
  InteractionManager,
  SafeAreaView,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import MapView, {Marker, Circle} from 'react-native-maps';
import {Dropdown} from 'react-native-element-dropdown';
import {useFocusEffect, useIsFocused} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Geolocation, {
  GeolocationResponse,
  GeolocationError,
} from '@react-native-community/geolocation';
import {
  GooglePlacesAutocomplete,
  GooglePlacesAutocompleteRef,
} from 'react-native-google-places-autocomplete';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Spinner from 'react-native-loading-spinner-overlay';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import NetInfo from '@react-native-community/netinfo';
import Voice from '@react-native-voice/voice';
import Sound from 'react-native-sound';
import EventSource from 'react-native-event-source';
import {AuthContext} from '../context/AuthContext';
import Notification from '../components/Notification';

import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {fetchWithAuth} from '../api/auth';
import PersonalizationSurvey from '../components/PersonalizationSurvey';
import TipsModal from '../components/MainScreen/TipsModal';
import {useCache} from '../hooks/useCache';
import {CopilotStep, useCopilot, walkthroughable} from 'react-native-copilot';
import PreferencesCard from '../components/MainScreen/PreferencesCard';
import {BASE_URL, WS_BASE_URL} from '../config';
import {OFFLINE_TIPS} from '../data/offlineTips';

const STARTUP_CONFIG = {
  MAX_STARTUP_TIME: 8000,
  CRITICAL_OPERATIONS_TIMEOUT: 5000,
  BACKGROUND_TIMEOUT: 30000,
  QUICK_LOCATION_TIMEOUT: 3000,
};

const LOCATION_CONFIG = {
  TIMEOUTS: {QUICK: 3000, NORMAL: 15000, BACKGROUND: 30000},
  DELTAS: {LATITUDE: 0.015, LONGITUDE: 0.0121},
  CACHE_KEYS: {
    LAST_LOCATION: 'lastKnownLocation',
    CHILDREN_INFO: 'childrenInfoCache',
    USER_LOCATIONS: 'userLocationsCache',
  },
};

const API_ENDPOINTS = {
  BASE_URL: BASE_URL,
  WS_BASE_URL: WS_BASE_URL,
  ASSISTANT_BASE_URL: 'http://68.183.102.75:4000',
  LOCATIONS: '/endpoint/locations',
  ADD_LOCATION: '/endpoint/addLocation',
  SEND_LOCATION: '/endpoint',
  CHILDREN: '/endpoint/children',
  UPDATE_CHILDREN: '/endpoint/updateChildren',
};

const DEFAULT_LOCATION = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: LOCATION_CONFIG.DELTAS.LATITUDE,
  longitudeDelta: LOCATION_CONFIG.DELTAS.LONGITUDE,
};

interface Tip {
  id: number | string;
  title: string;
  body: string;
  details: string;
  audioUrl: string | null;
  categories?: string[];
  similarity_score?: number;
  query_relevance?: number;
  personal_match?: number;
  isGenerated?: boolean;
}

interface Child {
  id?: number;
  nickname: string;
  date_of_birth: string;
  age?: number;
}

interface Location {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface Props {
  navigation: NativeStackNavigationProp<any>;
}

const MapViewModal = React.memo(function MapViewModal({
  visible,
  onClose,
  locations,
  details,
  initialRegion,
  token,
  onRefresh,
}: {
  visible: boolean;
  onClose: () => void;
  locations: Location[];
  details: Array<{title: string; description: string; pinColor: string}>;
  initialRegion: Location | null;
  token: string;
  onRefresh: () => Promise<void>;
}) {
  const insets = useSafeAreaInsets();

  const placesRef = useRef<GooglePlacesAutocompleteRef>(null);

  // Local-only state (isolated from parent re-renders)
  const [newLocation, setNewLocation] = useState<Location | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const reset = useCallback(() => {
    setNewLocation(null);
    setName('');
    setDescription('');
    setSelectedOption(null);
    placesRef.current?.clear?.();
  }, []);

  const addLocation = useCallback(async () => {
    if (
      !newLocation ||
      !name.trim() ||
      !description.trim() ||
      !selectedOption
    ) {
      Alert.alert(
        'Missing Information',
        'Please enter a name, description and select a location type.',
      );
      return;
    }
    if (name.trim().toLowerCase() === 'home') {
      Alert.alert(
        'Home Location Not Recommended',
        "Just a reminder: to ensure your privacy, please don't save your home address as a location to receive tips.\n\nIf you're adding a friend's or relative's home, feel free to proceed.",
        [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Proceed Anyway', onPress: () => saveLocation()},
        ],
      );
      return;
    }
    await saveLocation();
  }, [
    newLocation,
    name,
    description,
    selectedOption,
    token,
    onRefresh,
    reset,
    onClose,
  ]);

  const saveLocation = useCallback(async () => {
    if (!newLocation) return;
    try {
      const res = await fetchWithAuth(
        `${API_ENDPOINTS.BASE_URL}${API_ENDPOINTS.ADD_LOCATION}`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            latitude: newLocation.latitude,
            longitude: newLocation.longitude,
            name: name.trim(),
            description: description.trim(),
            type: selectedOption,
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const isDuplicate = body.error?.toLowerCase().includes('already exists');
        Alert.alert(
          isDuplicate ? 'Duplicate Location' : 'Error',
          body.error || 'Failed to add location. Please try again.',
        );
        return;
      }

      await onRefresh();
      Alert.alert('Success', 'Location added successfully!');
      reset();
      onClose();
    } catch (e) {
      console.error('addLocation error:', e);
      Alert.alert('Error', 'Failed to add location. Please try again.');
    }
  }, [
    newLocation,
    name,
    description,
    selectedOption,
    token,
    onRefresh,
    reset,
    onClose,
  ]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
        }}>
        {/* Map */}
        {initialRegion && (
          <MapView
            provider="google"
            style={styles.fullMap}
            initialRegion={initialRegion}
            region={newLocation || initialRegion}
            showsUserLocation
            mapType="standard"
            onPress={e => {
              const {latitude, longitude} = e.nativeEvent.coordinate;
              setNewLocation({
                latitude,
                longitude,
                latitudeDelta: LOCATION_CONFIG.DELTAS.LATITUDE,
                longitudeDelta: LOCATION_CONFIG.DELTAS.LONGITUDE,
              });
            }}>
            {newLocation && (
              <Marker
                coordinate={newLocation}
                title="New Location"
                pinColor="#4A90E2"
              />
            )}
            {locations.map((loc, i) => (
              <React.Fragment key={`loc-${i}`}>
                <Marker
                  coordinate={loc}
                  title={details[i]?.title || `Location ${i + 1}`}
                  description={details[i]?.description || ''}
                  pinColor="#FF4B4B"
                />
                <Circle
                  center={loc}
                  radius={100}
                  strokeColor="rgba(255,75,75,0.5)"
                  fillColor="rgba(255,75,75,0.1)"
                />
              </React.Fragment>
            ))}
          </MapView>
        )}

        {/* Bottom add form */}
        {newLocation && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{...StyleSheet.absoluteFillObject, marginBottom: 20}}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={{flex: 1}}>
                <LinearGradient
                  colors={['#EFF6FF', '#FFFFFF', '#F5F3FF']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}
                  style={[styles.addLocationForm, {bottom: insets.bottom}]}>
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{flexGrow: 1}}
                    showsVerticalScrollIndicator={false}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                      }}>
                      <TouchableOpacity
                        onPress={() => {
                          Keyboard.dismiss();
                          reset();
                        }}>
                        <MaterialIcons
                          name="arrow-back"
                          size={20}
                          color="#1F2937"
                        />
                      </TouchableOpacity>
                      <Text style={styles.formTitle}>Add New Location</Text>
                      <View style={{width: 24}} />
                    </View>

                    <Dropdown
                      style={styles.dropdown}
                      placeholderStyle={styles.dropdownPlaceholder}
                      selectedTextStyle={styles.dropdownSelected}
                      itemTextStyle={{color: '#1F2937'}}
                      data={[
                        {label: 'Park / outside', value: 'Park / outside'},
                        {label: 'School / daycare', value: 'School / daycare'},
                        {
                          label: "Friend / relative's home",
                          value: "Friend / relative's home",
                        },
                        {label: 'Museum', value: 'Museum'},
                        {
                          label: 'Athletic event / stadium',
                          value: 'Athletic event / stadium',
                        },
                        {label: 'Restaurant', value: 'Restaurant'},
                        {label: 'Library', value: 'Library'},
                        {
                          label: 'Grocery / big box store',
                          value: 'Grocery / big box store',
                        },
                        {
                          label: 'Office building (e.g., medical or therapy office)',
                          value: 'Office building',
                        },
                        {
                          label: 'In a vehicle (e.g., car, bus)',
                          value: 'In a vehicle',
                        },
                        {
                          label: 'Faith-based organization',
                          value: 'Faith-based organization',
                        },
                      ]}
                      maxHeight={300}
                      labelField="label"
                      valueField="value"
                      placeholder="Select location type"
                      value={selectedOption}
                      onChange={item => setSelectedOption(item.value)}
                    />

                    <TextInput
                      placeholder="Location name"
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                      placeholderTextColor="#999"
                      returnKeyType="next"
                      blurOnSubmit={false}
                    />
                    <TextInput
                      placeholder="Description"
                      style={[styles.input, styles.textArea]}
                      value={description}
                      onChangeText={setDescription}
                      placeholderTextColor="#999"
                      multiline
                      numberOfLines={3}
                      returnKeyType="done"
                      blurOnSubmit={true}
                      onSubmitEditing={() => Keyboard.dismiss()}
                    />

                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => {
                        Keyboard.dismiss();
                        addLocation();
                      }}>
                      <Text style={styles.addButtonText}>Add Location</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </LinearGradient>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        )}

        {!newLocation && (
          <View
            pointerEvents="box-none"
            style={[
              styles.searchOverlay,
              Platform.OS === 'ios' && {paddingTop: insets.top + 8},
            ]}>
            <LinearGradient
              colors={['#EFF6FF', '#FFFFFF', '#F5F3FF']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.mapModalContainer}>
              {/* Header */}
              <View style={styles.mapHeader}>
                <TouchableOpacity
                  onPress={() => {
                    reset();
                    onClose();
                  }}>
                  <MaterialIcons name="arrow-back" size={20} color="#1F2937" />
                </TouchableOpacity>
                <Text style={styles.mapHeaderTitle}>Find Nearby Locations</Text>
                <View style={{width: 24}} />
              </View>

              {/* Search */}
              <View style={styles.searchBarWrapper}>
                <GooglePlacesAutocomplete
                  placeholder="Search by name or address"
                  fetchDetails
                  minLength={2}
                  debounce={200}
                  keyboardShouldPersistTaps="handled"
                  enablePoweredByContainer={false}
                  onFail={e => console.log('Places error:', e)}
                  onPress={(data, details = null) => {
                    if (details) {
                      const latitude = details.geometry.location.lat;
                      const longitude = details.geometry.location.lng;
                      setNewLocation({
                        latitude,
                        longitude,
                        latitudeDelta: LOCATION_CONFIG.DELTAS.LATITUDE,
                        longitudeDelta: LOCATION_CONFIG.DELTAS.LONGITUDE,
                      });
                    }
                  }}
                  query={{
                    key: 'AIzaSyBczo2yBRbSwa4IVQagZKNfTje0JJ_HEps',
                    language: 'en',
                  }}
                  ref={placesRef}
                  textInputProps={{
                    placeholderTextColor: '#1F2937', // placeholder color
                  }}
                  styles={{
                    container: {flex: 0, zIndex: 10002, elevation: 10000},

                    // Your input
                    textInput: {
                      ...styles.searchInput,
                      // color: 'red',
                    },

                    // 🔴 Make suggestion text visible
                    description: {
                      // pick one:
                      color: '#1F2937', // matches your theme
                      fontSize: 16,
                    },

                    listView: {
                      // position: 'absolute',
                      // top: 52,
                      // left: 0,
                      // right: 0,
                      backgroundColor: 'white',
                      borderRadius: 12,
                      overflow: 'hidden',
                      zIndex: 10002,
                      elevation: 10002,
                      shadowColor: '#000',
                      shadowOffset: {width: 0, height: 2},
                      shadowOpacity: 0.15,
                      shadowRadius: 6,
                    },
                    row: {
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      backgroundColor: 'white',
                    },
                    separator: {height: 1.5, backgroundColor: '#F3F4F6'},
                  }}
                />
              </View>
            </LinearGradient>
          </View>
        )}
      </View>
    </Modal>
  );
});

// ---- helpers
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REMIND_EVERY_DAYS = 2;

const surveyKeys = (userKey: string) => ({
  completed: `survey_completed:${userKey}`,
  lastPrompt: `survey_last_prompt:${userKey}`,
});

const isDue = (lastPromptTs?: number | null, days = REMIND_EVERY_DAYS) => {
  if (!lastPromptTs) return true; // never prompted → show
  return Date.now() - Number(lastPromptTs) >= days * MS_PER_DAY;
};

// ===== Age-based child resolution helpers =====
type AgeParseResult = {
  months: number; // age in months
  granularity: 'years' | 'months';
};

const MONTHS_PER_YEAR = 12;

function ageInMonthsFromDob(dobIso: string, at: Date = new Date()): number {
  const dob = new Date(dobIso);
  let months =
    (at.getFullYear() - dob.getFullYear()) * MONTHS_PER_YEAR +
    (at.getMonth() - dob.getMonth());
  if (at.getDate() < dob.getDate()) months -= 1;
  return Math.max(0, months);
}

// Parse "1 year old", "1y", "18 months", "1y 6m", "1 and 6 months", "1-yr-old", etc.
function parseAgeMention(queryRaw: string): AgeParseResult | null {
  const q = queryRaw.toLowerCase();

  const yearsAndMonths = q.match(
    /\b(\d+)\s*(?:years?|yrs?|y\/?o?)\s*(?:and|&|\+)\s*(\d+)\s*(?:months?|mos?|m\/?o?)\b/,
  );
  if (yearsAndMonths) {
    const y = Number(yearsAndMonths[1]);
    const m = Number(yearsAndMonths[2]);
    return {months: y * MONTHS_PER_YEAR + m, granularity: 'months'};
  }

  const ySpaceM = q.match(
    /\b(\d+)\s*(?:y|yrs?|years?)\s+(\d+)\s*(?:m|mos?|months?)\b/,
  );
  if (ySpaceM) {
    const y = Number(ySpaceM[1]);
    const m = Number(ySpaceM[2]);
    return {months: y * MONTHS_PER_YEAR + m, granularity: 'months'};
  }

  const monthsOnly = q.match(/\b(\d+)\s*(?:months?|mos?|m\/?o?)\b/);
  if (monthsOnly) {
    const m = Number(monthsOnly[1]);
    return {months: m, granularity: 'months'};
  }

  // "1yo", "1 yo", "1 yr old", "1-year-old"
  const yearsOnly = q.match(
    /\b(\d+)\s*(?:years?|yrs?|y\/?o?|yo)\b|\b(\d+)\s*-\s*year\s*-\s*old\b|\b(\d+)\s*year\s*old\b/,
  );
  if (yearsOnly) {
    const y = Number(yearsOnly[1] || yearsOnly[2] || yearsOnly[3]);
    return {months: y * MONTHS_PER_YEAR, granularity: 'years'};
  }

  return null;
}

function matchChildrenByAge(
  expressedAgeMonths: number,
  children: {nickname: string; date_of_birth: string}[],
  granularity: 'years' | 'months',
): {exact: Child[]; close: Child[]} {
  // Tighter if user gave months; looser if they gave only years
  const tolerance = granularity === 'months' ? 2 : 6; // months
  const exactCutoff = Math.max(0, Math.floor(tolerance / 2));

  const exact: Child[] = [];
  const close: Child[] = [];

  for (const c of children) {
    const childAgeMonths = ageInMonthsFromDob(c.date_of_birth);
    const diff = Math.abs(childAgeMonths - expressedAgeMonths);
    if (diff <= exactCutoff) exact.push(c as Child);
    else if (diff <= tolerance) close.push(c as Child);
  }
  return {exact, close};
}

function monthsToPretty(m: number): string {
  const y = Math.floor(m / 12);
  const mm = m % 12;
  if (y > 0 && mm > 0) return `${y}y ${mm}m`;
  if (y > 0) return `${y}y`;
  return `${mm}m`;
}

const MainScreen: React.FC<Props> = ({navigation}) => {
  const insets = useSafeAreaInsets();

  // Context & refs
  const {userInfo, isLoading} = useContext<any>(AuthContext);
  const lastResult = useRef<string>('');
  const accumulatedText = useRef<string>('');
  const currentSound = useRef<Sound | null>(null);

  // UI
  const [mainLoading, setMainLoading] = useState(true);
  const [backgroundLoading, setBackgroundLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string>('Starting app...');
  const [showMapView, setShowMapView] = useState(false);
  const [showTipsModal, setShowTipsModal] = useState(false);

  // Data
  const [userChildren, setUserChildren] = useState<Child[]>([]);
  const [location, setLocation] = useState<Location | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [details, setDetails] = useState<
    Array<{title: string; description: string; pinColor: string}>
  >([]);
  const [newLocation, setNewLocation] = useState<Location | null>(null);

  // ── NEW: local WS state ────────────────────────────────
  const wsRef = useRef<WebSocket | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // States
  const [locationStatus, setLocationStatus] = useState<
    'loading' | 'success' | 'error' | 'disabled'
  >('loading');
  const [apiStatus, setApiStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );

  // Companion
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [tips, setTips] = useState<Tip[]>([]);
  const tipLookupRef = useRef<Map<string | number, Tip>>(new Map());

  // Disambiguation state
  const [showChildDisambiguationModal, setShowChildDisambiguationModal] =
    useState(false);
  const [childDisambigReason, setChildDisambigReason] = useState<
    'multiple' | 'none' | 'name'
  >('none');
  const [childCandidates, setChildCandidates] = useState<Child[]>([]);
  const [expressedAgeMonths, setExpressedAgeMonths] = useState<number | null>(
    null,
  );

  // When user selects a child in the modal, we'll stash it here to resume the flow
  const selectedChildRef = useRef<Child | null>(null);

  // Preferences
  const [contentPreferences, setContentPreferences] = useState<string[]>([
    'Language Development',
  ]);
  const [likedTips, setLikedTips] = useState<Tip[]>([]);
  const [dislikedTips, setDislikedTips] = useState<Tip[]>([]);

  const [userPreferenceProfile, setUserPreferenceProfile] = useState<any>(null);
  // --- state ---
  const [agePromptVisible, setAgePromptVisible] = useState(false);
  const [ageYearsInput, setAgeYearsInput] = useState<string>('');
  const [ageMonthsInput, setAgeMonthsInput] = useState<string>('');
  const [pendingUnknownName, setPendingUnknownName] = useState<string | null>(
    null,
  );
  const [tempChildContext, setTempChildContext] = useState<
    Array<{name: string; agePretty: string; ageYears: number}>
  >([]);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const [showSurvey, setShowSurvey] = useState(false);
  const [surveyCompleted, setSurveyCompleted] = useState(false);
  const [bootChecked, setBootChecked] = useState(false); // ensure we decide once per mount
  const [tourRunning, setTourRunning] = useState(false);
  const [showHelperTip, setShowHelperTip] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const {loadFromCache, saveToCache} = useCache();

  const userKey =
    userInfo?.user?.id?.toString?.() ||
    userInfo?.id?.toString?.() ||
    userInfo?.email ||
    'anon';

  const KEYS = surveyKeys(userKey);

  // Per-user walkthrough key so tour runs once after login
  const HAS_SEEN_WALKTHROUGH_KEY = `@hasSeenWalkthrough:${userKey}`;

  const loadStatus = useCallback(async () => {
    // Don't show survey until the walkthrough is done — prevents both appearing at once
    const hasSeenWalkthrough = await AsyncStorage.getItem(HAS_SEEN_WALKTHROUGH_KEY);
    if (!hasSeenWalkthrough) {
      setBootChecked(true);
      return;
    }

    // 1) server completion check
    let completed = false;
    try {
      const res = await fetchWithAuth(
        `${API_ENDPOINTS.BASE_URL}/api/personalization/survey-status`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userInfo?.access_token}`,
          },
        },
      );
      if (res.ok) {
        const json = await res.json();
        completed = !!json?.hasCompletedSurvey;
      }
    } catch (_) {
      // ignore network errors; fall back to local flags
    }

    // 2) fallback to local flag
    if (!completed) {
      const localCompleted = await AsyncStorage.getItem(KEYS.completed);
      completed = localCompleted === 'true';
    }

    setSurveyCompleted(completed);

    if (completed) {
      setShowSurvey(false);
      setBootChecked(true);
      return;
    }

    // Show survey once
    setShowSurvey(true);
    setBootChecked(true);
  }, [userInfo?.access_token, KEYS.completed, HAS_SEEN_WALKTHROUGH_KEY]);

  // First mount → decide whether to show
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Optional: re-evaluate when screen regains focus (prevents accidental double prompts)
  useFocusEffect(
    useCallback(() => {
      if (!bootChecked) return;
      // re-check on focus only if not completed & we're not already showing it
      if (!surveyCompleted && !showSurvey) {
        loadStatus();
      }
    }, [bootChecked, surveyCompleted, showSurvey, loadStatus]),
  );
  const WalkthroughableView = walkthroughable(View);

  const {start, copilotEvents} = useCopilot();
  const startedRef = useRef(false); // true once we call start() for this session
  const isFocused = useIsFocused();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const runCopilot = async () => {
      console.log(await AsyncStorage.getAllKeys());
      const hasSeenWalkthrough = await AsyncStorage.getItem(
        HAS_SEEN_WALKTHROUGH_KEY,
      );
      console.log('hasSeenWalkthrough', hasSeenWalkthrough);
      if (isFocused && ready && !startedRef.current && !hasSeenWalkthrough) {
        startedRef.current = true;
        InteractionManager.runAfterInteractions(() => start());
      }
    };

    runCopilot();
  }, [isFocused, ready, start]);

  useEffect(() => {
    const handleStart = () => {
      setTourRunning(true);
    };

    const handleStop = async () => {
      setTourRunning(false);
      await AsyncStorage.setItem(HAS_SEEN_WALKTHROUGH_KEY, 'true');
      loadStatus();
    };

    copilotEvents.on('start', handleStart);
    copilotEvents.on('stop', handleStop);

    return () => {
      copilotEvents.off('start', handleStart);
      copilotEvents.off('stop', handleStop);
    };
  }, [copilotEvents, HAS_SEEN_WALKTHROUGH_KEY, loadStatus]);

  // Handlers coming from the survey
  const handleSurveyComplete = async (data: any) => {
    try {
      await fetchWithAuth(`${API_ENDPOINTS.BASE_URL}/api/personalization/survey`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo?.access_token}`,
        },
        body: JSON.stringify({surveyData: data}),
      });
    } catch (e) {
      console.error('[Survey] Failed to save survey to server:', e);
    }
    await AsyncStorage.setItem(KEYS.completed, 'true');
    setSurveyCompleted(true);
    setShowSurvey(false);
  };

  const handleSurveySkip = async () => {
    await AsyncStorage.setItem(KEYS.completed, 'true');
    setSurveyCompleted(true);
    setShowSurvey(false);
  };

  // --- Animation Setup ---
  // 1. Use a ref to hold the animated value. 0 = blurred, 1 = focused.
  const animation = useRef(new Animated.Value(0)).current;

  // 2. Functions to handle focus and blur events
  const handleFocus = () => {
    Animated.timing(animation, {
      toValue: 1,
      duration: 350, // Animation duration in ms
      easing: Easing.out(Easing.ease), // Smooth easing out
      useNativeDriver: true, // For better performance
    }).start();
  };

  const handleBlur = () => {
    Animated.timing(animation, {
      toValue: 0,
      duration: 350,
      easing: Easing.in(Easing.ease), // Smooth easing in
      useNativeDriver: true,
    }).start();
  };

  // 3. Interpolate the animated value to create dynamic styles
  const preferencesCardStyle = {
    opacity: animation.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
    }),
    transform: [
      {
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 100], // Move up by 60 pixels
        }),
      },
    ],
  };

  const askCompanionCardStyle = {
    transform: [
      {
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -280],
        }),
      },
    ],
  };
  // --- End of Animation Setup ---

  // Keyboard animation
  const keyboardAnimation = useRef(new Animated.Value(0)).current;

  const keyboardAnimatedStyle = {
    transform: [
      {
        translateY: keyboardAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -350], // Move companion card up by 350px when keyboard appears
        }),
      },
    ],
  };

  // Style for content preferences to fade out when keyboard appears
  const preferencesKeyboardStyle = {
    opacity: keyboardAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0], // Fade out
    }),
    transform: [
      {
        scaleY: keyboardAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.3], // Shrink to 30% height
        }),
      },
    ],
  };

  // Keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        Animated.timing(keyboardAnimation, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();
      },
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        Animated.timing(keyboardAnimation, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      },
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  function buildAgeFromInputs(yy: string, mm: string) {
    const y = Math.max(0, parseInt(yy || '0', 10) || 0);
    const m = Math.max(0, Math.min(11, parseInt(mm || '0', 10) || 0));
    const pretty = y > 0 && m > 0 ? `${y}y ${m}m` : y > 0 ? `${y}y` : `${m}m`;
    const yearsFloat = y + m / 12;
    return {pretty, yearsFloat};
  }

  async function getLatestData() {
    const data = await AsyncStorage.getItem('childrenInfoCache');
    if (data) {
      try {
        const parsed: Child[] = JSON.parse(data);
        console.log('Loaded children from cache in MainScreen:', JSON.stringify(parsed, null, 2));
        setUserChildren(parsed);
      } catch (e) {
        console.error('Failed to parse childrenInfoCache', e);
      }
    }
  }

  // Reload content preferences on focus
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const saved = await AsyncStorage.getItem('contentPreferences');
          if (alive && saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) setContentPreferences(parsed);
          }
        } catch (e) {
          console.warn('reload contentPreferences failed:', e);
        }
      })();

      setSearchText('');
      getLatestData();
      return () => {
        alive = false;
      };
    }, []),
  );

  // Location quick fetch
  const getQuickLocation = useCallback(async (): Promise<Location> => {
    console.log('Getting quick location...');
    const cached = await loadFromCache(
      LOCATION_CONFIG.CACHE_KEYS.LAST_LOCATION,
    );
    if (cached?.latitude && cached?.longitude) {
      console.log('Using cached location');
      setLocationStatus('success');
      return cached;
    }

    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        console.log('Quick location timeout, using default');
        setLocationStatus('error');
        resolve(DEFAULT_LOCATION);
      }, STARTUP_CONFIG.QUICK_LOCATION_TIMEOUT);

      Geolocation.getCurrentPosition(
        (pos: GeolocationResponse) => {
          clearTimeout(timeout);
          const loc = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            latitudeDelta: LOCATION_CONFIG.DELTAS.LATITUDE,
            longitudeDelta: LOCATION_CONFIG.DELTAS.LONGITUDE,
          };
          setLocationStatus('success');
          saveToCache(LOCATION_CONFIG.CACHE_KEYS.LAST_LOCATION, loc);
          resolve(loc);
        },
        (err: GeolocationError) => {
          clearTimeout(timeout);
          console.warn('Quick location error:', err.message);
          setLocationStatus('error');
          resolve(DEFAULT_LOCATION);
        },
        {
          enableHighAccuracy: false,
          timeout: STARTUP_CONFIG.QUICK_LOCATION_TIMEOUT - 500,
          maximumAge: 60000,
        },
      );
    });
  }, [loadFromCache, saveToCache]);

  // Background refresh
  const refreshDataInBackground = useCallback(async () => {
    if (!userInfo?.access_token) {
      console.log('No auth token; skip background calls');
      setApiStatus('error');
      return;
    }

    try {
      // Locations
      const locationsResponse = await fetchWithAuth(
        `${API_ENDPOINTS.BASE_URL}${API_ENDPOINTS.LOCATIONS}`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userInfo.access_token}`,
          },
        },
      );

      if (locationsResponse.ok) {
        const data = await locationsResponse.json();
        if (Array.isArray(data.locations) && Array.isArray(data.details)) {
          setLocations(data.locations);
          setDetails(data.details);
          await saveToCache(LOCATION_CONFIG.CACHE_KEYS.USER_LOCATIONS, {
            locations: data.locations,
            details: data.details,
          });
        }
      }

      // Children
      const childrenResponse = await fetchWithAuth(
        `${API_ENDPOINTS.BASE_URL}${API_ENDPOINTS.CHILDREN}`,
        {
          headers: {Authorization: `Bearer ${userInfo.access_token}`},
        },
      );

      if (childrenResponse.ok) {
        const data = await childrenResponse.json();
        if (data.children) {
          console.log('Children data from backend:', JSON.stringify(data.children, null, 2));
          setUserChildren(data.children);
          await saveToCache(
            LOCATION_CONFIG.CACHE_KEYS.CHILDREN_INFO,
            data.children,
          );
        }
      }

      // Preference profile
      const profileResponse = await fetchWithAuth(
        `${API_ENDPOINTS.BASE_URL}/api/personalization/profile`,
        {
          headers: {Authorization: `Bearer ${userInfo.access_token}`},
        },
      );
      if (profileResponse.ok) {
        const data = await profileResponse.json();
        setUserPreferenceProfile(data.profile);
      }

      setApiStatus('success');
    } catch (e) {
      console.error('Background refresh failed:', e);
      setApiStatus('error');
    } finally {
      setBackgroundLoading(false);
    }
  }, [userInfo, saveToCache]);

  // Refresh locations whenever the screen comes into focus (e.g. after returning from LocationList)
  useFocusEffect(
    useCallback(() => {
      refreshDataInBackground();
    }, [refreshDataInBackground]),
  );

  // Startup sequence
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Cached first
        const cachedLocs = await loadFromCache(
          LOCATION_CONFIG.CACHE_KEYS.USER_LOCATIONS,
        );
        if (cachedLocs) {
          setLocations(cachedLocs.locations || []);
          setDetails(cachedLocs.details || []);
        }
        const cachedKids = await loadFromCache(
          LOCATION_CONFIG.CACHE_KEYS.CHILDREN_INFO,
        );
        if (cachedKids) setUserChildren(cachedKids);
        const liked = await loadFromCache('likedTips');
        if (Array.isArray(liked)) setLikedTips(liked);
        const disliked = await loadFromCache('dislikedTips');
        if (Array.isArray(disliked)) setDislikedTips(disliked);
        const savedPrefs = await AsyncStorage.getItem('contentPreferences');
        if (savedPrefs) {
          const parsed = JSON.parse(savedPrefs);
          if (Array.isArray(parsed) && parsed.length)
            setContentPreferences(parsed);
        }

        // Quick location
        setStatusMessage('Getting your location...');
        const quickLoc = await getQuickLocation();
        if (mounted) setLocation(quickLoc);

        // Show UI
        setStatusMessage('Loading interface...');
        await new Promise(r => setTimeout(r, 100));
        if (mounted) setMainLoading(false);

        // Background refresh
        refreshDataInBackground();
      } catch (e) {
        console.error('startup error', e);
        if (mounted) {
          setLocation(DEFAULT_LOCATION);
          setMainLoading(false);
          setBackgroundLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
      Voice.destroy().then(Voice.removeAllListeners);
      if (currentSound.current) {
        currentSound.current.stop();
        currentSound.current.release();
        currentSound.current = null;
      }
    };
  }, [getQuickLocation, loadFromCache, refreshDataInBackground]);

  // Keep ref in sync so closures always see the latest value
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Voice — registered once; uses ref to avoid stale closures on Android
  useEffect(() => {
    const initVoice = async () => {
      try {
        if (Platform.OS === 'android') {
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
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
        }

        Voice.onSpeechResults = (e: any) => {
          if (e.value?.[0]) {
            const res = e.value[0];
            if (res !== lastResult.current) {
              lastResult.current = res;
              const prefix = accumulatedText.current;
              setSearchText(prefix ? `${prefix} ${res}` : res);
            }
          }
        };
        Voice.onSpeechError = () => {
          isListeningRef.current = false;
          setIsListening(false);
        };
        Voice.onSpeechEnd = async () => {
          if (isListeningRef.current) {
            if (lastResult.current) {
              accumulatedText.current = accumulatedText.current
                ? `${accumulatedText.current} ${lastResult.current}`
                : lastResult.current;
              lastResult.current = '';
            }
            await new Promise(resolve => setTimeout(resolve, 400));
            try {
              await Voice.start('en-US');
            } catch (e) {
              console.error('voice restart error', e);
              isListeningRef.current = false;
              setIsListening(false);
            }
          }
        };
      } catch (e) {
        console.error('voice init error', e);
      }
    };
    initVoice();
  }, []);

  // Queue & network sync for reactions
  const flushAIReactionsQueue = useCallback(async () => {
    const queue = (await loadFromCache('aiReactionsQueue')) ?? [];
    if (!queue.length || !userInfo?.access_token) return;
    const remaining = [];
    for (const item of queue) {
      try {
        await fetchWithAuth(
          `${API_ENDPOINTS.BASE_URL}/api/personalization/interactions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${userInfo.access_token}`,
            },
            body: JSON.stringify({
              tipId: item.tipId || `generated_${item.key}`, // fallback
              interactionType: item.reaction,
              tipPayload: item.tipPayload,
            }),
          },
        );
      } catch {
        remaining.push(item); // keep for next time
      }
    }
    await saveToCache('aiReactionsQueue', remaining);
  }, [userInfo, loadFromCache, saveToCache]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => {
      if (s.isConnected) flushAIReactionsQueue();
    });
    flushAIReactionsQueue();
    return () => unsub();
  }, [flushAIReactionsQueue]);

  // helper to close socket
  const closeWS = () => {
    try {
      wsRef.current?.close();
    } catch {}
    wsRef.current = null;
    setIsStreaming(false);
  };

  // cancel an in-flight tips request from anywhere
  const cancelTips = () => {
    closeWS();
    setIsAssistantLoading(false);
    setShowTipsModal(false);
    setTips([]);
  };

  useEffect(() => {
    return () => closeWS(); // unmount cleanup
  }, []);

  useEffect(() => {
    if (!showTipsModal) {
      // always close WS on modal dismiss — safe even when not streaming
      closeWS();
      setIsAssistantLoading(false);
      setSearchText('');
    }
  }, [showTipsModal]);

  // Network connectivity listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const enqueueAIReaction = useCallback(
    async (
      tipId: string | number,
      interactionType: 'like' | 'dislike' | 'save' | 'unsave',
    ) => {
      // Pull full tip for generated items so the backend can upsert+embed
      const tip = tipLookupRef.current.get(tipId);
      const item: any = {
        tipId,
        interactionType,
      };
      if (
        tip?.isGenerated ||
        (typeof tipId === 'string' && String(tipId).startsWith('generated_'))
      ) {
        item.title = tip?.title;
        item.body = tip?.body;
        item.details = tip?.details;
        item.categories = tip?.categories;
      }
      const queue = (await loadFromCache('aiReactionsQueue')) ?? [];
      queue.push(item);
      await saveToCache('aiReactionsQueue', queue);
      // Try to flush immediately if online
      flushAIReactionsQueue();
    },
    [flushAIReactionsQueue, loadFromCache, saveToCache],
  );

  // Helpers
  const calculateAge = (dob: string) => {
    const today = new Date();
    const birth = new Date(dob);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const toggleListening = async () => {
    try {
      if (isListening) {
        await Voice.stop();
        isListeningRef.current = false;
        setIsListening(false);
        lastResult.current = '';
        accumulatedText.current = '';
      } else {
        const ok = await Voice.isAvailable();
        if (!ok)
          return Alert.alert(
            'Error',
            'Voice recognition is not available on this device.',
          );
        setSearchText('');
        lastResult.current = '';
        accumulatedText.current = '';
        await Voice.start('en-US');
        isListeningRef.current = true;
        setIsListening(true);
      }
    } catch (e) {
      console.error('toggle mic error', e);
      setIsListening(false);
    }
  };

  // ===== STRICT DOMAIN VALIDATION (matches backend) =====
  const ALLOWED_DOMAINS = {
    'Language Development': [
      'talk',
      'speak',
      'language',
      'vocabulary',
      'word',
      'communicate',
      'conversation',
      'speech',
      'verbal',
      'storytelling',
      'listening',
      'pronunciation',
      'bilingual',
      'reading aloud',
      'narration',
      'questions',
      'describing',
      'rhyme',
      'song',
      'singing',
      'building vocabulary',
      'word learning',
      'language skills',
      'communication skills',
      'speaking skills',
      'verbal skills',
    ],
    'Early Science Skills': [
      'science',
      'experiment',
      'explore',
      'discover',
      'observe',
      'investigate',
      'nature',
      'plants',
      'animals',
      'weather',
      'seasons',
      'biology',
      'physics',
      'chemistry',
      'stem',
      'curiosity',
      'wonder',
      'hypothesis',
      'predict',
      'measure',
      'compare',
      'classify',
      'scientific',
    ],
    'Literacy Foundations': [
      'read',
      'reading',
      'book',
      'letter',
      'alphabet',
      'phonics',
      'literacy',
      'writing',
      'story',
      'print',
      'text',
      'comprehension',
      'author',
      'illustration',
      'library',
      'spell',
      'recognize',
      'sight word',
      'pre-reading',
      'emergent literacy',
      'print awareness',
    ],
    'Social-Emotional Learning': [
      'emotion',
      'feeling',
      'empathy',
      'social',
      'friend',
      'share',
      'turn-taking',
      'cooperation',
      'kindness',
      'self-regulation',
      'calm',
      'upset',
      'angry',
      'sad',
      'happy',
      'scared',
      'frustrated',
      'conflict',
      'resolution',
      'relationship',
      'self-awareness',
      'self-control',
      'coping',
      'mindfulness',
      'patience',
      'understanding',
      'compassion',
      'jealous',
      'proud',
    ],
  };

  // Topics explicitly OUT of scope
  const OUT_OF_SCOPE_PATTERNS = [
    // Behavioral/discipline
    /\b(discipline|punishment|consequence|timeout|reward|chart|behavior modification)\b/i,
    /\b(tantrum|meltdown|defiance|backtalk|hitting|biting|kicking)\b/i,

    // Sleep
    /\b(sleep|bedtime|nap|nighttime|wake|insomnia)\b/i,

    // Eating/nutrition
    /\b(eating|food|meal|nutrition|picky eater|snack|diet|feeding)\b/i,

    // Potty training
    /\b(potty|toilet|diaper|bathroom|pee|poop|training)\b/i,

    // Screen time
    /\b(screen time|tablet|ipad|tv|television|video game|youtube)\b/i,

    // Homework/school
    /\b(homework|grade|test|quiz|school meeting|teacher conference)\b/i,

    // Travel
    /\b(travel|vacation|flight|hotel|car seat|stroller)\b/i,

    // Medical
    /\b(diagnos|symptom|treatment|medicine|medication|doctor|illness|disease|injury|medical)\b/i,
    /\b(fever|rash|cough|cold|flu|allergy|asthma|adhd|autism|delay)\b/i,

    // Legal/financial
    /\b(custody|divorce|lawyer|legal|court|financial|money|budget|cost)\b/i,

    // Adult topics
    /\b(sex|dating|relationship with partner|marriage counseling)\b/i,
  ];

  const REJECTION_MESSAGE = `We only provide tips in these 4 areas:

- Language Development - vocabulary, communication, storytelling
- Early Science Skills - exploration, nature, curiosity
- Literacy Foundations - reading, books, letters, phonics
- Social-Emotional Learning - feelings, empathy, friendships

Try asking about one of these topics!`;

  const EXAMPLE_QUERIES = [
    'Reading activities for my 4-year-old',
    'Science experiments we can do at home',
    'How to help my child express emotions',
    'Language development games for toddlers',
    'Building vocabulary through storytelling',
    'Nature exploration activities for kids',
  ];
  function isStrictlyInScope(query: string): {
    valid: boolean;
    message?: string;
    domain?: string;
  } {
    const q = query.toLowerCase();

    // 1. Check for explicitly out-of-scope topics (HARD REJECT)
    for (const pattern of OUT_OF_SCOPE_PATTERNS) {
      if (pattern.test(query)) {
        return {
          valid: false,
          message: REJECTION_MESSAGE,
        };
      }
    }

    // 2. Let backend handle domain matching - just pass through if not obviously bad
    return {valid: true};
  }

  function showDomainRejectionAlert(message: string) {
    setShowTipsModal(false); // close modal first
    Alert.alert('Topic Not Supported', message, [
      {
        text: 'See Examples',
        onPress: () => {
          Alert.alert(
            'Try asking about:',
            EXAMPLE_QUERIES.map(q => `• ${q}`).join('\n'),
            [{text: 'OK'}],
          );
        },
      },
      {text: 'OK', style: 'cancel'},
    ]);
  }

  // Words that strongly indicate the user is asking about a child/parenting topic
  const CHILD_TERMS = [
    'child',
    'kid',
    'toddler',
    'baby',
    'infant',
    'newborn',
    'teen',
    'teenager',
    'preteen',
    'son',
    'daughter',
    'my boy',
    'my girl',
    'my kid',
    'my child',
    'my toddler',
    'my baby',
    'students',
    'kids',
    'children',
    'parent',
    'parenting',
    'daycare',
    'preschool',
    'school',
  ];

  // Age patterns like "3yo", "3 yo", "3-year-old", "18 months old"
  const AGE_PATTERNS: RegExp[] = [
    /\b\d{1,2}\s?(yo|yrs?|years?)\b/i,
    /\b\d{1,2}\s?(-|\s)?year[-\s]?old\b/i,
    /\b\d{1,2}\s?(months?|mos?)\s?old\b/i,
  ];

  const normalize = (s: string) => s.toLowerCase().trim();

  // simple levenshtein for fuzzy name match (handles typos/nicknames)
  function levenshtein(a: string, b: string) {
    a = normalize(a);
    b = normalize(b);
    const m = Array.from({length: a.length + 1}, (_, i) => [
      i,
      ...Array(b.length).fill(0),
    ]);
    for (let j = 1; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        m[i][j] = Math.min(
          m[i - 1][j] + 1,
          m[i][j - 1] + 1,
          m[i - 1][j - 1] + cost,
        );
      }
    }
    return m[a.length][b.length];
  }

  const similar = (a: string, b: string, maxDist = 1) =>
    levenshtein(a, b) <= maxDist;

  // Age in years & months for nicer prompts
  const ageYMMM = (dob: string | undefined) => {
    if (!dob) return 'Unknown age';

    const birth = new Date(dob);
    // Check if date is invalid
    if (isNaN(birth.getTime())) return 'Unknown age';

    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    let days = now.getDate() - birth.getDate();
    if (days < 0) {
      months -= 1;
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    // e.g., "3y 2m", "11m", "4y"
    if (years <= 0 && months > 0) return `${months}m`;
    if (years >= 0 && months > 0) return `${years}y ${months}m`;
    return `${years}y`;
  };

  // Extract child mentions by exact or fuzzy name match
  function resolveChildrenFromQuery(query: string, children: Child[]) {
    const q = normalize(query);
    const words = new Set(q.split(/[^a-zA-Z0-9]+/).filter(Boolean)); // tokens
    const hits: Array<{child: Child; how: 'exact' | 'fuzzy'}> = [];

    for (const c of children) {
      const name = normalize(c.nickname || '');
      if (!name) continue;
      // exact word hit (handles "Aarav", "Aarav's")
      const exact =
        words.has(name) || q.includes(`${name}'s`) || q.includes(`my ${name}`);
      if (exact) {
        hits.push({child: c, how: 'exact'});
        continue;
      }

      // fuzzy within small distance for short names
      const tokens = Array.from(words);
      if (tokens.some(w => similar(w, name, name.length <= 5 ? 1 : 2))) {
        hits.push({child: c, how: 'fuzzy'});
      }
    }

    // Deduplicate (prefer exact over fuzzy)
    const uniq: Record<string, {child: Child; how: 'exact' | 'fuzzy'}> = {};
    for (const h of hits) {
      const key = normalize(h.child.nickname || '');
      if (!uniq[key] || (uniq[key].how === 'fuzzy' && h.how === 'exact'))
        uniq[key] = h;
    }
    return Object.values(uniq).map(x => x.child);
  }
  // If you store aliases later: Child & { aliases?: string[] }
  function tokenize(str: string) {
    return (str || '').toLowerCase().match(/[a-z0-9']+/g) || [];
  }

  function extractCandidateNames(query: string) {
    // crude: words that start uppercase in original text OR possessives (X's), plus tokens after "my"
    // since we're lowercasing elsewhere, just return all tokens & handle in fuzzy logic
    return Array.from(new Set(tokenize(query)));
  }

  function resolveChildrenAndUnknownNames(query: string, children: Child[]) {
    const tokens = extractCandidateNames(query);
    const known: Child[] = [];
    const unknown: string[] = [];

    // exact/fuzzy compare each token to each saved child nickname
    for (const t of tokens) {
      let matched: Child | null = null;
      for (const c of children) {
        const name = (c.nickname || '').toLowerCase();
        if (!name) continue;
        if (t === name) {
          matched = c;
          break;
        }
        // tiny fuzzy room
        const dist = levenshtein(t, name);
        if (dist <= (name.length <= 5 ? 1 : 2)) {
          matched = c;
          break;
        }
      }
      if (matched) {
        if (
          !known.find(
            k =>
              (k.nickname || '').toLowerCase() ===
              (matched!.nickname || '').toLowerCase(),
          )
        ) {
          known.push(matched);
        }
      } else {
        // Keep token if it looks like a name-ish token (3–20 chars, letters only)
        if (/^[a-z]{3,20}$/.test(t)) unknown.push(t);
      }
    }

    // De-dupe unknowns, and remove anything that equals "my", "kid", etc.
    const STOP = new Set([
      'my',
      'kid',
      'child',
      'daughter',
      'son',
      'the',
      'a',
      'an',
      'baby',
      'toddler',
      'teen',
      'years',
      'year',
      'old',
    ]);
    const uniqUnknown = Array.from(new Set(unknown.filter(n => !STOP.has(n))));

    return {known, unknown: uniqUnknown};
  }

  const getPersonalizedTips = async () => {
    console.log('getPersonalizedTips called, current isAssistantLoading:', isAssistantLoading);

    const query = searchText?.trim();
    if (!query) {
      return Alert.alert(
        'Input Required',
        'Please enter what you need help with',
      );
    }

    // Minimum query length validation
    if (query.length < 3) {
      return Alert.alert(
        'We only provide parenting tips',
        'Please ask a complete question about parenting (e.g., "tips for reading", "help with bedtime").',
      );
    }

    // Check if query is just random characters (no actual words)
    const words = query.split(/\s+/).filter(w => w.length > 0);
    const hasValidWords = words.some(word => word.length >= 3);

    if (!hasValidWords) {
      return Alert.alert(
        'We only provide parenting tips',
        'Please ask a complete question about parenting (e.g., "tips for reading", "help with bedtime").',
      );
    }

    // STRICT DOMAIN VALIDATION - only allow our 4 domains
    const validation = isStrictlyInScope(query);

    if (!validation.valid) {
      showDomainRejectionAlert(validation.message || REJECTION_MESSAGE);
      return;
    }

    console.log(
      `✅ Query approved for domain: ${validation.domain || 'unknown'}`,
    );

    // Check network connectivity - show offline tips if no connection
    if (!isOnline) {
      setTips(OFFLINE_TIPS);
      setShowTipsModal(true);
      Alert.alert(
        'Offline Mode',
        'You are currently offline. Here are some popular parenting tips to help you out!',
        [{text: 'OK'}],
      );
      return;
    }

    let mentioned = resolveChildrenFromQuery(query, userChildren);

    // Single child — always use them, no need to ask
    if (mentioned.length === 0 && userChildren.length === 1) {
      mentioned = userChildren;
    }

    if (mentioned.length === 0) {
      const ageMention = parseAgeMention(query);
      if (ageMention) {
        const {months, granularity} = ageMention;
        const {exact, close} = matchChildrenByAge(
          months,
          userChildren,
          granularity,
        );

        // Age is already stated in the query — never interrupt with a modal.
        // If exactly one saved child matches, use them for richer context;
        // otherwise the age in the query text already gives the AI what it needs.
        if (exact.length === 1) {
          mentioned = exact;
        } else if (close.length === 1) {
          mentioned = close;
        }
        // multiple matches or no match → proceed with age in query as context
      } else {
        const {known, unknown} = resolveChildrenAndUnknownNames(
          query,
          userChildren,
        );
        if (known.length === 0 && unknown.length > 0) {
          setChildDisambigReason('name');
          setChildCandidates(userChildren);
          setExpressedAgeMonths(null);
          setShowChildDisambiguationModal(true);
          setIsAssistantLoading(false);
          return;
        }
      }
    }

    const childLines = (mentioned.length ? mentioned : userChildren).map(c => {
      const nm = c.nickname || 'Child';
      if (c.age) return `${nm}: ${c.age} year${c.age === 1 ? '' : 's'} old`;
      const ageStr = ageYMMM(c.date_of_birth);
      return ageStr === 'Unknown age' ? nm : `${nm}: ${ageStr} old`;
    });

    const childContext = childLines.join(', ');
    const childrenContext = (mentioned.length ? mentioned : userChildren).map(
      c => ({
        name: c.nickname,
        dob: c.date_of_birth,
        agePretty: c.age ? `${c.age}y` : ageYMMM(c.date_of_birth),
        ageYears: c.age ?? calculateAge(c.date_of_birth),
      }),
    );

    // Build a structured prompt with labeled fields
    const promptLines = [query];
    if (childContext) {
      promptLines.push(`Child: ${childContext}`);
    }
    const prompt = promptLines.join('\n');

    console.log('Setting isAssistantLoading=true before starting WebSocket');
    setIsAssistantLoading(true);
    setTips([]);
    setStreamError(null);

    // ── NEW: open the WS and stream tips ─────────────────────────────────
    try {
      // IMPORTANT: token in handshake query
      let openedAt: number | null = null;
      const wsUrl = `${
        API_ENDPOINTS.WS_BASE_URL
      }/ws/personalization?token=${encodeURIComponent(userInfo.access_token)}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setIsStreaming(true);

      // open modal early so user sees tips appear
      setShowTipsModal(true);

      ws.onopen = () => {
        openedAt = Date.now();
        console.log('[RN] WS OPEN');
        // First message must be {type:'start', ...}
        ws.send(
          JSON.stringify({
            type: 'start',
            prompt,
            contentPreferences,
            generateMode: 'hybrid', // same behavior as REST
          }),
        );
      };

      ws.onmessage = evt => {
        const messageTime = Date.now();
        let msg: any;
        try {
          msg = JSON.parse(String(evt.data));
        } catch {
          return;
        }

        // optional: console.log('WS', msg);

        switch (msg.type) {
          case 'start':
            // could show a "personalizing…" banner if you want
            break;

          case 'phase':
            // phases like 'openai:starting', 'openai:streaming'
            break;

          case 'out_of_scope':
            // mirror your REST rejection UX
            closeWS();
            setIsAssistantLoading(false);
            Alert.alert(
              'Topic Not Supported',
              msg.payload?.message || REJECTION_MESSAGE,
              [
                {
                  text: 'See Examples',
                  onPress: () =>
                    Alert.alert(
                      'Try asking about:',
                      EXAMPLE_QUERIES.map(q => `• ${q}`).join('\n'),
                      [{text: 'OK'}],
                    ),
                },
                {
                  text: 'OK',
                  style: 'cancel',
                  onPress: () => setShowTipsModal(false),
                },
              ],
            );
            break;

          case 'tip': {
            console.log('messageTime,', messageTime - openedAt!);
            // one tip at a time (scored) → append
            const t: Tip = msg.data;
            setTips(prev => {
              const next = [...prev, t];
              tipLookupRef.current = new Map(next.map((x: Tip) => [x.id, x]));
              return next;
            });
            break;
          }

          case 'batch': {
            // DB fallback returned an array
            const items: Tip[] = msg.items || [];
            setTips(prev => {
              const next = [...prev, ...items];
              tipLookupRef.current = new Map(next.map((x: Tip) => [x.id, x]));
              return next;
            });
            break;
          }

          case 'error':
            setStreamError(msg.message || 'Stream error');
            break;

          case 'done':
            console.log('Received done message, closing WS and setting loading=false');
            closeWS();
            setIsAssistantLoading(false);
            // Check if no tips were received using a ref to avoid closure issues
            setTimeout(() => {
              // Use the current state value instead of the stale closure value
              setTips(currentTips => {
                if (currentTips.length === 0) {
                  Alert.alert(
                    'No Tips Found',
                    'Try asking about reading, science exploration, social skills, or language activities.',
                    [
                      {
                        text: 'See Examples',
                        onPress: () =>
                          Alert.alert(
                            'Try asking about:',
                            EXAMPLE_QUERIES.map(q => `• ${q}`).join('\n'),
                            [{text: 'OK'}],
                          ),
                      },
                      {text: 'OK', style: 'cancel'},
                    ],
                  );
                  setShowTipsModal(false); // optional
                }
                return currentTips; // Return unchanged state
              });
            }, 0);
            break;

          // 'ping' etc. are ignored
          default:
            break;
        }
      };

      ws.onerror = () => {
        setStreamError('Connection error');
      };

      ws.onclose = e => {
        if (openedAt) {
          const lifetime = Date.now() - openedAt;
          console.log(`[RN] WS CLOSED after ${lifetime} ms`, {
            code: e.code,
            reason: e.reason,
            wasClean: e.wasClean,
          });
        } else {
          console.log('[RN] WS CLOSED (openedAt unknown)', {
            code: e.code,
            reason: e.reason,
          });
        }
        console.log('Setting isStreaming=false and isAssistantLoading=false in onclose');
        setIsStreaming(false);
        setIsAssistantLoading(false);
      };
    } catch (e) {
      console.error('ws error', e);
      setIsAssistantLoading(false);
      setIsStreaming(false);
      setShowTipsModal(false);
      Alert.alert('Error', 'Failed to start the stream. Please try again.');
    }

    // setIsAssistantLoading(true);
    // setTips([]);

    // try {
    //   // Resolve children for context
    //   let mentioned = resolveChildrenFromQuery(query, userChildren);

    //   // Age-based resolution if no names found
    //   if (mentioned.length === 0) {
    //     const ageMention = parseAgeMention(query);
    //     if (ageMention) {
    //       const {months, granularity} = ageMention;
    //       const {exact, close} = matchChildrenByAge(
    //         months,
    //         userChildren,
    //         granularity,
    //       );

    //       if (exact.length === 1) {
    //         mentioned = exact;
    //       } else if (exact.length > 1) {
    //         setChildDisambigReason('multiple');
    //         setChildCandidates(exact);
    //         setExpressedAgeMonths(months);
    //         setShowChildDisambiguationModal(true);
    //         setIsAssistantLoading(false);
    //         return;
    //       } else if (close.length === 1) {
    //         mentioned = close;
    //       } else if (close.length > 1) {
    //         setChildDisambigReason('multiple');
    //         setChildCandidates(close);
    //         setExpressedAgeMonths(months);
    //         setShowChildDisambiguationModal(true);
    //         setIsAssistantLoading(false);
    //         return;
    //       } else {
    //         setChildDisambigReason('none');
    //         setChildCandidates(userChildren);
    //         setExpressedAgeMonths(months);
    //         setShowChildDisambiguationModal(true);
    //         setIsAssistantLoading(false);
    //         return;
    //       }
    //     } else {
    //       const {known, unknown} = resolveChildrenAndUnknownNames(
    //         query,
    //         userChildren,
    //       );
    //       if (known.length === 0 && unknown.length > 0) {
    //         setChildDisambigReason('name');
    //         setChildCandidates(userChildren);
    //         setExpressedAgeMonths(null);
    //         setShowChildDisambiguationModal(true);
    //         setIsAssistantLoading(false);
    //         return;
    //       }
    //     }
    //   }

    //   const childLines = (mentioned.length ? mentioned : userChildren).map(
    //     c => {
    //       const nm = c.nickname || 'Child';
    //       return `${nm}: ${ageYMMM(c.date_of_birth)} old`;
    //     },
    //   );

    //   const childContext = childLines.join(', ');
    //   const childrenContext = (mentioned.length ? mentioned : userChildren).map(
    //     c => ({
    //       name: c.nickname,
    //       dob: c.date_of_birth,
    //       agePretty: ageYMMM(c.date_of_birth),
    //       ageYears: calculateAge(c.date_of_birth),
    //     }),
    //   );

    //   const prompt = (
    //     mentioned.length > 0
    //       ? `${query} (Focus on: ${childContext}).`
    //       : `${query}. Child context: ${childContext}.`
    //   ).trim();

    //   const endpoint = '/api/personalization/enhanced-tips-survey';

    //   const enhancedContext = {
    //     prompt,
    //     contentPreferences,
    //     generateMode: 'hybrid',
    //     childrenContext,
    //   };

    //   const res = await fetchWithAuth(`${API_ENDPOINTS.BASE_URL}${endpoint}`, {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //       Authorization: `Bearer ${userInfo.access_token}`,
    //     },
    //     body: JSON.stringify(enhancedContext),
    //   });

    //   const data = await res.json();

    //   if (!res.ok) {
    //     if (data?.error === 'out_of_scope') {
    //       Alert.alert(
    //         'Topic Not Supported',
    //         data.message || REJECTION_MESSAGE,
    //         [
    //           {
    //             text: 'See Examples',
    //             onPress: () => {
    //               Alert.alert(
    //                 'Try asking about:',
    //                 EXAMPLE_QUERIES.map(q => `• ${q}`).join('\n'),
    //                 [{text: 'OK'}],
    //               );
    //             },
    //           },
    //           {text: 'OK', style: 'cancel'},
    //         ],
    //       );
    //       return;
    //     }

    //     Alert.alert(
    //       'Error',
    //       data.message || 'Failed to get tips. Please try again.',
    //     );
    //     return;
    //   }

    //   if (Array.isArray(data.tips) && data.tips.length) {
    //     setTips(data.tips);
    //     tipLookupRef.current = new Map(
    //       (data.tips || []).map((t: Tip) => [t.id, t]),
    //     );

    //     Keyboard.dismiss();
    //     setShowTipsModal(true);

    //     if (data.hasSurveyPersonalization) {
    //       console.log('🎯 Tips personalized using survey data!');
    //     }
    //   } else {
    //     Alert.alert(
    //       'No Tips Found',
    //       'Try asking about reading, science exploration, social skills, or language activities.',
    //       [
    //         {
    //           text: 'See Examples',
    //           onPress: () => {
    //             Alert.alert(
    //               'Try asking about:',
    //               EXAMPLE_QUERIES.map(q => `• ${q}`).join('\n'),
    //               [{text: 'OK'}],
    //             );
    //           },
    //         },
    //         {text: 'OK', style: 'cancel'},
    //       ],
    //     );
    //   }
    // } catch (e) {
    //   console.error('tips error', e);
    //   Alert.alert(
    //     'Error',
    //     'Failed to get advice. Please check your connection and try again.',
    //   );
    // } finally {
    //   setIsAssistantLoading(false);
    // }
  };

  const CompanionView = tourRunning ? WalkthroughableView : View;

  // Extract the card so we can reuse it with/without CopilotStep
  const AskCompanionCard = (
    <CompanionView style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
          <Text style={styles.cardTitleRow}>Ask your companion</Text>
          <TouchableOpacity
            onPress={() => setShowHelperTip(true)}
            style={{padding: 4}}
            activeOpacity={0.7}>
            <MaterialIcons name="info-outline" size={20} color="#6366F1" />
          </TouchableOpacity>
        </View>
        <Text style={styles.cardSub}>Get personalized advice</Text>
      </View>

      <View style={styles.inputField}>
        <MaterialIcons name="chat-bubble-outline" size={18} color="#9AA0A6" style={{marginTop: 2}} />
        <TextInput
          style={styles.fieldText}
          value={searchText}
          onChangeText={setSearchText}
          placeholder={
            isListening ? 'Listening...' : 'e.g., vocabulary tips for Jesse at the park'
          }
          placeholderTextColor="#9AA0A6"
          multiline
          scrollEnabled={false}
          editable={!isListening}
          returnKeyType="search"
          blurOnSubmit={false}
          onSubmitEditing={() => getPersonalizedTips()}
          autoCorrect={false}
          onFocus={() => {
            // Trigger keyboard animation when input is focused
            Animated.timing(keyboardAnimation, {
              toValue: 1,
              duration: 250,
              useNativeDriver: true,
            }).start();
          }}
          onBlur={() => {
            // Reset animation when input loses focus
            Animated.timing(keyboardAnimation, {
              toValue: 0,
              duration: 250,
              useNativeDriver: true,
            }).start();
          }}
        />
        <TouchableOpacity
          style={styles.micPill}
          onPress={toggleListening}
          activeOpacity={0.8}>
          <MaterialIcons
            name={isListening ? 'mic' : 'mic-off'}
            size={18}
            color={isListening ? '#FF3B30' : '#6366F1'}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={isAssistantLoading ? cancelTips : getPersonalizedTips}
        style={{borderRadius: 22, overflow: 'hidden', marginBottom: 12}}>
        <LinearGradient
          colors={isAssistantLoading ? ['#EF4444', '#DC2626'] : ['#3B82F6', '#7C4DFF']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.ctaGradient}>
          <Text style={styles.ctaText}>
            {isAssistantLoading ? 'Cancel' : 'Get Parenting Advice'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </CompanionView>
  );

  <MapViewModal
    visible={showMapView}
    onClose={() => setShowMapView(false)}
    locations={locations}
    details={details}
    initialRegion={location}
    token={userInfo.access_token}
    onRefresh={refreshDataInBackground}
  />;

  <Modal visible={agePromptVisible} transparent animationType="fade">
    <View
      style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      }}>
      <View
        style={{
          width: '100%',
          borderRadius: 16,
          backgroundColor: '#fff',
          padding: 16,
        }}>
        <Text style={{fontSize: 16, fontWeight: '600', marginBottom: 8}}>
          Add age for {pendingUnknownName ? `"${pendingUnknownName}"` : 'child'}
        </Text>
        <Text style={{color: '#6b7280', marginBottom: 12}}>
          We can personalize tips for this question using just an age (no need
          to save the child).
        </Text>

        <View style={{flexDirection: 'row', gap: 12}}>
          <View style={{flex: 1}}>
            <Text style={{fontSize: 13, color: '#6b7280'}}>Years</Text>
            <TextInput
              keyboardType="number-pad"
              value={ageYearsInput}
              onChangeText={setAgeYearsInput}
              style={{
                borderWidth: 1,
                borderColor: '#e5e7eb',
                borderRadius: 10,
                height: 44,
                paddingHorizontal: 12,
                marginTop: 6,
              }}
            />
          </View>
          <View style={{flex: 1}}>
            <Text style={{fontSize: 13, color: '#6b7280'}}>Months</Text>
            <TextInput
              keyboardType="number-pad"
              value={ageMonthsInput}
              onChangeText={setAgeMonthsInput}
              style={{
                borderWidth: 1,
                borderColor: '#e5e7eb',
                borderRadius: 10,
                height: 44,
                paddingHorizontal: 12,
                marginTop: 6,
              }}
            />
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            marginTop: 16,
          }}>
          <TouchableOpacity
            onPress={() => {
              setAgePromptVisible(false);
              setPendingUnknownName(null);
              setAgeYearsInput('');
              setAgeMonthsInput('');
            }}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              marginRight: 8,
            }}>
            <Text style={{color: '#6b7280'}}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              const {pretty, yearsFloat} = buildAgeFromInputs(
                ageYearsInput,
                ageMonthsInput,
              );
              if (
                yearsFloat <= 0 &&
                ageMonthsInput.trim() === '' &&
                ageYearsInput.trim() === ''
              ) {
                Alert.alert('Age required', 'Enter years and/or months.');
                return;
              }
              if (pendingUnknownName) {
                setTempChildContext(prev => [
                  {
                    name: pendingUnknownName,
                    agePretty: pretty,
                    ageYears: Math.max(
                      0,
                      parseInt(ageYearsInput || '0', 10) || 0,
                    ),
                  },
                  ...prev,
                ]);
              }
              setAgePromptVisible(false);
              setPendingUnknownName(null);
              setAgeYearsInput('');
              setAgeMonthsInput('');
              // Optionally trigger the request again if you paused it
            }}
            style={{
              backgroundColor: '#4A90E2',
              borderRadius: 10,
              paddingVertical: 10,
              paddingHorizontal: 14,
            }}>
            <Text style={{color: '#fff', fontWeight: '600'}}>Use This Age</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>;

  // Early returns
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Spinner visible />
        <Text style={styles.loadingText}>Initializing...</Text>
        <Notification />
      </View>
    );
  }

  if (!userInfo?.access_token) {
    return (
      <View style={styles.loadingContainer}>
        <Spinner visible />
        <Text style={styles.loadingText}>Please log in...</Text>
        <Notification />
      </View>
    );
  }

  if (mainLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Spinner visible />
        <Text style={styles.loadingText}>{statusMessage || 'Loading...'}</Text>
        <Notification />
      </View>
    );
  }

  if (!bootChecked) {
    return <View style={{flex: 1, backgroundColor: 'white'}} />; // or skeleton
  }

  // Main render (no ScrollView)
  return (
    <>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <Notification />
      <PersonalizationSurvey
        visible={showSurvey}
        onClose={() => setShowSurvey(false)} // close from back button/etc
        onComplete={handleSurveyComplete}
        onSkip={handleSurveySkip}
      />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{flex: 1}} onLayout={() => setReady(true)}>
          {/* Blue header only behind ENACT */}
          <LinearGradient
            colors={['#3B82F6', '#8B5CF6']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.headerBar}></LinearGradient>
          <View
            style={{
              paddingHorizontal: 20,
            paddingTop: insets.top + 5,
          }}>
          <View style={styles.topRow}>
            <View>
              <Text style={styles.appName}>ENACT</Text>
              <Text style={styles.tagline}>
                Your trusted Parenting Companion
              </Text>
            </View>

            <View style={{alignItems: 'center'}}>
              <CopilotStep
                order={1}
                name="Saved Locations"
                text="View your saved locations here!">
                <WalkthroughableView style={{}} collapsable={false}>
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate('LocationList', {locations, details})
                    }
                    style={styles.iconBtn}
                    hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                    <MaterialIcons name="place" size={22} color="#5973FF" />
                  </TouchableOpacity>
                </WalkthroughableView>
              </CopilotStep>
              <Text style={{fontSize: 9, color: '#5973FF', fontWeight: '700', marginTop: 3, letterSpacing: 0.3}}>
                Locations
              </Text>
            </View>
          </View>

          <CopilotStep
            order={2}
            name="Search Locations"
            text="Search for nearby locations!">
            <WalkthroughableView style={styles.searchRow} collapsable={false}>
              <TouchableOpacity
                style={styles.heroSearch}
                activeOpacity={0.9}
                onPress={() => setShowMapView(true)}>
                <MaterialIcons name="location-on" size={18} color="#9AA0A6" />
                <Text style={styles.heroSearchText}>
                  Find nearby locations...
                </Text>
              </TouchableOpacity>
            </WalkthroughableView>
          </CopilotStep>
        </View>

        <View style={{flex: 1}}>
          {/* Content Preferences Card */}
          <Animated.View
            style={[
              {paddingHorizontal: 20},
              preferencesCardStyle,
              preferencesKeyboardStyle,
            ]}>
            <CopilotStep
              order={3}
              name="Content preferences"
              text="Select your preferences by tapping here!">
              <WalkthroughableView style={styles.card}>
                <Text style={styles.cardTitle}>Content Preferences</Text>
                <PreferencesCard
                  navigation={navigation}
                  contentPreferences={contentPreferences}
                />
              </WalkthroughableView>
            </CopilotStep>
          </Animated.View>

          {/* Ask your companion Card */}
          <Animated.View
            style={[
              {paddingHorizontal: 20},
              askCompanionCardStyle,
              keyboardAnimatedStyle,
            ]}>
            {tourRunning ? (
              <CopilotStep
                order={4}
                name="Companion"
                text="Ask for parenting tips here!">
                {AskCompanionCard}
              </CopilotStep>
            ) : (
              AskCompanionCard
            )}
          </Animated.View>
        </View>

        {/* Floating pill nav */}
        {!isKeyboardVisible && (
          <View style={styles.pillNav}>
            <TouchableOpacity style={[styles.pillItem, styles.pillItemActive]}>
              <Text style={[styles.pillText, styles.pillTextActive]}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pillItem}
              onPress={() => navigation.navigate('Settings')}>
              <Text style={styles.pillText}>Settings</Text>
            </TouchableOpacity>
          </View>
        )}
        </View>
      </TouchableWithoutFeedback>
      {/* Modals */}
      <TipsModal
        tips={tips}
        likedTips={likedTips}
        setLikedTips={setLikedTips}
        dislikedTips={dislikedTips}
        setDislikedTips={setDislikedTips}
        currentSound={currentSound}
        showTipsModal={showTipsModal}
        setShowTipsModal={setShowTipsModal}
        isOnline={isOnline}
      />
      <MapViewModal
        visible={showMapView}
        onClose={() => setShowMapView(false)}
        locations={locations}
        details={details}
        initialRegion={location}
        token={userInfo?.access_token || ''}
        onRefresh={refreshDataInBackground}
      />

      <Modal
        visible={showChildDisambiguationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowChildDisambiguationModal(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.35)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}>
          <View
            style={{
              width: '100%',
              borderRadius: 16,
              backgroundColor: '#fff',
              padding: 20,
            }}>
            <Text style={{fontSize: 16, fontWeight: '600', marginBottom: 8}}>
              {childDisambigReason === 'multiple'
                ? 'Which child do you mean?'
                : childDisambigReason === 'name'
                ? 'Which child do you mean?'
                : `Who is your ${monthsToPretty(expressedAgeMonths || 0)} old?`}
            </Text>

            {childDisambigReason === 'none' && (
              <Text
                style={{color: '#6b7280', fontWeight: '600', marginBottom: 16}}>
                Couldn't find your child around that age. Select a child.
              </Text>
            )}

            {childDisambigReason === 'multiple' && (
              <Text style={{color: '#1F2937', marginBottom: 12}}>
                We found multiple children around that age. Pick the right one:
              </Text>
            )}

            {childDisambigReason === 'name' && (
              <Text style={{color: '#1F2937', marginBottom: 12}}>
                We didn't find a saved child by that name. Pick the right child:
              </Text>
            )}

            {/* Candidate list */}
            <View
              style={{
                marginVertical: 4,
                flexDirection: 'column',
                gap: 8,
                marginBottom: 20,
              }}>
              {childCandidates.map((c, idx) => (
                <TouchableOpacity
                  key={`${c.id || c.nickname}-${idx}`}
                  onPress={() => {
                    selectedChildRef.current = c;
                    // Close modal and immediately continue with this selection
                    setShowChildDisambiguationModal(false);

                    // Re-run the request with this single 'mentioned' child using WebSocket:
                    (async () => {
                      try {
                        setIsAssistantLoading(true);

                        const nm = c.nickname || 'Child';
                        // Use the same format as when child name is in query
                        const childLabel = c.age
                          ? `${nm}: ${c.age} year${c.age === 1 ? '' : 's'} old`
                          : (() => { const s = ageYMMM(c.date_of_birth); return s === 'Unknown age' ? nm : `${nm}: ${s} old`; })();
                        const childLines = [childLabel];
                        const childContext = childLines.join(', ');

                        const q = searchText.trim();
                        // Use exact same format as when child is mentioned in query
                        const prompt = `${q} (Focus on: ${childContext}).`;

                        // Clear previous tips and errors
                        setTips([]);
                        setStreamError(null);

                        // Use WebSocket streaming (same as normal flow)
                        let openedAt: number | null = null;
                        const wsUrl = `${
                          API_ENDPOINTS.WS_BASE_URL
                        }/ws/personalization?token=${encodeURIComponent(userInfo.access_token)}`;

                        const ws = new WebSocket(wsUrl);
                        wsRef.current = ws;
                        setIsStreaming(true);

                        // Open modal early so user sees tips appear
                        setShowTipsModal(true);

                        ws.onopen = () => {
                          openedAt = Date.now();
                          console.log('[RN] WS OPEN (from modal)');
                          // First message must be {type:'start', ...}
                          ws.send(
                            JSON.stringify({
                              type: 'start',
                              prompt,
                              contentPreferences,
                              generateMode: 'hybrid',
                            }),
                          );
                        };

                        ws.onmessage = evt => {
                          const messageTime = Date.now();
                          let msg: any;
                          try {
                            msg = JSON.parse(String(evt.data));
                          } catch {
                            return;
                          }

                          switch (msg.type) {
                            case 'start':
                              break;

                            case 'phase':
                              break;

                            case 'out_of_scope':
                              closeWS();
                              setIsAssistantLoading(false);
                              Alert.alert(
                                'Topic Not Supported',
                                msg.payload?.message || REJECTION_MESSAGE,
                                [
                                  {
                                    text: 'See Examples',
                                    onPress: () =>
                                      Alert.alert(
                                        'Try asking about:',
                                        EXAMPLE_QUERIES.map(q => `• ${q}`).join('\n'),
                                        [{text: 'OK'}],
                                      ),
                                  },
                                  {
                                    text: 'OK',
                                    style: 'cancel',
                                    onPress: () => setShowTipsModal(false),
                                  },
                                ],
                              );
                              break;

                            case 'tip': {
                              console.log('messageTime (from modal)', messageTime - openedAt!);
                              const t: Tip = msg.data;
                              setTips(prev => {
                                const next = [...prev, t];
                                tipLookupRef.current = new Map(next.map((x: Tip) => [x.id, x]));
                                return next;
                              });
                              break;
                            }

                            case 'batch': {
                              const items: Tip[] = msg.items || [];
                              setTips(prev => {
                                const next = [...prev, ...items];
                                tipLookupRef.current = new Map(next.map((x: Tip) => [x.id, x]));
                                return next;
                              });
                              break;
                            }

                            case 'error':
                              setStreamError(msg.message || 'Stream error');
                              break;

                            case 'done':
                              closeWS();
                              setIsAssistantLoading(false);
                              setTimeout(() => {
                                setTips(currentTips => {
                                  if (currentTips.length === 0) {
                                    Alert.alert(
                                      'No Tips Found',
                                      'Try asking about reading, science exploration, social skills, or language activities.',
                                      [
                                        {
                                          text: 'See Examples',
                                          onPress: () =>
                                            Alert.alert(
                                              'Try asking about:',
                                              EXAMPLE_QUERIES.map(q => `• ${q}`).join('\n'),
                                              [{text: 'OK'}],
                                            ),
                                        },
                                        {text: 'OK', style: 'cancel'},
                                      ],
                                    );
                                    setShowTipsModal(false);
                                  }
                                  return currentTips;
                                });
                              }, 0);
                              break;

                            default:
                              break;
                          }
                        };

                        ws.onerror = () => {
                          setStreamError('Connection error');
                        };

                        ws.onclose = e => {
                          if (openedAt) {
                            const lifetime = Date.now() - openedAt;
                            console.log(`[RN] WS CLOSED (from modal) after ${lifetime} ms`, {
                              code: e.code,
                              reason: e.reason || '(none)',
                            });
                          }
                          setIsStreaming(false);
                        };
                      } catch (e) {
                        console.error('tips error from modal', e);
                        closeWS();
                        setIsAssistantLoading(false);
                        Alert.alert(
                          'Error',
                          'Failed to get advice. Please check your connection and try again.',
                        );
                      }
                    })();
                  }}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                    borderRadius: 10,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                  <Text style={{color: '#1F2937', fontSize: 15}}>
                    {c.nickname || 'Child'}
                    {c.age != null
                      ? ` — ${c.age}y`
                      : ageYMMM(c.date_of_birth) !== 'Unknown age'
                      ? ` — ${ageYMMM(c.date_of_birth)}`
                      : ''}
                  </Text>
                  <MaterialIcons
                    name="chevron-right"
                    size={20}
                    color="#9AA0A6"
                  />
                </TouchableOpacity>
              ))}
            </View>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
              }}>
              <TouchableOpacity
                onPress={() => setShowChildDisambiguationModal(false)}>
                <Text
                  style={{
                    color: '#FFF',
                    backgroundColor: '#FF3B30',
                    padding: 12,
                    borderRadius: 8,
                  }}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Helper Tip Modal */}
      <Modal
        visible={showHelperTip}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHelperTip(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}>
          <View
            style={{
              width: '100%',
              maxWidth: 400,
              borderRadius: 20,
              backgroundColor: '#fff',
              padding: 24,
              shadowColor: '#000',
              shadowOffset: {width: 0, height: 4},
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}>
            {/* Header */}
            <View style={{marginBottom: 20}}>
              <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
                <View style={{backgroundColor: '#EEF2FF', borderRadius: 12, padding: 10}}>
                  <MaterialIcons name="tips-and-updates" size={26} color="#6366F1" />
                </View>
                <TouchableOpacity onPress={() => setShowHelperTip(false)} style={{padding: 4}}>
                  <MaterialIcons name="close" size={24} color="#9AA0A6" />
                </TouchableOpacity>
              </View>
              <Text style={{fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4}}>
                How to Ask for Tips
              </Text>
            </View>

            {/* Format + examples */}
            {(() => {
              const childName = userChildren.length === 1 ? userChildren[0].nickname : 'your child';
              const examples = [
                {label: `Vocabulary tips for ${childName} at the grocery store`, icon: 'shopping-cart'},
                {label: `Science tips for ${childName} at the park`, icon: 'park'},
                {label: `Reading tips for ${childName} at the library`, icon: 'menu-book'},
                {label: `Social skills tips for ${childName} during playtime`, icon: 'people'},
              ];
              return (
                <View style={{marginBottom: 20}}>
                  <View style={{backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12, marginBottom: 14}}>
                    <Text style={{fontSize: 13, color: '#6B7280', marginBottom: 6}}>Use this format:</Text>
                    <Text style={{fontSize: 15, fontWeight: '700', color: '#111827'}}>
                      Give me tips for{' '}
                      <Text style={{color: '#6366F1'}}>CHILD'S NAME</Text>
                      {' '}for{' '}
                      <Text style={{color: '#6366F1'}}>ACTIVITY</Text>
                    </Text>
                  </View>
                  <Text style={{fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: '500'}}>TAP AN EXAMPLE TO TRY IT</Text>
                  {examples.map((ex, i) => (
                    <TouchableOpacity
                      key={i}
                      activeOpacity={0.75}
                      onPress={() => { setSearchText(ex.label); setShowHelperTip(false); }}
                      style={{flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', borderRadius: 10, padding: 10, marginBottom: 6, gap: 10}}>
                      <MaterialIcons name={ex.icon as any} size={18} color="#6366F1" />
                      <Text style={{flex: 1, fontSize: 13, color: '#1F2937'}}>{ex.label}</Text>
                      <MaterialIcons name="north-west" size={14} color="#6366F1" />
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })()}

            {/* Close Button */}
            <TouchableOpacity
              onPress={() => setShowHelperTip(false)}
              activeOpacity={0.8}
              style={{borderRadius: 12, overflow: 'hidden'}}>
              <LinearGradient
                colors={['#3B82F6', '#7C4DFF']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={{
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text
                  style={{
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: 16,
                  }}>
                  Got it!
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8F9FA'},

  searchOverlay: {
    ...StyleSheet.absoluteFillObject, // overlay on top of the map
    // put content only at the top; allow taps to pass through empty space
    justifyContent: 'flex-start',
    zIndex: 2, // iOS
    elevation: 12, // Android
    paddingTop: 20,
  },

  // Header wrapper gives shadow (not applied to LinearGradient to avoid warnings)
  headerShadow: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 6,
  },
  headerBar: {
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 230,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandingContainer: {flex: 1},
  appName: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  tagline: {fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 4},

  searchRow: {
    alignItems: 'center',
    marginVertical: 16,
    flexDirection: 'row',
  },
  heroSearch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  heroSearchText: {flex: 1, marginLeft: 8, color: '#9AA0A6', fontSize: 15},
  iconBtn: {
    height: 44,
    width: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  cardHeaderRow: {marginBottom: 12},
  cardTitleRow: {fontSize: 18, fontWeight: '600', color: '#1F2937'},
  cardSub: {fontSize: 13, color: '#9AA0A6'},

  // Pref grid
  prefGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  prefTile: {
    height: 96,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    flexBasis: '48%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefTileActive: {
    borderWidth: 2,
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  prefTileDisabled: {opacity: 0.6},
  prefTitle: {marginTop: 6, fontSize: 14, fontWeight: '600', color: '#4B5563'},
  prefTitleActive: {color: '#4A90E2'},
  prefTitleMuted: {color: '#A1A1AA'},
  prefSub: {fontSize: 12, color: '#9AA0A6', marginTop: 2},
  prefSubMuted: {color: '#D1D5DB'},

  // Input field
  inputField: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8F9FB',
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  fieldText: {flex: 1, marginLeft: 8, color: '#111827', fontSize: 15, textAlignVertical: 'top', minHeight: 24},
  micPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // CTA
  ctaGradient: {
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {color: '#fff', fontWeight: '700', fontSize: 15},

  // Small avatar dot
  avatarDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5FF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  // Floating pill nav
  pillNav: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 22,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  pillItem: {
    flex: 1,
    height: 38,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillItemActive: {backgroundColor: '#F1F5FF'},
  pillText: {fontSize: 14, color: '#6B7280', fontWeight: '600'},
  pillTextActive: {color: '#111827'},

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
  },

  // Map modal
  mapModalContainer: {marginHorizontal: 20, borderRadius: 20},
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  mapHeaderTitle: {fontSize: 18, fontWeight: '600', color: '#1F2937'},
  // fullMap: {flex: 1, zIndex: 0},
  fullMap: StyleSheet.absoluteFillObject,
  searchBarWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 10000,
    elevation: 10000,
  },
  searchInput: {
    color: '#1F2937',
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addLocationForm: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    marginHorizontal: 20,
  },
  formTitle: {fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 16},
  dropdown: {
    height: 50,
    borderColor: '#E8E8E8',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  dropdownPlaceholder: {fontSize: 16, color: '#666'},
  dropdownSelected: {fontSize: 16, color: '#1F2937', fontWeight: '500'},
  input: {
    height: 50,
    borderColor: '#E8E8E8',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  textArea: {height: 100, textAlignVertical: 'top', paddingTop: 12},
  addButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {color: '#FFFFFF', fontSize: 16, fontWeight: '600'},

  // Survey button
  surveyPromptButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 12,
  },
  surveyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  surveyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  personalizationIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF5FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  personalizationText: {
    fontSize: 12,
    color: '#4A90E2',
    fontWeight: '500',
    marginLeft: 4,
  },
});

export default MainScreen;
