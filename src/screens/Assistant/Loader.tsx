// import React, {useState, useEffect} from 'react';
// import {View, Text, StyleSheet, Dimensions, ActivityIndicator} from 'react-native';

// const {width} = Dimensions.get('window');

// const facts = [
//   'Did you know? Babies can distinguish between languages from birth.',
//   'Fun fact: Children learn 5-10 new words per day between ages 2-5.',
//   'Interesting: Bilingual children often have better problem-solving skills.',
//   'Tip: Reading to your child for just 15 minutes daily significantly boosts vocabulary.',
//   'Note: Children learn language best through back-and-forth conversations.',
//   'Research shows: Music and singing help children develop language skills faster.',
//   'Did you know? Children understand words long before they can speak them.',
//   'Fun fact: Gestures are an important precursor to verbal language development.',
// ];

// // @ts-ignore
// const Loader = ({isLoading}) => {
//   const [currentFact, setCurrentFact] = useState('');

//   useEffect(() => {
//     if (isLoading) {
//       // Set initial fact immediately when loading starts
//       setCurrentFact(facts[Math.floor(Math.random() * facts.length)]);

//       // Change fact every 5 seconds
//       const interval = setInterval(() => {
//         setCurrentFact(facts[Math.floor(Math.random() * facts.length)]);
//       }, 5000);

//       return () => clearInterval(interval);
//     }
//   }, [isLoading]);

//   if (!isLoading) return null;

//   return (
//     <View style={styles.container}>
//       <View style={styles.loaderBox}>
//         <ActivityIndicator size="large" color="#4CAF50" />
//         <Text style={styles.loadingText}>Generating tips for you...</Text>
//         <Text style={styles.factText}>{currentFact}</Text>
//       </View>
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     position: 'absolute',
//     top: 0,
//     left: 0,
//     right: 0,
//     bottom: 0,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: 'rgba(0, 0, 0, 0.7)',
//     zIndex: 1000,
//   },
//   loaderBox: {
//     width: width * 0.85,
//     backgroundColor: 'white',
//     borderRadius: 16,
//     padding: 24,
//     alignItems: 'center',
//     shadowColor: '#000',
//     shadowOffset: {
//       width: 0,
//       height: 2,
//     },
//     shadowOpacity: 0.25,
//     shadowRadius: 3.84,
//     elevation: 5,
//   },
//   loadingText: {
//     fontSize: 18,
//     fontWeight: '600',
//     color: '#333',
//     marginTop: 16,
//     marginBottom: 16,
//   },
//   factText: {
//     fontSize: 16,
//     color: '#666',
//     textAlign: 'center',
//     fontStyle: 'italic',
//     lineHeight: 22,
//   },
// });

// export default Loader;
import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, Dimensions, ActivityIndicator, Animated} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const {width} = Dimensions.get('window');

const quickFacts = [
  'Generating personalized tips...',
  'Did you know? Babies can distinguish languages from birth.',
  'Children learn 5-10 new words daily between ages 2-5.',
  'Reading 15 minutes daily boosts vocabulary significantly.',
  'Music helps children develop language skills faster.',
  'Children understand words before they can speak them.',
  'Back-and-forth conversations are key for language learning.',
  'Gestures are important for verbal language development.',
];

const loadingStages = [
  { text: 'Understanding your question...', icon: 'psychology' },
  { text: 'Finding the best strategies...', icon: 'search' },
  { text: 'Personalizing your tips...', icon: 'tune' },
  { text: 'Almost ready...', icon: 'check-circle' },
];

// @ts-ignore
const Loader = ({isLoading}) => {
  const [currentFact, setCurrentFact] = useState('');
  const [currentStage, setCurrentStage] = useState(0);
  const [progress] = useState(new Animated.Value(0));
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (isLoading) {
      // Set initial fact and start animations
      setCurrentFact(quickFacts[0]);
      setCurrentStage(0);

      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Progress animation
      Animated.timing(progress, {
        toValue: 1,
        duration: 2500, // Reduced from 5000ms to 2500ms
        useNativeDriver: false,
      }).start();

      // Cycle through facts more quickly
      const factInterval = setInterval(() => {
        setCurrentFact(prev => {
          const currentIndex = quickFacts.indexOf(prev);
          const nextIndex = (currentIndex + 1) % quickFacts.length;
          return quickFacts[nextIndex];
        });
      }, 1500); // Reduced from 5000ms to 1500ms

      // Cycle through stages
      const stageInterval = setInterval(() => {
        setCurrentStage(prev => (prev + 1) % loadingStages.length);
      }, 800); // Show each stage for 800ms

      return () => {
        clearInterval(factInterval);
        clearInterval(stageInterval);
      };
    } else {
      // Fade out when done
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Reset animations
      progress.setValue(0);
    }
  }, [isLoading, progress, fadeAnim]);

  if (!isLoading) {return null;}

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.loaderBox}>
        {/* Header with dynamic icon */}
        <View style={styles.header}>
          <Icon
            name={loadingStages[currentStage].icon}
            size={32}
            color="#4CAF50"
            style={styles.headerIcon}
          />
          <Text style={styles.stageText}>
            {loadingStages[currentStage].text}
          </Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              { width: progressWidth },
            ]}
          />
        </View>

        {/* Spinning indicator */}
        <ActivityIndicator size="large" color="#4CAF50" style={styles.spinner} />

        {/* Loading text */}
        <Text style={styles.loadingText}>Generating your parenting tips...</Text>

        {/* Dynamic fact */}
        <View style={styles.factContainer}>
          <Icon name="lightbulb" size={16} color="#FFA726" style={styles.factIcon} />
          <Text style={styles.factText}>{currentFact}</Text>
        </View>

        {/* Estimated time */}
        <Text style={styles.timeText}>This should only take a moment</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1000,
  },
  loaderBox: {
    width: width * 0.85,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIcon: {
    marginRight: 12,
  },
  stageText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  progressContainer: {
    width: '100%',
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  spinner: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  factContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  factIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  factText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'left',
    fontStyle: 'italic',
    lineHeight: 20,
    flex: 1,
  },
  timeText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default Loader;
