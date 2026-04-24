import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  Animated,
  Dimensions,
  Platform,
  Share,
  Alert,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Get device dimensions
const { width } = Dimensions.get('window');

type TipsScreenRouteParams = {
  params?: {
    notificationData?: {
      title: string;
      message: string;
      tipDetail?: string;
      tipCategory?: string;
      tipImage?: string;
    };
  };
};

const TipsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<TipsScreenRouteParams, 'params'>>();
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];
  
  // Get category icon - fallback to default if not provided
  const getCategoryIcon = (category?: string) => {
    switch(category?.toLowerCase()) {
      case 'mealtime':
        return 'restaurant';
      case 'bedtime':
        return 'bed';
      case 'outdoor':
        return 'sunny';
      case 'learning':
        return 'school';
      case 'behavior':
        return 'happy';
      case 'health':
        return 'medical';
      default:
        return 'bulb';
    }
  };
  
  // Get gradient colors based on category
  const getCategoryGradient = (category?: string) => {
    switch(category?.toLowerCase()) {
      case 'mealtime':
        return ['#FF9966', '#FF5E62'];
      case 'bedtime':
        return ['#4A00E0', '#8E2DE2'];
      case 'outdoor':
        return ['#56CCF2', '#2F80ED'];
      case 'learning':
        return ['#11998e', '#38ef7d'];
      case 'behavior':
        return ['#F2994A', '#F2C94C'];
      case 'health':
        return ['#00B4DB', '#0083B0'];
      default:
        return ['#4A90E2', '#357ABD'];
    }
  };

  type TipData = {
    title: string;
    message: string;
    tipDetail?: string;
    tipCategory?: string;
    tipImage?: string;
  };
  
  const [tipData, setTipData] = useState<TipData | null>(null);

  const handleShare = async () => {
    if (!tipData) return;

    try {
      const shareMessage = `${tipData.title}\n\n${tipData.message}\n\nShared from ENACT App`;

      await Share.share({
        message: shareMessage,
        title: tipData.title,
      });
    } catch (error) {
      Alert.alert('Error', 'Unable to share this tip');
    }
  };

  useEffect(() => {
    // Extract notification data from route params
    if (route.params?.notificationData) {
      console.log('TipsScreen received notification data:', route.params.notificationData);
      setTipData(route.params.notificationData);
      
      // Animate the content in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      // If no notification data and this screen is accessed directly, go back
      console.log('TipsScreen accessed without notification data, navigating back');
      navigation.goBack();
    }
  }, [route.params, fadeAnim, slideAnim, navigation]);
  
  // If no tip data is available, show loading placeholder
  // This will be brief as we navigate back if no data is found
  if (!tipData) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={['#4A90E2', '#357ABD']} style={styles.gradientBackground}>
          <View style={styles.headerContainer}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Tips</Text>
            <View style={styles.placeholderView} />
          </View>
          <View style={styles.emptyStateContainer}>
            <Ionicons name="notifications-off-outline" size={70} color="#FFFFFF" style={styles.emptyStateIcon} />
            <Text style={styles.emptyStateText}>No tip information available</Text>
            <Text style={styles.emptyStateSubText}>Tips only appear from notifications</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }
  
  // Determine which gradient colors to use based on tip category
  const gradientColors = getCategoryGradient(tipData.tipCategory);
  
  // Determine which icon to use based on tip category
  const categoryIcon = getCategoryIcon(tipData.tipCategory);
  
  // Default image if none is provided
  const defaultImage = 'https://images.unsplash.com/photo-1591348278900-019a172a3377?q=80&w=2787&auto=format&fit=crop';
  
  // Display the tip information with a nicer UI
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={gradientColors} style={styles.gradientBackground}>
        <View style={styles.headerContainer}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Parenting Tip</Text>
          <View style={styles.placeholderView} />
        </View>
        
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View 
            style={[
              styles.imageContainer, 
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <Image 
              source={{ uri: tipData.tipImage || defaultImage }} 
              style={styles.tipImage} 
              resizeMode="cover"
            />
            <View style={styles.categoryBadge}>
              <Ionicons name={categoryIcon} size={18} color="#FFFFFF" style={styles.categoryIcon} />
              <Text style={styles.categoryText}>{tipData.tipCategory || 'Tip'}</Text>
            </View>
          </Animated.View>
          
          <Animated.View 
            style={[
              styles.tipContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <Text style={styles.tipTitle}>{tipData.title}</Text>
            <Text style={styles.tipMessage}>{tipData.message}</Text>
            
            {/* {tipData.tipDetail && (
              <View style={styles.tipDetailContainer}>
                <Text style={styles.tipDetailHeading}>More Information</Text>
                <Text style={styles.tipDetail}>{tipData.tipDetail}</Text>
              </View>
            )} */}
            
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                <Ionicons name="share-social-outline" size={22} color="#4A90E2" />
                <Text style={styles.actionButtonText}>Share</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  gradientBackground: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    height: 60,
  },
  backButton: {
    padding: 8,
  },
  placeholderView: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  imageContainer: {
    width: width,
    height: 200,
    marginBottom: 20,
  },
  tipImage: {
    width: '100%',
    height: '100%',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    marginRight: 6,
  },
  categoryText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  tipContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingTop: 25,
    paddingBottom: 30,
    marginTop: -20,
    minHeight: 500,
  },
  tipTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  tipMessage: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
    color: '#444',
  },
  tipDetailContainer: {
    backgroundColor: '#F9F9FB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  tipDetailHeading: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  tipDetail: {
    fontSize: 15,
    lineHeight: 22,
    color: '#555',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    marginBottom: 20,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionButtonText: {
    marginTop: 5,
    fontSize: 12,
    color: '#666',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    marginBottom: 16,
    opacity: 0.8,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptyStateSubText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
});

export default TipsScreen;