import React, {useState} from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {ACTIVITY_CATEGORIES} from '../data/activities';
import {BASE_URL} from '../config';

interface Props {
  visible: boolean;
  onClose: () => void;
  token: string | null;
}

const ActivitySuggestionModal: React.FC<Props> = ({visible, onClose, token}) => {
  const [activeSection, setActiveSection] = useState<'list' | 'add'>('list');
  const [activityName, setActivityName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!activityName.trim()) {
      Alert.alert('Required', 'Please enter an activity name.');
      return;
    }
    if (!token) {
      Alert.alert('Not logged in', 'Please log in to suggest an activity.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/activities/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({name: activityName.trim()}),
      });

      const data = await res.json();

      if (res.ok) {
        Alert.alert('Submitted!', data.message);
        setActivityName('');
        setActiveSection('list');
      } else if (data.error === 'already_supported') {
        Alert.alert('Already supported', data.message);
      } else if (data.error === 'already_pending') {
        Alert.alert('Already submitted', data.message);
      } else if (data.error === 'previously_rejected') {
        Alert.alert('Not supported', data.message);
      } else if (data.error === 'not_valid') {
        Alert.alert('Not recognized', data.message);
      } else {
        Alert.alert('Error', data.message ?? 'Something went wrong. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Could not connect. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Activities</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Toggle */}
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, activeSection === 'list' && styles.toggleActive]}
              onPress={() => setActiveSection('list')}>
              <Text style={[styles.toggleText, activeSection === 'list' && styles.toggleActiveText]}>
                Supported Activities
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, activeSection === 'add' && styles.toggleActive]}
              onPress={() => setActiveSection('add')}>
              <Text style={[styles.toggleText, activeSection === 'add' && styles.toggleActiveText]}>
                Add Activity
              </Text>
            </TouchableOpacity>
          </View>

          {activeSection === 'list' ? (
            <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
              {ACTIVITY_CATEGORIES.filter(c => c.label !== 'Structured activities').map(category => (
                <View key={category.label} style={styles.categoryBlock}>
                  <Text style={styles.categoryLabel}>{category.label}</Text>
                  {category.activities.map(activity => (
                    <Text key={activity} style={styles.activityItem}>
                      • {activity}
                    </Text>
                  ))}
                </View>
              ))}
              <View style={styles.addPrompt}>
                <Text style={styles.addPromptText}>
                  Don't see your activity?
                </Text>
                <TouchableOpacity onPress={() => setActiveSection('add')}>
                  <Text style={styles.addPromptLink}>Submit it for review →</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.addSection}>
              <Text style={styles.addDescription}>
                Submit an activity that isn't on the list. Our AI will check if it's a recognized
                child development activity (ages 0–5). If it is, an admin will review and add it.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Finger painting"
                placeholderTextColor="#aaa"
                value={activityName}
                onChangeText={setActivityName}
                maxLength={100}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit for Review</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveSection('list')}>
                <Text style={styles.backLink}>← Back to supported activities</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: 'white',
    borderTopLeftRadius: Platform.select({ios: 20, android: 16, default: 16}),
    borderTopRightRadius: Platform.select({ios: 20, android: 16, default: 16}),
    paddingHorizontal: Platform.select({ios: 20, android: 16, default: 16}),
    paddingTop: Platform.select({ios: 20, android: 16, default: 16}),
    paddingBottom: Platform.select({ios: 40, android: 28, default: 28}),
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
  },
  title: {
    fontSize: Platform.select({ios: 20, android: 18, default: 18}),
    fontWeight: 'bold',
    color: '#333',
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: Platform.select({ios: 8, android: 7, default: 7}),
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: Platform.select({ios: 8, android: 7, default: 7}),
    borderRadius: Platform.select({ios: 6, android: 5, default: 5}),
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: '#4A90E2',
  },
  toggleText: {
    fontSize: Platform.select({ios: 14, android: 13, default: 13}),
    fontWeight: '600',
    color: '#666',
  },
  toggleActiveText: {
    color: 'white',
  },
  listScroll: {
    flexGrow: 0,
  },
  categoryBlock: {
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
  },
  categoryLabel: {
    fontSize: Platform.select({ios: 14, android: 12, default: 12}),
    fontWeight: '700',
    color: '#4A90E2',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activityItem: {
    fontSize: Platform.select({ios: 14, android: 12, default: 12}),
    color: '#444',
    paddingVertical: 2,
    lineHeight: Platform.select({ios: 20, android: 18, default: 18}),
  },
  addPrompt: {
    alignItems: 'center',
    paddingVertical: Platform.select({ios: 20, android: 16, default: 16}),
  },
  addPromptText: {
    fontSize: Platform.select({ios: 14, android: 12, default: 12}),
    color: '#666',
  },
  addPromptLink: {
    fontSize: Platform.select({ios: 14, android: 12, default: 12}),
    color: '#4A90E2',
    fontWeight: '600',
    marginTop: 4,
  },
  addSection: {
    paddingTop: 4,
  },
  addDescription: {
    fontSize: Platform.select({ios: 14, android: 12, default: 12}),
    color: '#666',
    lineHeight: Platform.select({ios: 20, android: 18, default: 18}),
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: Platform.select({ios: 8, android: 7, default: 7}),
    paddingHorizontal: Platform.select({ios: 14, android: 12, default: 12}),
    paddingVertical: Platform.select({ios: 12, android: 9, default: 9}),
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    color: '#333',
    marginBottom: Platform.select({ios: 14, android: 10, default: 10}),
  },
  submitBtn: {
    backgroundColor: '#4A90E2',
    paddingVertical: Platform.select({ios: 14, android: 11, default: 11}),
    borderRadius: Platform.select({ios: 8, android: 7, default: 7}),
    alignItems: 'center',
    marginBottom: Platform.select({ios: 14, android: 10, default: 10}),
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: 'white',
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    fontWeight: '600',
  },
  backLink: {
    color: '#4A90E2',
    fontSize: Platform.select({ios: 14, android: 12, default: 12}),
    textAlign: 'center',
  },
});

export default ActivitySuggestionModal;
