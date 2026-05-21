import React, {useState, useEffect} from 'react';
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
  Clipboard,
  Linking,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {BASE_URL} from '../config';

// Import the AuthStackParamList from your navigation types
type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: {token: string};
};

// Use NativeStackScreenProps to correctly type the screen props
type ResetPasswordScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  'ResetPassword'
>;

const API_URL = `${BASE_URL}/api`;

const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({
  navigation,
  route,
}) => {
  const [resetToken, setResetToken] = useState(route.params?.token || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleDeepLink = (event: {url: string}) => {
      if (event.url) {
        const token = event.url.split('/').pop();
        if (token) {
          setResetToken(token);
        }
      }
    };

    Linking.getInitialURL().then((url: string | null) => {
      if (url) {
        handleDeepLink({url});
      }
    });

    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, []);

  const handlePasteToken = async (): Promise<void> => {
    try {
      const text = await Clipboard.getString();
      if (text) {
        setResetToken(text.trim());
      }
    } catch (err) {
      console.error('Failed to paste token:', err);
    }
  };

  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    return errors;
  };

  const handleSubmit = async (): Promise<void> => {
    try {
      setError('');

      if (!resetToken) {
        setError('Please enter the reset code from your email');
        return;
      }

      const passwordErrors = validatePassword(newPassword);
      if (passwordErrors.length > 0) {
        setError(passwordErrors.join('\n'));
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      setIsSubmitting(true);

      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: resetToken.trim(),
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Password reset failed');
      }

      Alert.alert('Success', 'Your password has been reset successfully', [
        {text: 'OK', onPress: () => navigation.navigate('Login')},
      ]);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to reset password. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#3B82F6', '#8B5CF6']}
        style={styles.gradientBackground}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}>
          <View style={styles.contentContainer}>
            <View style={styles.formContainer}>
              <Text style={styles.title}>Reset Password</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Reset Code</Text>
                <View style={styles.tokenInputContainer}>
                  <TextInput
                    style={styles.tokenInput}
                    value={resetToken}
                    onChangeText={setResetToken}
                    placeholder="Enter reset code from email"
                    placeholderTextColor="#1F2937"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={handlePasteToken}
                    style={styles.pasteButton}>
                    <Text style={styles.pasteButtonText}>Paste</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>New Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                    placeholder="Enter new password"
                    placeholderTextColor="#1F2937"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}>
                    <Ionicons
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={24}
                      color="#1F2937"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Confirm Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor="#1F2937"
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}>
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off' : 'eye'}
                      size={24}
                      color="#1F2937"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  isSubmitting && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Reset Password</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.navigate('Login')}>
                <Text style={styles.backButtonText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
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
  title: {
    fontSize: Platform.select({ios: 24, android: 22, default: 22}),
    fontWeight: 'bold',
    color: '#333333',
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
  tokenInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    paddingHorizontal: Platform.select({ios: 16, android: 12, default: 12}),
    paddingVertical: Platform.select({ios: 12, android: 9, default: 9}),
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    color: '#333333',
    marginRight: 8,
  },
  pasteButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: Platform.select({ios: 16, android: 12, default: 12}),
    paddingVertical: Platform.select({ios: 12, android: 9, default: 9}),
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
  },
  pasteButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: Platform.select({ios: 16, android: 12, default: 12}),
    paddingVertical: Platform.select({ios: 12, android: 9, default: 9}),
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    color: '#333333',
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
  eyeButton: {
    padding: Platform.select({ios: 12, android: 10, default: 10}),
  },
  errorContainer: {
    backgroundColor: '#FFE5E5',
    padding: Platform.select({ios: 12, android: 10, default: 10}),
    borderRadius: Platform.select({ios: 8, android: 7, default: 7}),
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    paddingVertical: Platform.select({ios: 16, android: 12, default: 12}),
    alignItems: 'center',
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
  },
  submitButtonDisabled: {
    backgroundColor: '#A5C8F2',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    fontWeight: 'bold',
  },
  backButton: {
    alignItems: 'center',
  },
  backButtonText: {
    color: '#8B5CF6',
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    fontWeight: '600',
  },
});

export default ResetPasswordScreen;
