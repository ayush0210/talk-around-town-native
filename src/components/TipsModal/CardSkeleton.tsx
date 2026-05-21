// CardSkeleton.tsx
import React from 'react';
import {Platform, View, StyleSheet} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';

const CardSkeleton = ({isLoading = true}) => {
  return (
    <View style={styles.tipItem}>
      <View style={styles.tipCardShadow}>
        <LinearGradient
          colors={['#ffffff', '#f8f9fa']}
          style={styles.tipGradient}>
          <View style={styles.tipHeader}>
            <Icon
              name="auto-awesome"
              size={24}
              color="#E5E7EB"
              style={{marginRight: 12}}
            />
            <View
              style={{
                height: 18,
                width: 160,
                borderRadius: 6,
                backgroundColor: '#E5E7EB',
              }}
            />
          </View>

          <View
            style={{
              height: 10,
              borderRadius: 6,
              backgroundColor: '#E5E7EB',
              marginTop: 12,
            }}
          />
          <View
            style={{
              height: 10,
              borderRadius: 6,
              backgroundColor: '#EDF2F7',
              marginTop: 8,
              width: '85%',
            }}
          />
          <View
            style={{
              height: 10,
              borderRadius: 6,
              backgroundColor: '#E5E7EB',
              marginTop: 14,
              width: '70%',
            }}
          />

          <View style={[styles.tipActions, {marginTop: 16}]}>
            <View style={[styles.playButton, {opacity: 0.5}]} />
            <View
              style={{
                height: 28,
                width: 28,
                borderRadius: 14,
                backgroundColor: '#E5E7EB',
                marginLeft: 8,
              }}
            />
            <View
              style={{
                height: 28,
                width: 28,
                borderRadius: 14,
                backgroundColor: '#E5E7EB',
                marginLeft: 4,
              }}
            />
          </View>
        </LinearGradient>
      </View>
    </View>
  );
};

export default CardSkeleton;

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    // shadow for iOS
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    // elevation for Android
    elevation: 3,
  },
  skeletonContainer: {
    width: '100%',
  },

  // Tips
  tipItem: {marginBottom: 16},
  tipCardShadow: {
    backgroundColor: '#FFFFFF',
    borderRadius: Platform.select({ios: 16, android: 14, default: 14}),
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tipGradient: {
    borderRadius: Platform.select({ios: 16, android: 14, default: 14}),
    padding: Platform.select({ios: 20, android: 14, default: 14}),
    elevation: 5,
  },
  tipHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 12},
  tipTitle: {
    fontSize: Platform.select({ios: 18, android: 16, default: 16}),
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  tipBody: {
    fontSize: Platform.select({ios: 16, android: 14, default: 14}),
    color: '#444',
    lineHeight: Platform.select({ios: 24, android: 20, default: 20}),
    marginBottom: Platform.select({ios: 12, android: 8, default: 8}),
  },
  tipDetails: {
    fontSize: Platform.select({ios: 14, android: 12, default: 12}),
    color: '#666',
    lineHeight: Platform.select({ios: 20, android: 18, default: 18}),
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
  },
  tipActions: {flexDirection: 'row', alignItems: 'center', marginTop: 6},
  playButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: Platform.select({ios: 8, android: 7, default: 7}),
    paddingHorizontal: Platform.select({ios: 12, android: 10, default: 10}),
    borderRadius: Platform.select({ios: 8, android: 7, default: 7}),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: 96,
  },
  stopButton: {backgroundColor: '#FF3B30'},
  playButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});
