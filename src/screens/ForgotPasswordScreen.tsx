import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {MaterialIcons} from '@expo/vector-icons';
import {NavigationProp} from '@react-navigation/native';
import {BASE_URL} from '../config';

const API_URL = `${BASE_URL}/api`;

interface ForgotPasswordScreenProps {
  navigation: NavigationProp<any>;
}

const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  navigation,
}) => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (text && !validateEmail(text)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const handleSubmit = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('inside try');
      const response = await fetch(`${API_URL}/auth/request-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({email}),
      });

      console.log('response', response);

      const data = await response.json();

      console.log('data', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send reset email');
      }

      Alert.alert(
        'Success',
        'Password reset instructions have been sent to your email. Please check your SPAM folder if you can not find the email.',
        [
          {
            text: 'Enter Reset Code',
            onPress: () => navigation.navigate('ResetPassword', {token: ''}),
          },
        ],
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'Failed to send reset email. Please try again.',
      );
      setIsSubmitting(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#3B82F6', '#8B5CF6']}
        style={styles.gradientBackground}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}>
          <View style={styles.contentContainer}>
            <View style={styles.formContainer}>
              <View style={styles.headerRow}>
                {/* Left: Back */}
                <TouchableOpacity
                  style={styles.backHitbox}
                  onPress={() => navigation.goBack()}>
                  <MaterialIcons name="arrow-back" size={20} color="#000" />
                </TouchableOpacity>

                {/* Middle: Title */}
                <View style={styles.headerCenter}>
                  <Text style={styles.title}>Reset Password</Text>
                </View>

                {/* Right: Spacer to keep title centered */}
                <View style={styles.backHitbox} />
              </View>

              <Text style={styles.subtitle}>
                Enter your email address and we'll send you instructions to
                reset your password.
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={[styles.input, emailError && styles.inputError]}
                  value={email}
                  placeholder="Enter your email"
                  placeholderTextColor="#A0A0A0"
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                />
                {emailError ? (
                  <Text style={styles.errorText}>{emailError}</Text>
                ) : null}
              </View>

              <TouchableOpacity onPress={handleSubmit} disabled={isSubmitting}>
                <LinearGradient
                  colors={['#3B82F6', '#8B5CF6']}
                  style={[
                    styles.submitButton,
                    isSubmitting && styles.submitButtonDisabled,
                  ]}>
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      Send Reset Instructions
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backTextButton}
                onPress={() => navigation.navigate('Login')}
                disabled={isSubmitting}>
                <Text style={styles.backButtonText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4, // tighter gap before subtitle
  },

  // Matches both left and right columns so the center truly centers
  backHitbox: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },

  // optional: tighten title's bottom spacing since subtitle sits right under it
  title: {
    fontSize: Platform.select({ios: 24, android: 22, default: 22}),
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 4,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Platform.select({ios: 20, android: 16, default: 16}),
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: Platform.select({ios: 20, android: 16, default: 16}),
    padding: Platform.select({ios: 24, android: 18, default: 18}),
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  subtitle: {
    fontSize: Platform.select({ios: 14, android: 13, default: 13}),
    color: '#666666',
    textAlign: 'center',
    marginBottom: Platform.select({ios: 24, android: 18, default: 18}),
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
    paddingVertical: Platform.select({ios: 12, android: 9, default: 9}),
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    color: '#333333',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#A5C8F2',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backTextButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  backButtonText: {
    color: '#8B5CF6',
    fontSize: 14,
  },
});

export default ForgotPasswordScreen;
