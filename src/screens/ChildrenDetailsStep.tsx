import React from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import {Picker} from '@react-native-picker/picker';

interface ChildDetail {
  nickname: string;
  birthMonth: string;
  birthYear: string;
}

interface ChildrenDetailsStepProps {
  numberOfChildren: number;
  childrenDetails: ChildDetail[];
  onChildDetailChange: (index: number, field: string, value: string) => void;
}

const ChildrenDetailsStep: React.FC<ChildrenDetailsStepProps> = ({
  numberOfChildren,
  childrenDetails,
  onChildDetailChange,
}) => {
  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 18}, (_, i) =>
    (currentYear - i).toString(),
  );
  const months = [
    {value: '01', label: 'January'},
    {value: '02', label: 'February'},
    {value: '03', label: 'March'},
    {value: '04', label: 'April'},
    {value: '05', label: 'May'},
    {value: '06', label: 'June'},
    {value: '07', label: 'July'},
    {value: '08', label: 'August'},
    {value: '09', label: 'September'},
    {value: '10', label: 'October'},
    {value: '11', label: 'November'},
    {value: '12', label: 'December'},
  ];

  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>



        <Text style={styles.stepTitle}>Children Details</Text>
        <Text style={styles.stepDescription}>Enter details for each child</Text>
      </View>

      <ScrollView
        style={styles.childrenScrollView}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={true}>
        {childrenDetails.map((child, index) => (
          <View key={index} style={styles.childDetailCard}>
            <Text style={styles.childNumber}>Child {index + 1}</Text>

            <TextInput
              style={styles.childInput}
              placeholder="Nickname (optional)"
              value={child.nickname}
              onChangeText={value =>
                onChildDetailChange(index, 'nickname', value)
              }
              placeholderTextColor="#A0A0A0"
            />

            <View style={styles.dateSelectionContainer}>
              <View style={styles.pickerWrapper}>
                <Text style={styles.pickerLabel}>Birth Month</Text>
                {Platform.OS === 'ios' ? (
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={child.birthMonth}
                      onValueChange={value =>
                        onChildDetailChange(index, 'birthMonth', value)
                      }
                      style={[styles.picker, styles.iosPicker]}
                      itemStyle={styles.iosPickerItem}>
                      {months.map(month => (
                        <Picker.Item
                          key={month.value}
                          label={month.label}
                          value={month.value}
                        />
                      ))}
                    </Picker>
                  </View>
                ) : (
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={child.birthMonth}
                      onValueChange={value =>
                        onChildDetailChange(index, 'birthMonth', value)
                      }
                      style={styles.picker}>
                      {months.map(month => (
                        <Picker.Item
                          key={month.value}
                          label={month.label}
                          value={month.value}
                        />
                      ))}
                    </Picker>
                  </View>
                )}
              </View>

              <View style={styles.pickerWrapper}>
                <Text style={styles.pickerLabel}>Birth Year</Text>
                {Platform.OS === 'ios' ? (
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={child.birthYear}
                      onValueChange={value =>
                        onChildDetailChange(index, 'birthYear', value)
                      }
                      style={[styles.picker, styles.iosPicker]}
                      itemStyle={styles.iosPickerItem}>
                      {years.map(year => (
                        <Picker.Item key={year} label={year} value={year} />
                      ))}
                    </Picker>
                  </View>
                ) : (
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={child.birthYear}
                      onValueChange={value =>
                        onChildDetailChange(index, 'birthYear', value)
                      }
                      style={styles.picker}>
                      {years.map(year => (
                        <Picker.Item key={year} label={year} value={year} />
                      ))}
                    </Picker>
                  </View>
                )}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  stepContainer: {
    alignItems: 'flex-start',
    width: '100%',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 24,
  },
  childrenScrollView: {
    width: '100%',
    maxHeight: 400,
  },
  scrollContentContainer: {
    paddingVertical: 8,
  },
  childDetailCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  childNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },
  childInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
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
    borderRadius: 12,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    backgroundColor: '#FFFFFF',
  },
  iosPicker: {
    height: 200, // Increased height for iOS
  },
  iosPickerItem: {
    fontSize: 16,
    height: 120, // Taller items for better scrolling
  },
});

export default ChildrenDetailsStep;
