import React, {useCallback, useContext, useEffect, useRef, useState} from 'react';
import {
  Modal,
  View,
  SafeAreaView,
  TouchableOpacity,
  Text,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Sound from 'react-native-sound';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {fetchWithAuth} from '../../api/auth';
import {AuthContext} from '../../context/AuthContext';
import {BASE_URL} from '../../config';

interface Tip {
  id: number;
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

interface LikedTipsModal {
  likedTips: Tip[];
  showLikedTipsModal: boolean;
  setShowLikedTipsModal: (_arg0: boolean) => void;
}

const LikedTipsModal: React.FC<LikedTipsModal> = ({
  likedTips,
  showLikedTipsModal,
  setShowLikedTipsModal,
}) => {
  const {userInfo} = useContext<any>(AuthContext);
  const currentSound = useRef<any>(null);
  const [activeAudioKey, setActiveAudioKey] = useState<string | number | null>(
    null,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoadingIndex, setAudioLoadingIndex] = useState<number | null>(
    null,
  );

  //   const audioCache = useRef<Map<string, string>>(new Map());

  const tinyHash = (s: string) =>
    [...s].reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0).toString();
  const tipKey = (t: Tip) =>
    typeof t.id === 'number' && !t.isGenerated
      ? `db:${t.id}`
      : `ai:${tinyHash(`${t.title || ''}|${t.body || ''}|${t.details || ''}`)}`;

  useEffect(() => {
    cleanupSound();
  }, [showLikedTipsModal]);

  const speakTip = useCallback(
    async (tip: Tip) => {
      const key = tipKey(tip);

      if (activeAudioKey === key && isPlaying) {
        cleanupSound();
        setAudioLoadingIndex(null);
        return;
      }

      if (currentSound.current) {
        currentSound.current.stop();
        currentSound.current.release();
        currentSound.current = null;
      }
      setIsPlaying(false);
      setActiveAudioKey(key);

      try {
        let audioUrl = '';

        if (typeof tip.id === 'number' && !tip.isGenerated) {
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

        if (!audioUrl) {throw new Error('No audio URL received');}

        currentSound.current = new Sound(audioUrl, '', err => {
          if (err) {
            console.error('load sound error', err);
            Alert.alert('Error', 'Failed to load audio. Please try again.');
            setIsPlaying(false);
            setActiveAudioKey(null);
            setAudioLoadingIndex(null);
            return;
          }
          setIsPlaying(true);
          setAudioLoadingIndex(null);
          currentSound.current?.play((success: any) => {
            if (!success) {
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
        console.error('playback error', e);
        Alert.alert('Error', 'Failed to play audio. Please try again.');
        setIsPlaying(false);
        setActiveAudioKey(null);
        setAudioLoadingIndex(null);
      }
    },
    [activeAudioKey, isPlaying, userInfo],
  );

  const cleanupSound = () => {
    if (currentSound.current) {
      currentSound.current.stop();
      currentSound.current.release();
      currentSound.current = null;
    }
    setIsPlaying(false);
    setActiveAudioKey(null);
  };

  return (
    <Modal
      visible={showLikedTipsModal}
      animationType="slide"
      presentationStyle="pageSheet">
      <SafeAreaView style={{flex: 1, backgroundColor: '#f0f2f5'}}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: Platform.select({ios: 20, android: 16, default: 16}),
            paddingVertical: Platform.select({ios: 16, android: 12, default: 12}),
            backgroundColor: 'white',
            borderBottomWidth: 1,
            borderBottomColor: '#E8E8E8',
          }}>
          <Text style={{fontSize: Platform.select({ios: 20, android: 18, default: 18}), fontWeight: 'bold', color: '#333'}}>
            Liked Tips ({likedTips.length})
          </Text>
          <TouchableOpacity
            style={{padding: Platform.select({ios: 8, android: 6, default: 6})}}
            onPress={() => setShowLikedTipsModal(false)}>
            <Icon name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>
        <ScrollView
          style={{
            flex: 1,
            paddingHorizontal: Platform.select({ios: 16, android: 14, default: 14}),
            paddingTop: Platform.select({ios: 16, android: 12, default: 12}),
          }}
          showsVerticalScrollIndicator={false}>
          {likedTips.length > 0 ? (
            likedTips.map((tip, index) => {
              const key = tipKey(tip);
              return (
                <View key={tip.id} style={{marginBottom: Platform.select({ios: 16, android: 12, default: 12})}}>
                  <LinearGradient
                    colors={['#ffffff', '#f8f9fa']}
                    style={{
                      borderRadius: Platform.select({ios: 16, android: 14, default: 14}),
                      padding: Platform.select({ios: 20, android: 14, default: 14}),
                    }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: Platform.select({ios: 12, android: 8, default: 8}),
                      }}>
                      <Icon
                        name="lightbulb"
                        size={24}
                        color="#FFA726"
                        style={{marginRight: Platform.select({ios: 12, android: 10, default: 10})}}
                      />
                      <Text
                        style={{
                          fontSize: Platform.select({ios: 18, android: 16, default: 16}),
                          fontWeight: 'bold',
                          color: '#333',
                          flex: 1,
                        }}>
                        {tip.title || ''}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: Platform.select({ios: 16, android: 14, default: 14}),
                        color: '#444',
                        lineHeight: Platform.select({ios: 24, android: 20, default: 20}),
                        marginBottom: Platform.select({ios: 12, android: 8, default: 8}),
                      }}>
                      {tip.body || ''}
                    </Text>
                    <Text
                      style={{
                        fontSize: Platform.select({ios: 14, android: 12, default: 12}),
                        color: '#666',
                        lineHeight: Platform.select({ios: 20, android: 18, default: 18}),
                        marginBottom: Platform.select({ios: 16, android: 12, default: 12}),
                      }}>
                      {tip.details || ''}
                    </Text>
                    <View style={{flexDirection: 'row', marginTop: Platform.select({ios: 12, android: 8, default: 8})}}>
                      <TouchableOpacity
                        style={[
                          {
                            paddingVertical: Platform.select({ios: 8, android: 7, default: 7}),
                            paddingHorizontal: Platform.select({ios: 12, android: 10, default: 10}),
                            borderRadius: Platform.select({ios: 6, android: 5, default: 5}),
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: 1,
                          },
                          isPlaying && activeAudioKey === key
                            ? {backgroundColor: '#FF3B30'}
                            : {backgroundColor: '#3B82F6'},
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
                        <Text
                          style={{
                            color: 'white',
                            fontSize: 12,
                            fontWeight: '600',
                            marginLeft: 4,
                          }}>
                          {audioLoadingIndex === index
                            ? 'Loading...'
                            : activeAudioKey === key && isPlaying
                            ? 'Stop'
                            : 'Play'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                </View>
              );
            })
          ) : (
            <View
              style={{
                alignItems: 'center',
                paddingVertical: Platform.select({ios: 40, android: 28, default: 28}),
                paddingHorizontal: Platform.select({ios: 20, android: 16, default: 16}),
              }}>
              <Icon name="favorite-border" size={64} color="#ccc" />
              <Text
                style={{
                  fontSize: Platform.select({ios: 18, android: 16, default: 16}),
                  fontWeight: '600',
                  color: '#999',
                  marginTop: Platform.select({ios: 16, android: 12, default: 12}),
                }}>
                No Liked Tips
              </Text>
              <Text
                style={{
                  fontSize: Platform.select({ios: 14, android: 12, default: 12}),
                  color: '#ccc',
                  textAlign: 'center',
                  marginTop: 8,
                  lineHeight: Platform.select({ios: 20, android: 18, default: 18}),
                }}>
                Like tips by tapping the heart icon on any tip
              </Text>
            </View>
          )}
          <View style={{height: 20}} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

export default LikedTipsModal;
