import React, {useState} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {BASE_URL} from '../config';

interface Child {
  id: number;
  nickname?: string;
  age?: number;
  date_of_birth?: string;
}

interface NewChild {
  nickname: string;
  age: string;
}

interface ChildInfoModalProps {
  visible: boolean;
  onClose: () => void;
  children: Child[];
  userToken: string;
  onChildrenUpdate: () => void;
}

const AGES = [
  {label: 'Under 1 Year', value: '0'},
  {label: '1 year', value: '1'},
  {label: '2 years', value: '2'},
  {label: '3 years', value: '3'},
  {label: '4 years', value: '4'},
  {label: '5 years', value: '5'},
];

const ChildInfoModal: React.FC<ChildInfoModalProps> = ({
  visible,
  onClose,
  children,
  userToken,
  onChildrenUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newChild, setNewChild] = useState<NewChild>({
    nickname: '',
    age: '1',
  });

  const handleEdit = (child: Child) => {
    setEditingChild(child);
    setIsEditing(true);
  };

  const handleUpdate = async () => {
    if (!editingChild) {return;}

    try {
      setIsLoading(true);
      setError(null);

      console.log('Updating child with data:', editingChild);

      const response = await fetch(`${BASE_URL}/endpoint/updateChildren`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          children: [
            {
              id: editingChild.id,
              nickname: editingChild.nickname,
              age: editingChild.age,
            },
          ],
        }),
      });

      console.log('Server response:', await response.clone().text());

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || 'Failed to update child information',
        );
      }

      const data = await response.json();
      Alert.alert('Success', 'Child information updated successfully');
      setIsEditing(false);
      setEditingChild(null);
      onChildrenUpdate();
    } catch (error) {
      console.error('Update child error:', error);
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Failed to update child information',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newChild.nickname || !newChild.age) {
      Alert.alert('Required Fields', 'Please fill in all fields');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const ageInYears = parseInt(newChild.age);
      const birthYear = new Date().getFullYear() - ageInYears;
      const dateOfBirth = new Date(birthYear, 0, 1).toISOString().split('T')[0];

      const childData = {
        nickname: newChild.nickname,
        age: ageInYears,
        date_of_birth: dateOfBirth,
      };

      console.log('Adding child with data:', childData);

      const response = await fetch(`${BASE_URL}/endpoint/children`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(childData),
      });

      const responseText = await response.text();
      console.log('Server response:', responseText);

      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error('Invalid server response');
      }

      if (!response.ok) {
        throw new Error(data.message || 'Failed to add child');
      }

      Alert.alert('Success', data.message || 'Child added successfully');
      setShowAddForm(false);
      setNewChild({
        nickname: '',
        age: '1',
      });
      onChildrenUpdate();
    } catch (error) {
      console.error('Add child error:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to add child',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (child: Child) => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('Deleting child with data:', child);

      const response = await fetch(
        `${BASE_URL}/endpoint/children/${child.id}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
        },
      );

      console.log('Server response:', await response.clone().text());

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || 'Failed to update child information',
        );
      }

      const data = await response.json();

      Alert.alert('Success', "Child's data deleted successfully");
      onChildrenUpdate();
    } catch (error) {
      console.error('Update child error:', error);
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : "Failed to delete child's data",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderChildForm = (isNew: boolean) => {
    if (isNew) {
      return (
        <View style={styles.formContainer}>
          <Text style={styles.formLabel}>Nickname</Text>
          <TextInput
            style={styles.input}
            value={newChild.nickname}
            onChangeText={text => setNewChild({...newChild, nickname: text})}
            placeholder="Enter nickname"
          />

          <Text style={styles.formLabel}>Age</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={newChild.age}
              style={styles.picker}
              onValueChange={value => setNewChild({...newChild, age: value})}>
              {AGES.map(age => (
                <Picker.Item
                  key={age.value}
                  label={age.label}
                  value={age.value}
                />
              ))}
            </Picker>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => setShowAddForm(false)}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleAdd}>
              <Text style={styles.buttonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (!editingChild) {return null;}

    return (
      <View style={styles.formContainer}>
        <Text style={styles.formLabel}>Nickname</Text>
        <TextInput
          style={styles.input}
          value={editingChild.nickname}
          onChangeText={text =>
            setEditingChild({...editingChild, nickname: text})
          }
          placeholder="Enter nickname"
        />

        <Text style={styles.formLabel}>Age</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={String(editingChild.age)}
            style={styles.picker}
            onValueChange={value => {
              setEditingChild({
                ...editingChild,
                age: parseInt(value),
              });
            }}>
            {AGES.map(age => (
              <Picker.Item
                key={age.value}
                label={age.label}
                value={age.value}
              />
            ))}
          </Picker>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => {
              setIsEditing(false);
              setEditingChild(null);
            }}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleUpdate}>
            <Text style={styles.buttonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Your Children</Text>

          {!isEditing && !showAddForm ? (
            <>
              {isLoading && <ActivityIndicator size="large" color="#007AFF" />}
              {error && <Text style={styles.errorText}>{error}</Text>}
              {!isLoading && !error && children.length === 0 && (
                <Text style={styles.noChildrenText}>No children added yet</Text>
              )}
              <ScrollView style={styles.childrenList}>
                {children.length > 0 ? (
                  children.map(child => (
                    <View key={child.id} style={styles.childItem}>
                      <View style={styles.childInfo}>
                        <Text style={styles.childName}>
                          {child.nickname || `Child ${child.id}`}
                        </Text>
                        <Text style={styles.childDate}>
                          Age:{' '}
                          {child.age === 0
                            ? 'Under 1 Year'
                            : `${child.age} ${child.age === 1 ? 'year' : 'years'}`}
                        </Text>
                      </View>

                      <View style={{flexDirection: 'row', gap: 6}}>
                        <TouchableOpacity onPress={() => handleEdit(child)}>
                          <Icon name="pencil" size={22} color="#007AFF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => {
                            console.log('inside press,', child);
                            Alert.alert(
                              'Delete Child',
                              `Are you sure you want to delete ${
                                child.nickname || 'this child'
                              }?`,
                              [
                                {text: 'Cancel', style: 'cancel'},
                                {
                                  text: 'Yes',
                                  style: 'destructive',
                                  onPress: () => handleDelete(child),
                                },
                              ],
                              {cancelable: true},
                            );
                          }}>
                          <Icon
                            name="delete-outline"
                            size={22}
                            color="#FF3B30"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noChildrenText}>
                    No children added yet
                  </Text>
                )}
              </ScrollView>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.addButton]}
                  onPress={() => setShowAddForm(true)}>
                  <Text style={styles.buttonText}>Add Child</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.closeButton]}
                  onPress={onClose}>
                  <Text style={styles.buttonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            renderChildForm(showAddForm)
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: Platform.select({ios: 20, android: 18, default: 18}),
    fontWeight: '600',
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
    textAlign: 'center',
  },
  childrenList: {
    maxHeight: 300,
  },
  childItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: Platform.select({ios: 16, android: 12, default: 12}),
    borderRadius: Platform.select({ios: 8, android: 7, default: 7}),
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: Platform.select({ios: 18, android: 16, default: 16}),
    fontWeight: '600',
    marginBottom: 4,
    color: '#1F2937',
  },
  childDate: {
    fontSize: Platform.select({ios: 14, android: 12, default: 12}),
    color: '#1F2937',
  },
  editButton: {},
  editButtonText: {
    color: 'white',
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Platform.select({ios: 16, android: 12, default: 12}),
  },
  button: {
    flex: 1,
    padding: Platform.select({ios: 12, android: 10, default: 10}),
    borderRadius: Platform.select({ios: 8, android: 7, default: 7}),
    marginHorizontal: 4,
  },
  addButton: {
    backgroundColor: '#34C759',
  },
  closeButton: {
    backgroundColor: '#8E8E93',
  },
  buttonText: {
    color: 'white',
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    textAlign: 'center',
    fontWeight: '500',
  },
  formContainer: {
    padding: Platform.select({ios: 16, android: 12, default: 12}),
  },
  formLabel: {
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: Platform.select({ios: 8, android: 7, default: 7}),
    padding: Platform.select({ios: 12, android: 10, default: 10}),
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    color: '#1F2937',
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
  },
  pickerContainer: {
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: Platform.select({ios: 8, android: 7, default: 7}),
    overflow: 'hidden',
  },
  picker: {
    backgroundColor: '#F8F9FA',
    color: '#1F2937',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Platform.select({ios: 16, android: 12, default: 12}),
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  saveButton: {
    backgroundColor: '#34C759',
  },
  noChildrenText: {
    textAlign: 'center',
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    color: '#666',
    marginVertical: 20,
  },
  errorText: {
    textAlign: 'center',
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    color: 'red',
    marginVertical: 20,
  },
});

export default ChildInfoModal;
