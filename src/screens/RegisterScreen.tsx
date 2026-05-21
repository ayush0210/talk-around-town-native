import React, {useState, useContext} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Dimensions,
  Alert,
  StatusBar,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import {Ionicons} from '@expo/vector-icons';
import {MaterialIcons} from '@expo/vector-icons';
import Spinner from 'react-native-loading-spinner-overlay';
import LinearGradient from 'react-native-linear-gradient';
import ProgressBar from '../components/Register/ProgressBar';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import NumberOfChildren from '../components/Register/NumberOfChildren';
import ChildrenDetailsStep from '../components/Register/ChildrenDetailsStep';
import {Dropdown} from 'react-native-element-dropdown';

const {height} = Dimensions.get('window');

interface ChildDetail {
  nickname: string;
  age: string;
  id: string;
}

const CAREGIVER_TYPES = [
  {label: 'Parent', value: 'parent'},
  {label: 'Grandparent', value: 'grandparent'},
  {label: 'Guardian', value: 'guardian'},
  {label: 'Nanny/Babysitter', value: 'nanny'},
  {label: 'Other Family Member', value: 'other_family'},
  {label: 'Other', value: 'other'},
];

const RegisterScreen = ({navigation}: any) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [caregiverType, setCaregiverType] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [numberOfChildren, setNumberOfChildren] = useState('');
  const [childrenAges, setChildrenAges] = useState<string[]>([]);
  const {isLoading, register} = useContext<any>(AuthContext);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const handlePasswordChange = (text: string) => {
    setPassword(text);

    if (text.length > 0 && text.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
    } else {
      setPasswordError('');
    }
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (text.length > 0 && !validateEmail(text)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleNext = async () => {
    if (step === 1 && !caregiverType) {
      Alert.alert('Role Required', 'Please select your role');
      return;
    }

    if (step === 2 && !validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    if (step === 3) {
      if (!password.trim()) {
        Alert.alert('Invalid Password', 'Please enter a password');
        return;
      }
      if (password.length < 8) {
        Alert.alert(
          'Invalid Password',
          'Password must be at least 8 characters long',
        );
        return;
      }
    }

    if (step === 4 && !numberOfChildren.trim()) {
      Alert.alert('Number Required', 'Please enter the number of children');
      return;
    }

    if (step === 5 && childrenDetails.some(child => !child.age)) {
      Alert.alert('Ages Required', 'Please select age for all children');
      return;
    }

    if (step < 5) {
      setStep(step + 1);
    } else {
      await handleRegister();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleRegister = async () => {
    try {
      console.log('Starting registration process');

      if (!email.trim() || !password.trim() || !caregiverType) {
        Alert.alert(
          'Missing Information',
          'Please fill in all required fields',
        );
        return;
      }

      // Convert age to date of birth
      const today = new Date();
      const registrationData = {
        numberOfChildren: parseInt(numberOfChildren),
        caregiverType,
        childrenDetails: childrenDetails.map(child => {
          const ageInYears = parseInt(child.age);
          const birthYear = today.getFullYear() - ageInYears;
          // Set birth date to January 1st of the calculated year
          const dateOfBirth = new Date(birthYear, 0, 1);

          return {
            nickname:
              child.nickname || `Child_${childrenDetails.indexOf(child) + 1}`,
            age: ageInYears,
            date_of_birth: dateOfBirth.toISOString().split('T')[0], // Format: YYYY-MM-DD
          };
        }),
      };

      console.log('Registration data:', {
        name: name.trim() || null,
        email: email.trim(),
        password,
        caregiverType,
        childrenData: registrationData,
      });

      const success = await register(
        name.trim() || null,
        email.trim(),
        password,
        registrationData,
      );

      if (success) {
        navigation.reset({
          index: 0,
          routes: [{name: 'Login'}],
        });
      }
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert(
        'Registration Failed',
        (error as any).message || 'An error occurred during registration',
      );
    }
  };

  const [childrenDetails, setChildrenDetails] = useState<ChildDetail[]>([]);

  const RenderBackButton = () => {
    return (
      <TouchableOpacity
        onPress={() =>
          step === 1 ? navigation.navigate('Login') : handleBack()
        }
        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
        <MaterialIcons name="arrow-back" size={20} color="#333333" />
      </TouchableOpacity>
    );
  };

  const renderStep = () => {
    const commonInputStyle = [
      styles.input,
      {borderColor: '#E0E0E0', backgroundColor: '#F5F5F5'},
    ];
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <RenderBackButton />
              <View style={{flexDirection: 'column', alignItems: 'center'}}>
                <Text style={styles.stepTitle}>About You</Text>
                <Text style={styles.stepDescription}>
                  Tell us a bit about yourself
                </Text>
              </View>
              <View style={{width: 22}} />
            </View>
            <Text style={styles.fieldLabel}>I am a...</Text>
            <Dropdown
              style={styles.caregiverPickerContainer}
              placeholderStyle={styles.caregiverPickerPlaceholder}
              selectedTextStyle={styles.caregiverPickerSelected}
              itemTextStyle={styles.caregiverPickerItemText}
              itemContainerStyle={styles.caregiverPickerItemContainer}
              data={CAREGIVER_TYPES}
              maxHeight={300}
              labelField="label"
              valueField="value"
              placeholder="Select your role"
              value={caregiverType || null}
              onChange={item => setCaregiverType(item.value)}
            />
            <TextInput
              style={[commonInputStyle, {marginTop: 16}]}
              placeholder="Enter your name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
              placeholderTextColor="#6B7280"
            />
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <RenderBackButton />
              <View style={{flexDirection: 'column', alignItems: 'center'}}>
                <Text style={styles.stepTitle}>Email Address</Text>
                <Text style={styles.stepDescription}>
                  We'll send you a confirmation email
                </Text>
              </View>

              <View style={{width: 22}} />
            </View>
            <TextInput
              style={[commonInputStyle, emailError ? styles.inputError : null]}
              placeholder="Enter your email"
              value={email}
              onChangeText={handleEmailChange}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#A0A0A0"
            />
            {emailError ? (
              <Text style={styles.errorText}>{emailError}</Text>
            ) : null}
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <RenderBackButton />

              <View style={{flexDirection: 'column', alignItems: 'center'}}>
                <Text style={styles.stepTitle}>Create Password</Text>
                <Text style={styles.stepDescription}>
                  Choose a secure password for your account
                </Text>
              </View>

              <View style={{width: 22}} />
            </View>

            <View
              style={[
                styles.passwordContainer,
                passwordError ? styles.inputError : null,
              ]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#A0A0A0"
              />
              <TouchableOpacity
                onPress={togglePasswordVisibility}
                style={styles.eyeButton}>
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={24}
                  color="#666666"
                />
              </TouchableOpacity>
            </View>
            {passwordError ? (
              <Text style={styles.errorText}>{passwordError}</Text>
            ) : (
              password.length >= 8 && (
                <Text style={styles.successText}>
                  Password meets requirements ✓
                </Text>
              )
            )}

            <View style={styles.passwordRequirements}>
              <Text style={styles.requirementLabel}>Your password must:</Text>
              <View style={styles.requirementItem}>
                <View
                  style={[
                    styles.requirementDot,
                    password.length >= 8
                      ? styles.requirementMet
                      : styles.requirementNotMet,
                  ]}
                />
                <Text style={styles.requirementText}>
                  Be at least 8 characters long
                </Text>
              </View>
            </View>
          </View>
        );
      case 4:
        return (
          <NumberOfChildren
            numberOfChildren={numberOfChildren}
            setNumberOfChildren={setNumberOfChildren}
            setChildrenDetails={setChildrenDetails}
            RenderBackButton={RenderBackButton}
          />
        );
      case 5:
        return (
          <ChildrenDetailsStep
            childrenDetails={childrenDetails}
            setChildrenDetails={setChildrenDetails}
            RenderBackButton={RenderBackButton}
          />
        );
      default:
        return null;
    }
  };

  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={['#3B82F6', '#8B5CF6']}
      style={[styles.gradientBackground, {paddingTop: insets.top + 5}]}
      useAngle={true}
      angle={135}>
      <View style={{flex: 1}}>
        <StatusBar barStyle="light-content" />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}>
            <Spinner visible={isLoading} />

            <ProgressBar step={step} total={5} />

            <View style={styles.contentCard}>
              {renderStep()}

              <TouchableOpacity onPress={handleNext}>
                <LinearGradient
                  style={[
                    styles.nextButton,
                    (step === 2 && !validateEmail(email) && email.length > 0) ||
                    (step === 4 && !numberOfChildren.trim()) ||
                    (step === 5 && childrenAges.some(age => !age))
                      ? styles.buttonDisabled
                      : null,
                  ]}
                  colors={['#3B82F6', '#8B5CF6']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}>
                  <Text style={styles.nextButtonText}>
                    {step === 5 ? 'Complete Registration' : 'Continue'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </LinearGradient>
  );
};

const additionalStyles = StyleSheet.create({
  passwordRequirements: {
    marginTop: 16,
    width: '100%',
  },
  requirementLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
    marginBottom: 8,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requirementDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  requirementMet: {
    backgroundColor: '#34C759',
  },
  requirementNotMet: {
    backgroundColor: '#FF3B30',
  },
  requirementText: {
    fontSize: 14,
    color: '#333333',
  },
  successText: {
    color: '#34C759',
    fontSize: 14,
    marginTop: 8,
  },
});

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  // Password input styles
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
  },
  eyeButton: {
    padding: 8,
  },

  // Children count styles
  childrenCountContainer: {
    width: '100%',
  },
  childrenCountInput: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '500',
  },

  // Children details styles
  childrenScrollView: {
    maxHeight: height * 0.5,
    width: '100%',
  },
  scrollContentContainer: {
    paddingVertical: 8,
  },
  passwordRequirements: additionalStyles.passwordRequirements,
  requirementLabel: additionalStyles.requirementLabel,
  requirementItem: additionalStyles.requirementItem,
  requirementDot: additionalStyles.requirementDot,
  requirementMet: additionalStyles.requirementMet,
  requirementNotMet: additionalStyles.requirementNotMet,
  requirementText: additionalStyles.requirementText,
  successText: additionalStyles.successText,
  childDetailCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: Platform.select({ios: 16, android: 14, default: 14}),
    padding: Platform.select({ios: 20, android: 14, default: 14}),
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  childNumber: {
    fontSize: Platform.select({ios: 18, android: 16, default: 16}),
    fontWeight: '600',
    color: '#333333',
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
  },
  childInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    padding: Platform.select({ios: 12, android: 10, default: 10}),
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    color: '#1F2937',
  },
  dateSelectionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  pickerWrapper: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    overflow: 'hidden',
  },
  picker: {
    height: Platform.select({ios: 50, android: 44, default: 44}),
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#4A90E2',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingTop: Platform.OS === 'ios' ? 20 : 28,
    paddingHorizontal: Platform.select({ios: 20, android: 16, default: 16}),
  },
  wrapper: {
    width: '100%',
    marginBottom: 30,
  },
  track: {
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 0,
  },
  dotsRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dotHit: {
    padding: 8, // larger touch target
  },
  dotOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    // subtle shadow (iOS)
    // shadowColor: '#000',
    // shadowOffset: {width: 0, height: 2},
    // Android elevation
    // elevation: 2,
  },
  dotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Platform.select({ios: 20, android: 16, default: 16}),
    padding: Platform.select({ios: 24, android: 18, default: 18}),
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: Platform.select({ios: 20, android: 14, default: 14}),
  },
  stepContainer: {
    width: '100%',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
  },
  stepTitle: {
    fontSize: Platform.select({ios: 24, android: 22, default: 22}),
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 6,
  },
  stepDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 6,
    flexWrap: 'wrap',
    width: 200,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: Platform.select({ios: 50, android: 44, default: 44}),
    borderWidth: 1,
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    paddingHorizontal: Platform.select({ios: 16, android: 12, default: 12}),
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    color: '#1F2937',
  },
  fieldLabel: {
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    fontWeight: '500',
    color: '#333333',
    marginTop: Platform.select({ios: 16, android: 12, default: 12}),
    marginBottom: Platform.select({ios: 8, android: 6, default: 6}),
  },
  caregiverPickerContainer: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    height: Platform.select({ios: 50, android: 44, default: 44}),
    paddingHorizontal: Platform.select({ios: 12, android: 10, default: 10}),
  },
  caregiverPickerPlaceholder: {
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    color: '#6B7280',
  },
  caregiverPickerSelected: {
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    color: '#1F2937',
  },
  caregiverPickerItemText: {
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    color: '#1F2937',
  },
  caregiverPickerItemContainer: {
    backgroundColor: '#FFFFFF',
  },
  nextButton: {
    paddingVertical: Platform.select({ios: 16, android: 12, default: 12}),
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    alignItems: 'center',
    marginTop: Platform.select({ios: 24, android: 18, default: 18}),
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    fontWeight: 'bold',
  },
  buttonDisabled: {
    backgroundColor: '#A5C8F2',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
  },
  agesScrollView: {
    width: '100%',
    maxHeight: 300,
  },
  childDetailContainer: {
    backgroundColor: '#f5f5f5',
    padding: Platform.select({ios: 15, android: 12, default: 12}),
    borderRadius: Platform.select({ios: 8, android: 7, default: 7}),
    marginBottom: Platform.select({ios: 15, android: 12, default: 12}),
    width: '100%',
  },
  ageInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Platform.select({ios: 15, android: 12, default: 12}),
    width: '100%',
  },
  ageLabel: {
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    marginRight: Platform.select({ios: 15, android: 12, default: 12}),
    width: 80,
  },
  ageInput: {
    flex: 1,
    height: Platform.select({ios: 45, android: 40, default: 40}),
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: Platform.select({ios: 8, android: 7, default: 7}),
    paddingHorizontal: Platform.select({ios: 15, android: 12, default: 12}),
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    backgroundColor: '#fff',
  },
  title: {
    fontSize: Platform.select({ios: 24, android: 22, default: 22}),
    marginBottom: Platform.select({ios: 20, android: 14, default: 14}),
    fontWeight: '600',
    color: '#000',
  },
  childTitle: {
    fontSize: Platform.select({ios: 18, android: 16, default: 16}),
    fontWeight: '600',
    marginBottom: 10,
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: Platform.select({ios: 12, android: 10, default: 10}),
    paddingHorizontal: Platform.select({ios: 30, android: 24, default: 24}),
    borderRadius: Platform.select({ios: 8, android: 7, default: 7}),
    marginTop: Platform.select({ios: 20, android: 14, default: 14}),
    minWidth: 120,
  },
  buttonText: {
    color: 'white',
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    fontWeight: '600',
    textAlign: 'center',
  },
  iosPicker: {
    height: 200, // Increased height for iOS
  },
  iosPickerItem: {
    fontSize: 16,
    height: 120, // Taller items for better scrolling
  },
});

export default RegisterScreen;
