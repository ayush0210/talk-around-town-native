import React, {useCallback, useRef, useState} from 'react';
import {
  Modal,
  View,
  SafeAreaView,
  TouchableOpacity,
  Text,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useAudioRecording} from '../../context/AudioRecordingContext';
import {audioRecordingService} from '../../services/AudioRecordingService';
import {RecordingSession} from '../../types';

interface RecordingsListModalProps {
  visible: boolean;
  onClose: () => void;
}

const RecordingsListModal: React.FC<RecordingsListModalProps> = ({
  visible,
  onClose,
}) => {
  const {savedRecordings, deleteRecording, formatDuration, refreshRecordings} =
    useAudioRecording();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState<number>(0);
  const [playbackDuration, setPlaybackDuration] = useState<number>(0);
  const playbackRef = useRef<boolean>(false);

  const handleClose = useCallback(() => {
    if (playingId) {
      audioRecordingService.stopPlayback();
      audioRecordingService.removePlayBackListener();
      setPlayingId(null);
    }
    onClose();
  }, [playingId, onClose]);

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handlePlayPause = useCallback(
    async (recording: RecordingSession) => {
      if (playingId === recording.id) {
        await audioRecordingService.stopPlayback();
        audioRecordingService.removePlayBackListener();
        setPlayingId(null);
        setPlaybackPosition(0);
        playbackRef.current = false;
        return;
      }

      if (playingId) {
        await audioRecordingService.stopPlayback();
        audioRecordingService.removePlayBackListener();
      }

      try {
        setIsLoading(recording.id);
        playbackRef.current = true;

        audioRecordingService.addPlayBackListener(e => {
          if (!playbackRef.current) {return;}
          setPlaybackPosition(Math.floor(e.currentPosition / 1000));
          setPlaybackDuration(Math.floor(e.duration / 1000));

          if (e.currentPosition >= e.duration - 100) {
            audioRecordingService.stopPlayback();
            audioRecordingService.removePlayBackListener();
            setPlayingId(null);
            setPlaybackPosition(0);
            playbackRef.current = false;
          }
        });

        await audioRecordingService.playRecording(recording.filePath);
        setPlayingId(recording.id);
      } catch (error) {
        Alert.alert('Error', 'Failed to play recording');
        playbackRef.current = false;
      } finally {
        setIsLoading(null);
      }
    },
    [playingId],
  );

  const handleDelete = useCallback(
    (recording: RecordingSession) => {
      Alert.alert(
        'Delete Recording',
        'Are you sure you want to delete this recording? This cannot be undone.',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              if (playingId === recording.id) {
                await audioRecordingService.stopPlayback();
                audioRecordingService.removePlayBackListener();
                setPlayingId(null);
              }
              await deleteRecording(recording.id);
            },
          },
        ],
      );
    },
    [playingId, deleteRecording],
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            Recordings ({savedRecordings.length})
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Icon name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}>
          {savedRecordings.length > 0 ? (
            savedRecordings.map(recording => (
              <View key={recording.id} style={styles.recordingItem}>
                <LinearGradient
                  colors={['#ffffff', '#f8f9fa']}
                  style={styles.recordingCard}>
                  <View style={styles.recordingHeader}>
                    <Icon
                      name="mic"
                      size={24}
                      color="#6366F1"
                      style={styles.micIcon}
                    />
                    <View style={styles.recordingInfo}>
                      <Text style={styles.recordingDate}>
                        {formatDate(recording.startTime)}
                      </Text>
                      <Text style={styles.recordingDuration}>
                        Duration: {formatDuration(recording.duration)}
                      </Text>
                    </View>
                  </View>

                  {recording.location && (
                    <View style={styles.locationContainer}>
                      <Icon
                        name="location-on"
                        size={16}
                        color="#666"
                        style={styles.locationIcon}
                      />
                      <Text style={styles.locationText}>
                        {recording.location.locationName ||
                          `${recording.location.latitude.toFixed(4)}, ${recording.location.longitude.toFixed(4)}`}
                      </Text>
                    </View>
                  )}

                  {playingId === recording.id && (
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${playbackDuration > 0 ? (playbackPosition / playbackDuration) * 100 : 0}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.progressText}>
                        {formatDuration(playbackPosition)} /{' '}
                        {formatDuration(playbackDuration)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[
                        styles.playButton,
                        playingId === recording.id && styles.stopButton,
                      ]}
                      onPress={() => handlePlayPause(recording)}
                      disabled={isLoading === recording.id}>
                      {isLoading === recording.id ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : (
                        <Icon
                          name={
                            playingId === recording.id ? 'stop' : 'play-arrow'
                          }
                          size={20}
                          color="white"
                        />
                      )}
                      <Text style={styles.buttonText}>
                        {isLoading === recording.id
                          ? 'Loading...'
                          : playingId === recording.id
                            ? 'Stop'
                            : 'Play'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDelete(recording)}>
                      <Icon name="delete" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Icon name="folder-open" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No Recordings</Text>
              <Text style={styles.emptyText}>
                Record audio sessions from the Settings screen. Recordings will
                appear here.
              </Text>
            </View>
          )}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  recordingItem: {
    marginBottom: 16,
  },
  recordingCard: {
    borderRadius: 16,
    padding: 20,
  },
  recordingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  micIcon: {
    marginRight: 12,
  },
  recordingInfo: {
    flex: 1,
  },
  recordingDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  recordingDuration: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingLeft: 36,
  },
  locationIcon: {
    marginRight: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#666',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  playButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  stopButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  deleteButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 20,
  },
});

export default RecordingsListModal;
