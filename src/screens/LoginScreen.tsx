import React, {useContext, useState, useEffect, useCallback, useRef} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
  Dimensions,
  StatusBar,
  ScrollView,
} from 'react-native';
import Spinner from 'react-native-loading-spinner-overlay';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AuthContext, AuthContextType} from '../context/AuthContext';
import {NavigationProp} from '@react-navigation/native';
import messaging from '@react-native-firebase/messaging';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {BASE_URL} from '../config';
// Removed incorrect import of userInfo from 'os'

interface LoginScreenProps {
  navigation: NavigationProp<any>;
}

interface TokenData {
  os: string;
  token: string;
}

// Use exact width values instead of percentage-based calculations
const {width, height} = Dimensions.get('window');
const inputWidth = Math.min(width * 0.85, 400);

const LoginScreen: React.FC<LoginScreenProps> = ({navigation}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fcmTokenStatus, setFcmTokenStatus] = useState<
    'loading' | 'success' | 'error' | 'skipped'
  >('loading');
  const {isLoading, login} = useContext<AuthContextType>(AuthContext);
  const keyboardAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      Animated.timing(keyboardAnimation, {
        toValue: 1,
        duration: Platform.OS === 'android' ? 280 : 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      Animated.timing(keyboardAnimation, {
        toValue: 0,
        duration: Platform.OS === 'android' ? 220 : 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardAnimation]);

  const updateServerToken = useCallback(
    async (fcmToken: string, accessToken: string) => {
      try {
        console.log(
          'SENDING TO SERVER - Token:',
          fcmToken?.substring(0, 20) + '...',
          'Platform:',
          Platform.OS,
        );

        const storedUserInfo = await AsyncStorage.getItem('userInfo');
        if (storedUserInfo) {
          const parsedUserInfo = JSON.parse(storedUserInfo);
          console.log('JWT Token:', parsedUserInfo.access_token);
        } else {
          console.log('No user info found in AsyncStorage');
        }

        const response = await fetch(`${BASE_URL}/api/auth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            token: fcmToken,
            platform: Platform.OS,
          }),
        });

        const responseData = await response.json();
        console.log('SERVER RESPONSE:', responseData);

        if (!response.ok) {throw new Error('Failed to update token on server');}
      } catch (error) {
        console.error('Error updating token on server:', error);
        // Don't throw - this shouldn't prevent login
      }
    },
    [],
  );

  // Enhanced FCM token handling with iOS-specific fixes
  const getAndStoreToken = useCallback(
    async (retryCount = 0): Promise<void> => {
      const maxRetries = 3;

      try {
        const messagingModule = messaging();
        console.log(
          `Attempting to get FCM token (attempt ${retryCount + 1}/${
            maxRetries + 1
          })`,
        );

        // Step 1: Check if messaging is available (especially important for iOS simulator)
        if (
          Platform.OS === 'ios' &&
          typeof messagingModule.registerDeviceForRemoteMessages === 'function'
        ) {
          console.log('iOS: Registering device for remote messages...');
          await messagingModule.registerDeviceForRemoteMessages();
        }

        // Step 2: Request permission with iOS-specific handling
        let authStatus;
        try {
          if (typeof messagingModule.requestPermission !== 'function') {
            setFcmTokenStatus('skipped');
            return;
          }
          authStatus = await messagingModule.requestPermission();
          console.log('Permission status:', authStatus);
        } catch (permissionError) {
          console.error('Permission request failed:', permissionError);

          if (Platform.OS === 'ios') {
            // On iOS, try alternative permission approach
            try {
              authStatus = await messagingModule.requestPermission({
                alert: true,
                badge: true,
                sound: true,
              });
            } catch (altPermissionError) {
              console.error(
                'Alternative permission request failed:',
                altPermissionError,
              );
              setFcmTokenStatus('error');
              return;
            }
          } else {
            setFcmTokenStatus('error');
            return;
          }
        }

        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!enabled) {
          console.log('Push notifications not enabled');
          setFcmTokenStatus('skipped');
          return;
        }

        // Step 3: Get FCM token with iOS-specific error handling
        let fcmToken;
        try {
          // Add a delay for iOS to ensure APNs token is ready
          if (Platform.OS === 'ios') {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          if (typeof messagingModule.getToken !== 'function') {
            setFcmTokenStatus('skipped');
            return;
          }

          fcmToken = await messagingModule.getToken();

          if (!fcmToken) {
            throw new Error('No FCM token received');
          }

          console.log(
            'FCM TOKEN RECEIVED:',
            fcmToken?.substring(0, 20) + '...',
          );
        } catch (tokenError) {
          console.error('FCM token retrieval failed:', tokenError);

          // iOS-specific retry logic
          if (Platform.OS === 'ios' && retryCount < maxRetries) {
            console.log(
              `iOS: Retrying FCM token retrieval in ${
                (retryCount + 1) * 2
              } seconds...`,
            );
            await new Promise(resolve =>
              setTimeout(resolve, (retryCount + 1) * 2000),
            );
            return getAndStoreToken(retryCount + 1);
          }

          // Handle specific iOS errors
          if (
            tokenError instanceof Error &&
            tokenError.message.includes('cannot parse response')
          ) {
            console.error(
              'iOS FCM Configuration Error: This usually indicates an issue with APNs or Firebase setup',
            );
            Alert.alert(
              'Notification Setup',
              'Push notifications may not work properly. Please check your Firebase configuration.',
              [{text: 'OK', style: 'default'}],
            );
          }

          setFcmTokenStatus('error');
          return;
        }

        // Step 4: Store token
        const tokenData: TokenData = {
          os: Platform.OS,
          token: fcmToken,
        };

        await AsyncStorage.setItem('deviceToken', JSON.stringify(tokenData));
        console.log('TOKEN SAVED TO ASYNC STORAGE');

        // Step 5: Send to server
        const userInfo = await AsyncStorage.getItem('userInfo');
        if (userInfo) {
          const {access_token} = JSON.parse(userInfo);
          await updateServerToken(fcmToken, access_token);
        }

        setFcmTokenStatus('success');
      } catch (error) {
        console.error('Unexpected error in getAndStoreToken:', error);

        // Final retry for unexpected errors
        if (retryCount < maxRetries) {
          console.log(
            `Retrying due to unexpected error in ${
              (retryCount + 1) * 2
            } seconds...`,
          );
          await new Promise(resolve =>
            setTimeout(resolve, (retryCount + 1) * 2000),
          );
          return getAndStoreToken(retryCount + 1);
        }

        setFcmTokenStatus('error');
      }
    },
    [updateServerToken],
  );

  // Initialize FCM token on component mount
  useEffect(() => {
    if (Platform.OS === 'ios') {
      setFcmTokenStatus('skipped');
      return;
    }

    // Delay FCM token retrieval to allow app to fully initialize
    const initializeFCM = async () => {
      // Wait a bit for the app to settle, especially important on iOS
      await new Promise(resolve => setTimeout(resolve, 1000));
      await getAndStoreToken();
    };

    initializeFCM();
  }, [getAndStoreToken]);

  // Listen for token refresh (important for iOS)
  useEffect(() => {
    if (Platform.OS === 'ios') {
      return;
    }

    const messagingModule = messaging();
    if (typeof messagingModule.onTokenRefresh !== 'function') {
      return;
    }

    const unsubscribe = messagingModule.onTokenRefresh(async token => {
      console.log('FCM Token refreshed:', token?.substring(0, 20) + '...');

      const tokenData: TokenData = {
        os: Platform.OS,
        token,
      };

      await AsyncStorage.setItem('deviceToken', JSON.stringify(tokenData));

      // Update server with new token
      const userInfo = await AsyncStorage.getItem('userInfo');
      if (userInfo) {
        const {access_token} = JSON.parse(userInfo);
        await updateServerToken(token, access_token);
      }
    });

    return unsubscribe;
  }, [updateServerToken]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);

      // Always send FCM token to server after successful login
      // The token was retrieved on mount but couldn't be sent without auth
      console.log('Login successful, sending FCM token to server...');
      const storedToken = await AsyncStorage.getItem('deviceToken');
      if (storedToken) {
        const {token} = JSON.parse(storedToken);
        const userInfo = await AsyncStorage.getItem('userInfo');
        if (userInfo && token) {
          const {access_token} = JSON.parse(userInfo);
          await updateServerToken(token, access_token);
        }
      } else {
        // If token wasn't retrieved earlier, try again
        await getAndStoreToken();
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Debug component to show FCM status (remove in production)
  const FCMStatusIndicator = () => {
    if (__DEV__) {
      const getStatusColor = () => {
        switch (fcmTokenStatus) {
          case 'success':
            return '#34C759';
          case 'error':
            return '#FF3B30';
          case 'loading':
            return '#FF9500';
          case 'skipped':
            return '#8E8E93';
          default:
            return '#8E8E93';
        }
      };

      const getStatusText = () => {
        switch (fcmTokenStatus) {
          case 'success':
            return '✓ Push notifications ready';
          case 'error':
            return '⚠️ Push notifications error';
          case 'loading':
            return '⏳ Setting up notifications...';
          case 'skipped':
            return '➖ Push notifications disabled';
          default:
            return '';
        }
      };

      return (
        <View
          style={[styles.statusIndicator, {backgroundColor: getStatusColor()}]}>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
      );
    }
    return null;
  };

  const insets = useSafeAreaInsets();
  const keyboardContentStyle = {
    transform: [
      {
        translateY: keyboardAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Platform.OS === 'android' ? -120 : -80],
        }),
      },
    ],
  };

  return (
    <LinearGradient
      colors={['#3B82F6', '#8B5CF6']}
      style={[styles.gradientBackground, {paddingTop: insets.top + 5}]}
      useAngle={true}
      angle={135}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />

        <Animated.View style={[styles.scrollContent, keyboardContentStyle]}>
          {/* Header Section */}
          <View style={styles.headerContainer}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>ENACT</Text>
              <Text style={styles.subtitle}>
                Discover learning moments everywhere
              </Text>
              <View style={styles.versionBadge}>
                <Text style={styles.version}>v1.0</Text>
              </View>
            </View>
          </View>

          {/* FCM Status Indicator (Debug only) */}
          <FCMStatusIndicator />

          {/* Form Section */}
          <View style={styles.formContainer}>
            <InputField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!isSubmitting}
            />

            <InputField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              editable={!isSubmitting}
              showToggle={showPassword}
              onToggle={() => setShowPassword(prev => !prev)}
            />

            <TouchableOpacity
              // style={[
              //   styles.loginButton,
              //   isSubmitting && styles.loginButtonDisabled,
              // ]}
              onPress={handleLogin}
              disabled={isSubmitting}>
              <LinearGradient
                colors={['#3B82F6', '#8B5CF6']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={[
                  styles.loginButton,
                  isSubmitting && styles.loginButtonDisabled,
                ]}>
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.loginButtonText}>Sign In</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>New to ENACT? </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Register')}
                disabled={isSubmitting}>
                <Text style={styles.link}>Create Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* Loading Spinner (Login screen only) */}
        <Spinner visible={isSubmitting} />
      </View>
    </LinearGradient>
  );
};

interface InputFieldProps extends React.ComponentProps<typeof TextInput> {
  label: string;
  showToggle?: boolean;
  onToggle?: () => void;
}

const InputField: React.FC<InputFieldProps> = ({label, showToggle, onToggle, ...props}) => (
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>{label}</Text>
    {onToggle ? (
      <View style={styles.passwordRow}>
        <TextInput style={styles.passwordRowInput} placeholderTextColor="#A0A0A0" {...props} />
        <TouchableOpacity onPress={onToggle} style={styles.eyeButton}>
          <Ionicons name={showToggle ? 'eye-off' : 'eye'} size={24} color="#666666" />
        </TouchableOpacity>
      </View>
    ) : (
      <TextInput style={styles.input} placeholderTextColor="#A0A0A0" {...props} />
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scrollContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Platform.select({ios: 40, android: 28, default: 28}),
    paddingHorizontal: Platform.select({ios: 20, android: 16, default: 16}),
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: Platform.select({ios: 40, android: 26, default: 26}),
    width: '100%',
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: Platform.select({ios: 36, android: 30, default: 30}),
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: Platform.select({ios: 12, android: 8, default: 8}),
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: Platform.select({ios: 18, android: 15, default: 15}),
    color: '#E0E0E0',
    marginBottom: Platform.select({ios: 16, android: 10, default: 10}),
    textAlign: 'center',
  },
  versionBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  version: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
    maxWidth: inputWidth,
    alignSelf: 'center',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  formContainer: {
    width: inputWidth,
    backgroundColor: '#FFFFFF',
    borderRadius: Platform.select({ios: 20, android: 16, default: 16}),
    padding: Platform.select({ios: 24, android: 18, default: 18}),
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 12,
    alignSelf: 'center',
  },
  inputContainer: {
    marginBottom: Platform.select({ios: 20, android: 14, default: 14}),
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    paddingHorizontal: Platform.select({ios: 16, android: 12, default: 12}),
    height: Platform.select({ios: 48, android: 42, default: 42}),
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    color: '#333333',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    height: Platform.select({ios: 48, android: 42, default: 42}),
  },
  passwordRowInput: {
    flex: 1,
    paddingHorizontal: Platform.select({ios: 16, android: 12, default: 12}),
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    color: '#333333',
  },
  eyeButton: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButton: {
    backgroundColor: '#4A90E2',
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    height: Platform.select({ios: 50, android: 44, default: 44}),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#4A90E2',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    backgroundColor: '#A5C8F2',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    fontWeight: 'bold',
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: Platform.select({ios: 16, android: 12, default: 12}),
    height: Platform.select({ios: 20, android: 18, default: 18}),
  },
  forgotPasswordText: {
    color: '#8B5CF6',
    fontSize: Platform.select({ios: 14, android: 13, default: 13}),
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Platform.select({ios: 24, android: 16, default: 16}),
    height: Platform.select({ios: 20, android: 18, default: 18}),
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    color: '#666666',
    paddingHorizontal: Platform.select({ios: 16, android: 12, default: 12}),
    fontSize: Platform.select({ios: 14, android: 13, default: 13}),
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    height: Platform.select({ios: 20, android: 18, default: 18}),
  },
  registerText: {
    color: '#666666',
    fontSize: Platform.select({ios: 14, android: 13, default: 13}),
  },
  link: {
    color: '#8B5CF6',
    fontSize: Platform.select({ios: 14, android: 13, default: 13}),
    fontWeight: '600',
  },
});

export default LoginScreen;
