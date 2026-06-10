import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {NavigationProp} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

interface AboutScreenProps {
  navigation: NavigationProp<any>;
}

const FEATURES = [
  {
    icon: <Ionicons name="location-outline" size={22} color="#6366F1" />,
    title: 'Location-Based Tips',
    description:
      'Get parenting advice the moment you arrive at places like parks, grocery stores, and libraries.',
  },
  {
    icon: <Icon name="child-care" size={22} color="#6366F1" />,
    title: 'Age-Appropriate Guidance',
    description:
      "Tips tailored to your child's exact developmental stage — always relevant, never generic.",
  },
  {
    icon: <Icon name="mic-none" size={22} color="#6366F1" />,
    title: 'Voice Assistance',
    description:
      'Ask parenting questions hands-free and get instant AI-powered answers.',
  },
  {
    icon: <Ionicons name="notifications-outline" size={22} color="#6366F1" />,
    title: 'Custom Reminders',
    description:
      'Schedule day-and-time reminders to keep routines on track for your family.',
  },
  {
    icon: <Icon name="security" size={22} color="#6366F1" />,
    title: 'Privacy-Focused',
    description:
      "Your family's data is used only to personalize your experience — never shared or sold.",
  },
];

const QA_ITEMS = [
  {
    category: 'Getting Started',
    icon: 'info-outline',
    color: '#10B981',
    items: [
      {
        q: 'What is ENACT?',
        a: 'ENACT is a free parent companion app that delivers quick, research-informed parenting tips tailored to your child\'s age, your location, and your chosen learning areas — language development, early science, literacy, and social-emotional learning.',
      },
      {
        q: 'Who is ENACT for?',
        a: 'Any caregiver of a child aged 0–5: parents, grandparents, teachers, daycare workers, and early childhood professionals.',
      },
      {
        q: 'Can I use ENACT without adding a child?',
        a: 'Yes. You can still ask the companion questions and receive general tips, but adding a child\'s nickname and age makes tips significantly more specific and useful.',
      },
      {
        q: 'I forgot my password. What do I do?',
        a: 'Tap "Forgot Password?" on the login screen and enter your email. You will receive a reset link within a few minutes.',
      },
    ],
  },
  {
    category: 'Content Preferences',
    icon: 'tune',
    color: '#8B5CF6',
    items: [
      {
        q: 'What are Content Preferences?',
        a: 'Content Preferences are the four learning domains ENACT focuses on:\n• Language Development — vocabulary, communication, storytelling\n• Early Science Skills — exploration, nature, curiosity, experiments\n• Literacy Foundations — reading, books, letters, phonics\n• Social-Emotional Learning — emotions, empathy, friendships, self-regulation',
      },
      {
        q: 'Do I have to pick just one preference?',
        a: 'No. You can select any combination of the four domains. All tips returned are always aligned with your selected content preferences.',
      },
      {
        q: 'Where do I change my preferences?',
        a: 'Go to Settings → Content Preferences, or tap any tile on the Content Preferences card on the Home screen. Changes take effect on your next search.',
      },
      {
        q: 'Why are tips always aligned with my content preferences?',
        a: 'By design — every tip ENACT returns is filtered and sorted according to your selected content preferences. All results reflect the learning domains you have chosen, so you never see off-topic advice.',
      },
    ],
  },
  {
    category: 'Ask your Companion',
    icon: 'chat-bubble-outline',
    color: '#3B82F6',
    items: [
      {
        q: 'How do I ask for parenting tips?',
        a: 'Type or speak a question in the "Ask your companion" card and tap "Get Parenting Advice." The recommended format is:\n\nTips for [CHILD\'S NAME] at [ACTIVITY / PLACE]\n\nExample: "Tips for Emma at the grocery store."',
      },
      {
        q: 'What is the ⓘ button on the companion card?',
        a: 'Tapping the ⓘ (info) icon opens the Hint Panel, which shows:\n• The recommended question format\n• Four example queries you can tap to pre-fill the input\n• The complete list of all supported activities, grouped by category',
      },
      {
        q: 'Do I need to mention the learning area in my question?',
        a: 'No. ENACT uses your Content Preferences automatically. Just describe the activity or place — for example, "Tips for Liam during bath time."',
      },
      {
        q: 'Can I use voice input?',
        a: 'Yes. Tap the microphone icon inside the input field to speak your question. ENACT transcribes your speech and submits it when you stop talking. Tap the mic again to cancel.',
      },
      {
        q: 'What do the Like and Dislike buttons do?',
        a: 'Like (♡) saves the tip to your Liked Tips list and signals ENACT to surface similar content in future. Dislike (👎) tells ENACT to avoid similar tips. Both actions sync to the server to improve your personal recommendations.',
      },
      {
        q: 'Can I listen to tips instead of reading them?',
        a: 'Yes. Each tip card has a ▶ Play button that generates an AI audio read-aloud. Tap Stop at any time to end playback.',
      },
      {
        q: 'What topics is ENACT NOT able to help with?',
        a: 'ENACT focuses on child development activities for ages 0–5 and cannot provide medical advice, legal or financial guidance, or adult relationship counselling. Questions outside the four learning domains will receive an out-of-scope notice.',
      },
    ],
  },
  {
    category: 'Supported Activities',
    icon: 'local-activity',
    color: '#F59E0B',
    items: [
      {
        q: 'What activities does ENACT support?',
        a: 'ENACT supports 47 activities across 7 categories:\n• Play time — puzzles, blocks, pretend play, games, sports, screen time, and more\n• Personal care — bath time, bed time, diapering, brushing teeth, and more\n• Outdoor play — swinging, sliding, water play, ride-ons, playing ball\n• Eating & drinking — meals, snacks, bottle time, water breaks\n• Outings — walks, car rides, shopping, visiting family, library trips\n• Household chores — laundry, picking up toys, wiping tables, and more\n• Books & literacy — reading together, board books, talking about pictures',
      },
      {
        q: 'Where can I see the full activity list inside the app?',
        a: 'Two places:\n1. Tap the ⓘ icon on the companion card → scroll to "ALL SUPPORTED ACTIVITIES."\n2. Tap "View Activities" in any out-of-scope alert to open the full Activities screen.',
      },
      {
        q: 'What if my activity isn\'t on the list?',
        a: 'You can suggest it. Open the Activities screen, switch to the "Add Activity" tab, type the activity name, and tap "Submit for Review." An AI check runs first; if the activity is a recognized child development activity (ages 0–5), an admin will review and approve it.',
      },
      {
        q: 'How long does an activity submission take to be approved?',
        a: 'Submissions are reviewed by an admin after automated validation. There is no set timeline, but approved activities appear in the list for all users once accepted.',
      },
    ],
  },
  {
    category: 'Locations & Privacy',
    icon: 'location-on',
    color: '#6366F1',
    items: [
      {
        q: 'How do I add a location?',
        a: 'Tap the search bar ("Find nearby locations…") on the Home screen to open the map. Search for a place by name or address, tap to pin it, choose a location type, enter a name and short description, then tap "Add Location."',
      },
      {
        q: 'Can I save my home as a location?',
        a: "Saving your home is discouraged. It compromises your privacy and means you'll receive tip notifications every time you walk in your front door. ENACT is designed for out-and-about moments: parks, grocery stores, libraries, restaurants.",
      },
      {
        q: "Why is there no 'Home' option in the location type dropdown?",
        a: "It's intentionally omitted to steer users toward locations where in-the-moment parenting tips are genuinely useful. If you want to label a relative's or friend's place, choose \"Other's Home\" instead.",
      },
      {
        q: 'How does ENACT use my location data?',
        a: 'Your location is used only to detect when you arrive at a saved spot and trigger relevant tips. It is never shared with third parties or used for advertising.',
      },
    ],
  },
  {
    category: 'Notifications',
    icon: 'notifications-none',
    color: '#EC4899',
    items: [
      {
        q: 'Why am I not receiving location-based notifications?',
        a: 'Several things can prevent location-based notifications from arriving:\n\n• Location permission is not set to "Always" (background access). Go to your device Settings → Apps → ENACT → Permissions → Location and choose "Allow all the time." On Android 12 and later, this must be done manually in Settings — the app cannot request it for you.\n\n• Notifications are disabled for the app. Check Settings → Apps → ENACT → Notifications and make sure they are turned on.\n\n• Battery optimization is blocking background activity. In Settings → Battery, look for an option like "Unrestricted" or "Don\'t optimize" for ENACT so the app can run in the background.\n\n• Location services (GPS) are turned off or set to low accuracy. Make sure Location is enabled on your device and set to "High accuracy" or "Device only" mode.\n\n• You may not have actually entered or exited a saved location area yet. Notifications only fire when the app detects you are within roughly 100 metres of a saved spot.\n\n• The app may need to be reopened after you add a new saved location. Close and reopen ENACT once after adding a location so the background check can register it.\n\n• Poor GPS or network signal can delay location detection. Move to an area with a clearer signal and wait a moment.\n\nIf notifications still do not arrive after checking all of the above, try force-stopping ENACT and reopening it, then walk within range of a saved location.',
      },
      {
        q: 'How do I set up reminder notifications?',
        a: 'Go to Settings → Reminder Settings. Enable general reminders and add specific day + time slots (e.g. Monday at 9:00 AM).',
      },
      {
        q: 'My scheduled reminder did not arrive on time.',
        a: 'On iOS, the system can delay notifications when battery optimization is active. Ensure notifications are fully enabled for ENACT in device settings. On Android 12+, the app also requires the "Schedule Exact Alarm" permission for reliable reminders.',
      },
    ],
  },
  {
    category: 'Offline & Connectivity',
    icon: 'wifi-off',
    color: '#EF4444',
    items: [
      {
        q: 'Does the app work without internet?',
        a: 'Yes. ENACT includes an offline mode with pre-loaded popular tips available without a connection. A banner indicates when you are offline. Like/dislike reactions made offline are queued and synced automatically when connectivity is restored.',
      },
      {
        q: 'The app shows offline tips even though I have internet.',
        a: 'Pull to refresh the Home screen or close and reopen the app to re-establish the server connection.',
      },
      {
        q: 'Tips are loading very slowly.',
        a: 'Tips are generated in real time using AI and typically take 5–15 seconds. If the spinner runs for more than 30 seconds, tap "Cancel," check your connection, and try again.',
      },
      {
        q: 'I see an "out of scope" message. What does that mean?',
        a: 'Your question falls outside ENACT\'s four learning domains or the supported activity list. Rephrase using a supported activity (tap the ⓘ icon for the full list) and make sure the question relates to child development for ages 0–5.',
      },
    ],
  },
  {
    category: 'Account & Settings',
    icon: 'person-outline',
    color: '#0EA5E9',
    items: [
      {
        q: 'Can I add multiple children?',
        a: 'Yes. Go to Settings → Children Information and use the Add Child flow to add each child\'s nickname and date of birth.',
      },
      {
        q: 'How do I set up or change reminders?',
        a: 'Go to Settings → Reminder Settings to choose the time and frequency of push notifications that prompt you to ask for a tip.',
      },
      {
        q: 'What is the Personalization Survey?',
        a: 'A short survey (Settings → Personalization Survey) that captures your parenting style and priorities. Completing it helps ENACT generate tips that are even more relevant to your family.',
      },
      {
        q: 'Where can I see tips I\'ve liked?',
        a: 'Go to Settings → View Liked Tips to review every tip you have saved with the heart icon.',
      },
      {
        q: 'What happens if I delete my account?',
        a: "All your data is permanently removed — children's profiles, saved locations, liked tips, and preferences. This action cannot be undone.",
      },
    ],
  },
  {
    category: 'Privacy & Data',
    icon: 'security',
    color: '#14B8A6',
    items: [
      {
        q: 'Does ENACT share my data?',
        a: 'No. ENACT does not share or sell user data. All data is stored on UF-managed servers in accordance with university security policies.',
      },
      {
        q: 'What data does ENACT collect?',
        a: 'ENACT stores your account email, children\'s nicknames and ages, saved location coordinates, tip like/dislike history, and survey responses. No precise GPS tracking is performed in the background.',
      },
      {
        q: 'Who do I contact about a privacy concern?',
        a: 'Email talkaroundtownuf@gmail.com or visit https://enact.rc.ufl.edu.',
      },
    ],
  },
];

