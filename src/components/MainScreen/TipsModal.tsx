// src/components/TipsModal/TipsModal.tsx
import React, {
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  Keyboard,
  TouchableOpacity,
  View,
  Modal,
  ScrollView,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {fetchWithAuth} from '../../api/auth';
import {AuthContext} from '../../context/AuthContext';
import Sound from 'react-native-sound';
import {useCache} from '../../hooks/useCache';
import Icon from 'react-native-vector-icons/MaterialIcons';
import CardSkeleton from '../TipsModal/CardSkeleton';
import {BASE_URL} from '../../config';

interface Tip {
  id: number | string;
  title: string;
  body: string;
  details: string;
  audioUrl: string | null;
  categories?: string[];
  similarity_score?: number;
  query_relevance?: number;
  personal_match?: number;
  isGenerated?: boolean;
}

interface TipsModalProps {
  tips: Tip[];
  likedTips: Tip[];
  setLikedTips: (_arg0: Tip[]) => void;
  dislikedTips: Tip[];
  setDislikedTips: (_arg0: Tip[]) => void;
  showTipsModal: boolean;
  setShowTipsModal: (_arg0: boolean) => void;
  currentSound: React.MutableRefObject<Sound | null>;
  isOnline?: boolean;
  onDismiss?: () => void;
  topInset?: number;
}

const HEADER_HEIGHT = 60;

const TipsModal: React.FC<TipsModalProps> = ({
  tips,
  likedTips,
  setLikedTips,
  dislikedTips,
  setDislikedTips,
  showTipsModal,
  setShowTipsModal,
  currentSound,
  isOnline = true,
  onDismiss,
  topInset = 0,
}) => {
  const {width: windowWidth} = useWindowDimensions();
  const {userInfo} = useContext<any>(AuthContext);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeAudioKey, setActiveAudioKey] = useState<string | number | null>(
    null,
  );
  const [audioLoadingIndex, setAudioLoadingIndex] = useState<number | null>(
    null,
  );
  const {loadFromCache, saveToCache} = useCache();

  const tinyHash = (s: string) =>
    [...s].reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0).toString();

  const tipKey = (t: Tip) =>
    typeof t.id === 'number' && !t.isGenerated
      ? `db:${t.id}`
      : `ai:${tinyHash(`${t.title || ''}|${t.body || ''}|${t.details || ''}`)}`;

  const isTipLiked = (tip: Tip) =>
    likedTips.some(x => tipKey(x) === tipKey(tip));
  const isTipDisliked = (tip: Tip) =>
    dislikedTips.some(x => tipKey(x) === tipKey(tip));

  const setLikedCache = async (arr: Tip[]) => saveToCache('likedTips', arr);
  const setDislikedCache = async (arr: Tip[]) =>
    saveToCache('dislikedTips', arr);
  const modalTopInset =
    topInset || (Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0);
  const contentHorizontalPadding = windowWidth < 380 ? 12 : 16;

  const cleanupSound = () => {
    if (currentSound.current) {
      currentSound.current.stop();
      currentSound.current.release();
      currentSound.current = null;
    }
    setIsPlaying(false);
    setActiveAudioKey(null);
  };

  useEffect(() => {
    if (!showTipsModal) {
      cleanupSound();
    }
  }, [showTipsModal]);

  const speakTip = useCallback(
    async (tip: Tip) => {
      const key = tipKey(tip);

      // toggle stop
      if (activeAudioKey === key && isPlaying) {
        cleanupSound();
        setAudioLoadingIndex(null);
        return;
      }

      // stop any previous
      if (currentSound.current) {
        currentSound.current.stop();
        currentSound.current.release();
        currentSound.current = null;
      }
      setIsPlaying(false);
      setActiveAudioKey(key);

      try {
        let audioUrl = '';

        if (typeof tip.id === 'number') {
          const res = await fetchWithAuth(
            `${BASE_URL}/api/tips/audio/${tip.id}/generate`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${userInfo.access_token}`,
              },
            },
          );

          if (!res.ok) {throw new Error('Failed to generate audio');}
          const data = await res.json();
          audioUrl = `${BASE_URL}${data.audioUrl}`;
        } else {
          const res = await fetchWithAuth(
            `${BASE_URL}/api/tips/audio/generate-from-content`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${userInfo.access_token}`,
              },
              body: JSON.stringify({
                title: tip.title,
                body: tip.body,
                details: tip.details,
              }),
            },
          );

          if (!res.ok) {throw new Error('Failed to generate audio');}
          const data = await res.json();
          audioUrl = `${BASE_URL}${data.audioUrl}`;
        }

        if (!audioUrl) {
          throw new Error('No audio URL received');
        }

        currentSound.current = new Sound(audioUrl, '', err => {
          if (err) {
            console.error('Load sound error:', err);
            Alert.alert('Error', 'Failed to load audio. Please try again.');
            setIsPlaying(false);
            setActiveAudioKey(null);
            setAudioLoadingIndex(null);
            return;
          }

          setIsPlaying(true);
          setAudioLoadingIndex(null);

          currentSound.current?.play(success => {
            if (!success) {
              console.error('Playback failed');
              Alert.alert('Error', 'Audio playback failed. Please try again.');
            }
            setIsPlaying(false);
            setActiveAudioKey(null);
            currentSound.current?.release();
            currentSound.current = null;
            setAudioLoadingIndex(null);
          });
        });
      } catch (e) {
        console.error('Playback error:', e);
        Alert.alert('Error', 'Failed to play audio. Please try again.');
        setIsPlaying(false);
        setActiveAudioKey(null);
        setAudioLoadingIndex(null);
      }
    },
    [activeAudioKey, isPlaying, userInfo, currentSound],
  );

  const postInteraction = async (
    tip: Tip,
    interactionType: 'like' | 'dislike',
  ) => {
    const res = await fetchWithAuth(
      `${BASE_URL}/api/personalization/interactions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.access_token}`,
        },
        body: JSON.stringify({
          tipId: tip.id,
          interactionType,
          tipPayload:
            typeof tip.id !== 'number' ||
            String(tip.id).startsWith('generated_') ||
            tip.isGenerated
              ? {
                  title: tip.title,
                  body: tip.body,
                  details: tip.details,
                  categories: tip.categories || ['generated'],
                }
              : undefined,
        }),
      },
    );
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new Error(msg || `Failed to post ${interactionType}`);
    }
  };

  const queueAIInteraction = async (tip: Tip, reaction: 'like' | 'dislike') => {
    const key = tipKey(tip);
    const queued = (await loadFromCache('aiReactionsQueue')) ?? [];
    const entry = {
      key,
      reaction,
      tipId: tip.id,
      tipPayload: {
        title: tip.title,
        body: tip.body,
        details: tip.details,
        categories: tip.categories || ['generated'],
      },
      at: Date.now(),
    };
    await saveToCache('aiReactionsQueue', [entry, ...queued]);
  };

  const setReaction = async (tip: Tip, reaction: 'like' | 'dislike') => {
    const prevLiked = likedTips;
    const prevDisliked = dislikedTips;
    const sameKey = (a: Tip, b: Tip) => tipKey(a) === tipKey(b);

    try {
      if (reaction === 'like') {
        const nextLikes = isTipLiked(tip) ? likedTips : [tip, ...likedTips];
        const nextDislikes = dislikedTips.filter(t => !sameKey(t, tip));
        setLikedTips(nextLikes);
        setDislikedTips(nextDislikes);
        await Promise.all([
          setLikedCache(nextLikes),
          setDislikedCache(nextDislikes),
        ]);
      } else {
        const nextDislikes = isTipDisliked(tip)
          ? dislikedTips
          : [tip, ...dislikedTips];
        const nextLikes = likedTips.filter(t => !sameKey(t, tip));
        setDislikedTips(nextDislikes);
        setLikedTips(nextLikes);
        await Promise.all([
          setDislikedCache(nextDislikes),
          setLikedCache(nextLikes),
        ]);
      }

      try {
        await postInteraction(tip, reaction);
      } catch {
        await queueAIInteraction(tip, reaction);
      }

      // Sync community like/unlike for DB tips (non-generated, integer id)
      if (!tip.isGenerated && typeof tip.id === 'number') {
        if (reaction === 'like' && !isTipLiked(tip)) {
          fetchWithAuth(`${BASE_URL}/api/tips/${tip.id}/like`, {method: 'POST'}).catch(() => {});
        } else if (reaction === 'dislike' && isTipLiked(tip)) {
          fetchWithAuth(`${BASE_URL}/api/tips/${tip.id}/unlike`, {method: 'DELETE'}).catch(() => {});
        }
      }
    } catch (e) {
      console.error(e);
      setLikedTips(prevLiked);
      setDislikedTips(prevDisliked);
      Alert.alert(
        'Error',
        'Could not update your preference. Please try again.',
      );
    }
  };

  return (
    <Modal
      visible={showTipsModal}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'fullScreen' : undefined}
      onShow={() => Keyboard.dismiss()}
      onDismiss={Platform.OS === 'ios' ? onDismiss : undefined}
      onRequestClose={() => {
        setShowTipsModal(false);
        if (Platform.OS === 'android' && onDismiss) {
          onDismiss();
        }
      }}>
      <View style={[styles.modalContainer, {paddingTop: modalTopInset}]}>
        {/* HEADER */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle} numberOfLines={1}>
            Personalized Advice
          </Text>
          <TouchableOpacity
            style={styles.closeModalButton}
            hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
            activeOpacity={0.7}
            onPress={() => {
              console.log('Close button pressed');
              setShowTipsModal(false);
            }}>
            <MaterialIcons name="close" size={28} color="#333" />
          </TouchableOpacity>
        </View>

        {/* OFFLINE BANNER */}
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <MaterialIcons name="wifi-off" size={20} color="#FF9800" />
            <Text style={styles.offlineBannerText}>
              You're offline. Showing popular tips.
            </Text>
          </View>
        )}

        {/* CONTENT */}
        <ScrollView
          style={[
            styles.modalContent,
            {paddingHorizontal: contentHorizontalPadding},
          ]}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={{paddingBottom: 28}}
          showsVerticalScrollIndicator={false}>
          {tips.length > 0 &&
            tips.map((tip, index) => {
              const key = tipKey(tip);

              return (
                <View key={`tip-${key}`} style={styles.tipItem}>
                  <View style={styles.tipCardShadow}>
                    <LinearGradient
                      colors={['#ffffff', '#f8f9fa']}
                      style={styles.tipGradient}>
                      <View style={styles.tipHeader}>
                        <MaterialIcons
                          name="auto-awesome"
                          size={24}
                          color="#8B5CF6"
                          style={{marginRight: 12}}
                        />
                        <Text style={styles.tipTitle}>{tip.title || ''}</Text>
                      </View>

                      <Text style={styles.tipBody}>{tip.body || ''}</Text>
                      <Text style={styles.tipDetails}>
                        {tip.details || ''}
                      </Text>

                      <View style={styles.tipActions}>
                        <TouchableOpacity
                          style={[
                            styles.playButton,
                            activeAudioKey === key &&
                              isPlaying &&
                              styles.stopButton,
                          ]}
                          onPress={() => {
                            if (activeAudioKey === key && isPlaying) {
                              setAudioLoadingIndex(null);
                              cleanupSound();
                            } else {
                              setAudioLoadingIndex(index);
                              speakTip(tip);
                            }
                          }}
                          disabled={audioLoadingIndex === index}>
                          {audioLoadingIndex === index ? (
                            <ActivityIndicator color="white" size="small" />
                          ) : (
                            <Icon
                              name={
                                activeAudioKey === key && isPlaying
                                  ? 'stop'
                                  : 'play-arrow'
                              }
                              size={16}
                              color="white"
                            />
                          )}
                          <Text style={styles.playButtonText}>
                            {audioLoadingIndex === index
                              ? 'Loading...'
                              : activeAudioKey === key && isPlaying
                              ? 'Stop'
                              : 'Play'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.iconReactionButton}
                          onPress={() => {
                            setReaction(tip, 'like');
                          }}>
                          <MaterialIcons
                            name={
                              isTipLiked(tip) ? 'favorite' : 'favorite-border'
                            }
                            size={22}
                            color={isTipLiked(tip) ? '#FF3B30' : '#999'}
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.iconReactionButton,
                            {opacity: tip.isGenerated ? 0.4 : 1},
                          ]}
                          onPress={() => setReaction(tip, 'dislike')}>
                          <MaterialIcons
                            name={
                              isTipDisliked(tip)
                                ? 'thumb-down'
                                : 'thumb-down-off-alt'
                            }
                            size={22}
                            color={isTipDisliked(tip) ? '#8B5CF6' : '#999'}
                          />
                        </TouchableOpacity>
                      </View>
                    </LinearGradient>
                  </View>
                </View>
              );
            })}

          {tips.length === 0 && <CardSkeleton />}
          {tips.length === 0 && <CardSkeleton />}
          {tips.length === 0 && <CardSkeleton />}
          <View style={{height: 20}} />
        </ScrollView>
      </View>
    </Modal>
  );
};

export default TipsModal;

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  modalTitle: {
    fontSize: Platform.select({ios: 18, android: 16, default: 16}),
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  closeModalButton: {
    padding: 8,
  },
  offlineBanner: {
    backgroundColor: '#FFF3E0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
  },
  offlineBannerText: {
    fontSize: 14,
    color: '#E65100',
    fontWeight: '500',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // tips
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
  iconReactionButton: {
    marginLeft: Platform.select({ios: 8, android: 6, default: 6}),
    padding: Platform.select({ios: 6, android: 5, default: 5}),
  },
});
