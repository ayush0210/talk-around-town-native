import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  useWindowDimensions,
  Animated,
  StyleSheet,
} from 'react-native';
import {CopilotStep, walkthroughable} from 'react-native-copilot';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const PREFS = [
  {
    key: 'Language Development',
    icon: 'chat',
    title: 'Language',
    sub: 'Skills',
  },
  {
    key: 'Early Science Skills',
    icon: 'science',
    title: 'Science',
    sub: 'Skills',
  },
  {
    key: 'Literacy Foundations',
    icon: 'menu-book',
    title: 'Literacy',
    sub: 'Skills',
  },
  {
    key: 'Social-Emotional Learning',
    icon: 'people',
    title: 'Social-Emotional',
    sub: 'Skills',
  },
];

const SPACING = 12;
const H_PADDING = 20; // matches your <Animated.View style={{paddingHorizontal: 20}}

interface PreferencesCardProps {
  navigation: any;
  contentPreferences: string[];
}

const PreferencesCard: React.FC<PreferencesCardProps> = ({
  navigation,
  contentPreferences,
}) => {
  const {width} = useWindowDimensions();

  // Compute exact tile width so 2 fit per row with consistent spacing on all screens
  const tileWidth = Math.floor((width - H_PADDING * 2 - SPACING) / 2);

  const renderItem = ({item}: {item: any}) => {
    const active = contentPreferences.includes(item.key);
    return (
      <TouchableOpacity
        style={[
          styles.prefTile,
          active && styles.prefTileActive,
          {width: tileWidth, marginBottom: SPACING},
        ]}
        onPress={() => navigation.navigate('ContentSelection')}
        activeOpacity={0.9}>
        <MaterialIcons
          name={item.icon}
          size={26}
          color={active ? '#4A90E2' : '#9AA0A6'}
        />
        <Text style={[styles.prefTitle, active && styles.prefTitleActive]}>
          {item.title}
        </Text>
        <Text style={styles.prefSub}>{item.sub}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={PREFS}
      keyExtractor={item => item.key}
      numColumns={2}
      // space items across the row; we handle vertical spacing with marginBottom on tiles
      columnWrapperStyle={{justifyContent: 'space-between'}}
      renderItem={renderItem}
      scrollEnabled={false} // it's in a card; let outer scroll handle scrolling
    />
  );
};

const styles = StyleSheet.create({
  prefTile: {
    height: 96,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    flexBasis: '48%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefTileActive: {
    borderWidth: 2,
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  prefTileDisabled: {opacity: 0.6},
  prefTitle: {marginTop: 6, fontSize: 14, fontWeight: '600', color: '#4B5563'},
  prefTitleActive: {color: '#4A90E2'},
  prefTitleMuted: {color: '#A1A1AA'},
  prefSub: {fontSize: 12, color: '#9AA0A6', marginTop: 2},
  prefSubMuted: {color: '#D1D5DB'},
});

export default PreferencesCard;