const AccordionItem: React.FC<{q: string; a: string}> = ({q, a}) => {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(prev => !prev);
  };

  return (
    <TouchableOpacity
      style={styles.accordionItem}
      onPress={toggle}
      activeOpacity={0.7}>
      <View style={styles.accordionHeader}>
        <Text style={styles.accordionQuestion}>{q}</Text>
        <Icon
          name={open ? 'expand-less' : 'expand-more'}
          size={22}
          color="#6366F1"
        />
      </View>
      {open && <Text style={styles.accordionAnswer}>{a}</Text>}
    </TouchableOpacity>
  );
};

const AboutScreen: React.FC<AboutScreenProps> = ({navigation}) => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'about' | 'qa'>('about');

  return (
    <LinearGradient
      colors={['#3B82F6', '#8B5CF6']}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={{flex: 1}}>
      <View style={{flex: 1, marginTop: insets.top + 5}}>
        <StatusBar barStyle="light-content" translucent backgroundColor="#4A90E2" />

        {/* Header */}
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>About ENACT</Text>
          <View style={styles.placeholderView} />
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'about' && styles.tabActive]}
            onPress={() => setActiveTab('about')}>
            <Text style={[styles.tabText, activeTab === 'about' && styles.tabTextActive]}>
              About
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'qa' && styles.tabActive]}
            onPress={() => setActiveTab('qa')}>
            <Text style={[styles.tabText, activeTab === 'qa' && styles.tabTextActive]}>
              FAQ
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {activeTab === 'about' ? (
            <>
              {/* Hero */}
              <View style={styles.heroCard}>
                <Text style={styles.tagline}>Parenting Tips When & Where You Need Them</Text>
                <Text style={styles.description}>
                  ENACT is your personalized parenting companion that delivers age-appropriate
                  guidance precisely when and where you need it most — combining location
                  awareness with expert advice to support your journey through parenthood.
                </Text>
              </View>

              {/* Features */}
              <Text style={styles.sectionHeader}>Key Features</Text>
              {FEATURES.map((f, i) => (
                <View key={i} style={styles.featureCard}>
                  <View style={styles.featureIconWrap}>{f.icon}</View>
                  <View style={styles.featureContent}>
                    <Text style={styles.featureTitle}>{f.title}</Text>
                    <Text style={styles.featureDescription}>{f.description}</Text>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <>
              <Text style={styles.qaIntro}>
                Tap any question to expand the answer.
              </Text>
              {QA_ITEMS.map((section, si) => (
                <View key={si}>
                  <View style={styles.categoryHeader}>
                    <Icon name={section.icon as any} size={18} color={section.color} />
                    <Text style={[styles.categoryTitle, {color: section.color}]}>
                      {section.category}
                    </Text>
                  </View>
                  <View style={styles.accordionCard}>
                    {section.items.map((item, ii) => (
                      <React.Fragment key={ii}>
                        <AccordionItem q={item.q} a={item.a} />
                        {ii < section.items.length - 1 && <View style={styles.divider} />}
                      </React.Fragment>
                    ))}
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Platform.select({ios: 20, android: 16, default: 16}),
    paddingBottom: Platform.select({ios: 12, android: 8, default: 8}),
  },
  backButton: {
    padding: Platform.select({ios: 8, android: 6, default: 6}),
  },
  headerTitle: {
    fontSize: Platform.select({ios: 20, android: 18, default: 18}),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  placeholderView: {
    width: 40,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: Platform.select({ios: 12, android: 10, default: 10}),
    padding: Platform.select({ios: 4, android: 3, default: 3}),
    marginBottom: Platform.select({ios: 12, android: 8, default: 8}),
  },
  tab: {
    flex: 1,
    paddingVertical: Platform.select({ios: 9, android: 7, default: 7}),
    borderRadius: Platform.select({ios: 10, android: 8, default: 8}),
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: Platform.select({ios: 15, android: 13, default: 13}),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  tabTextActive: {
    color: '#6366F1',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Platform.select({ios: 16, android: 14, default: 14}),
    paddingBottom: Platform.select({ios: 36, android: 28, default: 28}),
  },
  // About tab
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Platform.select({ios: 16, android: 14, default: 14}),
    padding: Platform.select({ios: 20, android: 16, default: 16}),
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  tagline: {
    fontSize: Platform.select({ios: 20, android: 18, default: 18}),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: Platform.select({ios: 12, android: 8, default: 8}),
    textAlign: 'center',
  },
  description: {
    fontSize: Platform.select({ios: 15, android: 14, default: 14}),
    color: '#4B5563',
    lineHeight: Platform.select({ios: 23, android: 20, default: 20}),
    textAlign: 'center',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 4,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: Platform.select({ios: 14, android: 12, default: 12}),
    padding: Platform.select({ios: 16, android: 12, default: 12}),
    marginBottom: Platform.select({ios: 10, android: 8, default: 8}),
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  featureIconWrap: {
    width: Platform.select({ios: 40, android: 36, default: 36}),
    height: Platform.select({ios: 40, android: 36, default: 36}),
    borderRadius: Platform.select({ios: 10, android: 9, default: 9}),
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Platform.select({ios: 14, android: 10, default: 10}),
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: Platform.select({ios: 15, android: 14, default: 14}),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: Platform.select({ios: 13, android: 12, default: 12}),
    color: '#6B7280',
    lineHeight: Platform.select({ios: 19, android: 17, default: 17}),
  },
  // Q&A tab
  qaIntro: {
    fontSize: Platform.select({ios: 13, android: 12, default: 12}),
    color: 'rgba(255,255,255,0.75)',
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
    marginLeft: 4,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginLeft: 4,
    gap: 6,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  accordionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Platform.select({ios: 14, android: 12, default: 12}),
    marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  accordionItem: {
    padding: Platform.select({ios: 16, android: 12, default: 12}),
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  accordionQuestion: {
    flex: 1,
    fontSize: Platform.select({ios: 14, android: 13, default: 13}),
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: Platform.select({ios: 20, android: 18, default: 18}),
  },
  accordionAnswer: {
    marginTop: Platform.select({ios: 10, android: 8, default: 8}),
    fontSize: Platform.select({ios: 13, android: 12, default: 12}),
    color: '#6B7280',
    lineHeight: Platform.select({ios: 20, android: 18, default: 18}),
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  },
});

export default AboutScreen;
