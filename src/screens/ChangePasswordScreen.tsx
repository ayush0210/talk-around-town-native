import React, {useState, useContext} from 'react';
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
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {MaterialIcons} from '@expo/vector-icons';
import {NavigationProp} from '@react-navigation/native';
import {AuthContext, AuthContextType} from '../context/AuthContext';
import {BASE_URL} from '../config';

const API_URL = `${BASE_URL}/api`;

interface ChangePasswordScreenProps {
  navigation: NavigationProp<any>;
}

const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({
  navigation,
}) => {
  const {userInfo} = useContext<AuthContextType>(AuthContext);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validatePassword = (password: string): boolean => {
    return password.length >= 8;
  };

  const handlePasswordChange = (text: string) => {
    setNewPassword(text);
    if (text && !validatePassword(text)) {
      setPasswordError('Password must be at least 8 characters long');
    } else {
      setPasswordError('');
    }

    // Check if confirm password matches
    if (confirmPassword && text !== confirmPassword) {
      setConfirmError('Passwords do not match');
    } else {
      setConfirmError('');
    }
  };

  const handleConfirmChange = (text: string) => {
    setConfirmPassword(text);
    if (text && text !== newPassword) {
      setConfirmError('Passwords do not match');
    } else {
      setConfirmError('');
    }
  };

  const handleSubmit = async () => {
    // Validate inputs
    if (!currentPassword) {
      Alert.alert('Error', 'Please enter your current password');
      return;
    }

    if (!newPassword) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (!validatePassword(newPassword)) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setConfirmError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.access_token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      Alert.alert('Success', 'Your password has been changed successfully.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'Failed to change password. Please try again.',
      );
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.contentContainer}>
              <View style={styles.formContainer}>
                <Text style={styles.title}>Change Password</Text>
                <Text style={styles.subtitle}>
                  Enter your current password and a new password to update your
                  account.
                </Text>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Current Password</Text>
                  <TextInput
                    style={styles.input}
                    value={currentPassword}
                    placeholder="Enter your current password"
                    placeholderTextColor="#A0A0A0"
                    onChangeText={setCurrentPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isSubmitting}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>New Password</Text>
                  <TextInput
                    style={[styles.input, passwordError && styles.inputError]}
                    value={newPassword}
                    placeholder="Enter new password"
                    placeholderTextColor="#A0A0A0"
                    onChangeText={handlePasswordChange}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isSubmitting}
                  />
                  {passwordError ? (
                    <Text style={styles.errorText}>{passwordError}</Text>
                  ) : null}
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Confirm New Password</Text>
                  <TextInput
                    style={[styles.input, confirmError && styles.inputError]}
                    value={confirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor="#A0A0A0"
                    onChangeText={handleConfirmChange}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isSubmitting}
                  />
                  {confirmError ? (
                    <Text style={styles.errorText}>{confirmError}</Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={[isSubmitting && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}>
                  <LinearGradient
                    colors={['#3B82F6', '#7C4DFF']}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 1}}
                    style={styles.ctaGradient}>
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitButtonText}>
                        Update Password
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    left: 20,
    zIndex: 1,
    padding: 8,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Platform.select({ios: 20, android: 16, default: 16}),
    paddingTop: Platform.select({ios: 80, android: 64, default: 64}),
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
    marginBottom: 12,
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
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    paddingVertical: Platform.select({ios: 16, android: 12, default: 12}),
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#A5C8F2',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    fontWeight: 'bold',
  },
  // CTA
  ctaGradient: {
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {color: '#fff', fontWeight: '700', fontSize: 15},
  forgotPasswordButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotPasswordText: {
    color: '#4A90E2',
    fontSize: 14,
  },
});

export default ChangePasswordScreen;
