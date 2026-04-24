import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import {Alert, AppState, AppStateStatus} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {audioRecordingService} from '../services/AudioRecordingService';
import {RecordingState, RecordingSession} from '../types';
import {LocationContext} from './LocationContext';
import {AuthContext} from './AuthContext';

interface AudioRecordingContextType {
  recordingState: RecordingState;
  savedRecordings: RecordingSession[];
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  deleteRecording: (id: string) => Promise<void>;
  refreshRecordings: () => Promise<void>;
  isRecording: boolean;
  recordingDuration: number;
  formatDuration: (seconds: number) => string;
}

const initialState: RecordingState = {
  isRecording: false,
  isPaused: false,
  recordingStartTime: null,
  recordingDuration: 0,
  recordingPath: null,
  error: null,
};

export const AudioRecordingContext = createContext<
  AudioRecordingContextType | undefined
>(undefined);

export const AudioRecordingProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [recordingState, setRecordingState] =
    useState<RecordingState>(initialState);
  const [savedRecordings, setSavedRecordings] = useState<RecordingSession[]>(
    [],
  );
  const locationContext = useContext(LocationContext);
  const {userInfo} = useContext(AuthContext) as any;

  const refreshRecordings = useCallback(async () => {
    const recordings = await audioRecordingService.getSavedRecordings();
    setSavedRecordings(recordings);
  }, []);

  useEffect(() => {
    const recoverState = async () => {
      const persistedState = await audioRecordingService.getPersistedState();
      if (persistedState?.isRecording) {
        const elapsed = Math.floor(
          (Date.now() - persistedState.startTime) / 1000,
        );
        const maxDuration = 15 * 60;

        if (elapsed < maxDuration) {
          setRecordingState({
            isRecording: true,
            isPaused: false,
            recordingStartTime: persistedState.startTime,
            recordingDuration: elapsed,
            recordingPath: persistedState.filePath,
            error: null,
          });
        } else {
          await audioRecordingService.stopRecording();
          await audioRecordingService.clearPersistedState();
        }
      }
      await refreshRecordings();
    };

    recoverState();

    audioRecordingService.setStateChangeCallback(update => {
      setRecordingState(prev => ({...prev, ...update}));
    });

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        recoverState();
      } else if (nextAppState === 'background') {
        // Start background service only when app is actually backgrounded
        audioRecordingService.getPersistedState().then(state => {
          if (state?.isRecording) {
            audioRecordingService.startBackgroundService().catch(() => {});
          }
        }).catch(() => {});
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, [refreshRecordings]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (recordingState.isRecording && recordingState.recordingStartTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor(
          (Date.now() - recordingState.recordingStartTime!) / 1000,
        );
        setRecordingState(prev => ({...prev, recordingDuration: elapsed}));
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [recordingState.isRecording, recordingState.recordingStartTime]);

  const startRecording = useCallback(async () => {
    try {
      setRecordingState(prev => ({...prev, error: null}));

      const locationInfo = locationContext?.cur_location
        ? {
            latitude: locationContext.cur_location.latitude,
            longitude: locationContext.cur_location.longitude,
          }
        : null;

      // Read directly from AsyncStorage — userInfo React state may not be populated yet
      // if isLoggedIn() is still in progress or /verify failed on app open.
      let parentEmail = userInfo?.user?.email || null;
      let uploadedBy = userInfo?.user?.name || 'Parent';
      if (!parentEmail) {
        try {
          const stored = await AsyncStorage.getItem('userInfo');
          const parsed = stored ? JSON.parse(stored) : null;
          parentEmail = parsed?.user?.email || null;
          uploadedBy = parsed?.user?.name || 'Parent';
        } catch {}
      }

      const filePath = await audioRecordingService.startRecording(
        locationInfo,
        parentEmail,
        uploadedBy,
      );

      setRecordingState({
        isRecording: true,
        isPaused: false,
        recordingStartTime: Date.now(),
        recordingDuration: 0,
        recordingPath: filePath,
        error: null,
      });

      Alert.alert(
        'Recording Started',
        'Audio recording will continue for 15 minutes, even if you close the app.',
        [{text: 'OK'}],
      );
    } catch (error: any) {
      setRecordingState(prev => ({
        ...prev,
        error: error.message || 'Failed to start recording',
      }));
      Alert.alert('Error', error.message || 'Failed to start recording');
    }
  }, [locationContext]);

  const stopRecording = useCallback(async () => {
    try {
      await audioRecordingService.stopRecording();

      Alert.alert(
        'Recording Saved',
        'Your audio recording has been saved successfully.',
        [{text: 'OK'}],
      );

      setRecordingState(initialState);
      await refreshRecordings();
    } catch (error: any) {
      setRecordingState(prev => ({
        ...prev,
        error: error.message || 'Failed to stop recording',
      }));
      Alert.alert('Error', error.message || 'Failed to stop recording');
    }
  }, [refreshRecordings]);

  const deleteRecording = useCallback(
    async (id: string) => {
      try {
        await audioRecordingService.deleteRecording(id);
        await refreshRecordings();
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to delete recording');
      }
    },
    [refreshRecordings],
  );

  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return (
    <AudioRecordingContext.Provider
      value={{
        recordingState,
        savedRecordings,
        startRecording,
        stopRecording,
        deleteRecording,
        refreshRecordings,
        isRecording: recordingState.isRecording,
        recordingDuration: recordingState.recordingDuration,
        formatDuration,
      }}>
      {children}
    </AudioRecordingContext.Provider>
  );
};

export const useAudioRecording = () => {
  const context = useContext(AudioRecordingContext);
  if (!context) {
    throw new Error(
      'useAudioRecording must be used within AudioRecordingProvider',
    );
  }
  return context;
};
