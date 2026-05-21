import React, {useState, useContext, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import {BASE_URL} from '../config';

const {width, height} = Dimensions.get('window');

interface SurveyData {
  childInterests?: string;
  additionalNotes?: string;
}

const PersonalizationSurvey: React.FC<{
  visible: boolean;
  onClose: () => void;
  onComplete: (data: SurveyData) => void;
  onSkip?: () => void;
}> = ({visible, onClose, onComplete, onSkip}) => {
  const {userInfo} = useContext<any>(AuthContext);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [childInterests, setChildInterests] = useState<string>('');
  const [additionalNotes, setAdditionalNotes] = useState<string>('');

  // Pre-populate from server when modal opens
  useEffect(() => {
    if (!visible || !userInfo?.access_token) {return;}
    fetch(`${BASE_URL}/api/personalization/survey`, {
      headers: {Authorization: `Bearer ${userInfo.access_token}`},
    })
      .then(r => (r.ok ? r.json() : null))
      .then(json => {
        if (json?.surveyData) {
          setChildInterests(json.surveyData.currentChallenge || '');
          setAdditionalNotes(json.surveyData.additionalNotes || '');
        }
      })
      .catch(() => {}); // silently ignore — blank form is fine
  }, [visible]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const surveyData: SurveyData = {
        childInterests: childInterests.trim() || undefined,
        additionalNotes: additionalNotes.trim() || undefined,
      };
      onComplete(surveyData);
    } catch (error) {
      console.error('Survey submission error:', error);
      Alert.alert('Error', 'Failed to save your preferences. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Personalization?',
      'You can always complete this later in Settings to get more personalized tips.',
      [
        {text: 'Complete Now', style: 'default'},
        {
          text: 'Skip for Now',
          style: 'destructive',
          onPress: () => {
            onSkip?.();
            onClose();
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      presentationStyle="overFullScreen">
      <View style={styles.overlay}>
        <View style={styles.popupContainer}>
          <LinearGradient colors={['#3B82F6', '#8B5CF6']} style={styles.header}>
            <View style={styles.headerContent}>
              <TouchableOpacity onPress={onClose} style={styles.backButton}>
                <MaterialIcons name="arrow-back" size={20} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>
                Personalize Your Experience
              </Text>
              <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{flex: 1}}>
            <ScrollView
              style={styles.content}
              contentContainerStyle={{paddingBottom: 20, flexGrow: 1}}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>
                  What is your child interested in?
                </Text>
                <Text style={styles.stepSubtitle}>
                  Help us personalize tips for your child (optional)
                </Text>

                <Text style={styles.inputLabel}>Child's interests:</Text>
                <TextInput
                  style={styles.textInput}
                  value={childInterests}
                  onChangeText={setChildInterests}
                  placeholder="e.g., Dinosaurs, drawing, outdoor play, music..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.inputLabel}>Additional notes:</Text>
                <TextInput
                  style={styles.textInput}
                  value={additionalNotes}
                  onChangeText={setAdditionalNotes}
                  placeholder="Anything else we should know? (age, personality, special needs...)"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>

            <View style={styles.bottomContainer}>
              <TouchableOpacity
                style={styles.nextButton}
                onPress={handleSubmit}
                disabled={isSubmitting}
                activeOpacity={0.8}>
                <LinearGradient
                  colors={['#3B82F6', '#7C4DFF']}
                  style={styles.nextButtonGradient}>
                  <Text style={styles.nextButtonText}>
                    {isSubmitting ? 'Saving...' : 'Complete'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  popupContainer: {
    width: width - 20,
    maxHeight: height * 0.95,
    minHeight: height * 0.5,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {paddingBottom: 15},
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 15,
  },
  backButton: {padding: 8},
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  skipButton: {padding: 8},
  skipText: {color: '#fff', fontSize: 14, fontWeight: '500'},

  content: {flex: 1, padding: 20},

  stepContainer: {flex: 1},
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
    lineHeight: 28,
  },
  stepSubtitle: {fontSize: 14, color: '#6B7280', marginBottom: 14},

  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#374151',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    textAlignVertical: 'top',
    marginBottom: 12,
  },

  bottomContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  nextButton: {borderRadius: 10, overflow: 'hidden'},
  nextButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {color: '#fff', fontSize: 14, fontWeight: '700'},
});

export default PersonalizationSurvey;
