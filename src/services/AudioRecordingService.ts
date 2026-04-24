import AudioRecorderPlayer, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  OutputFormatAndroidType,
} from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import {Platform, PermissionsAndroid} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';
import {RecordingSession} from '../types';
import {BANIUM_BASE_URL} from '../config';

const RECORDING_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const RECORDING_STATE_KEY = 'audio_recording_state';
const SAVED_RECORDINGS_KEY = 'saved_recordings';

// Demo mode - set to true for simulator/emulator testing
const DEMO_MODE = false;

interface PersistedRecordingState {
  isRecording: boolean;
  sessionId: string;
  filePath: string;
  startTime: number;
  location: {
    latitude: number;
    longitude: number;
    locationName?: string;
  } | null;
  parentEmail?: string | null;
  uploadedBy?: string;
}

class AudioRecordingService {
  private audioRecorderPlayer: any;
  private recordingTimer: ReturnType<typeof setTimeout> | null = null;
  private onStateChange: ((state: Partial<{recordingDuration: number}>) => void) | null = null;
  private demoInterval: ReturnType<typeof setInterval> | null = null;
  private demoStartTime: number = 0;

  constructor() {
    this.audioRecorderPlayer = new (AudioRecorderPlayer as any)();
  }

  // Demo mode methods for simulator testing
  private startDemoRecording(): void {
    this.demoStartTime = Date.now();
    this.demoInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.demoStartTime) / 1000);
      if (this.onStateChange) {
        this.onStateChange({recordingDuration: elapsed});
      }
    }, 1000);
  }

  private stopDemoRecording(): void {
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message:
              'ENACT needs microphone access to record audio for research purposes.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.error('Failed to request Android permissions:', err);
        return false;
      }
    }
    // iOS handles permissions through Info.plist and runtime prompts
    // The permission dialog will appear when we try to access the microphone
    return true;
  }

  private generateFilePath(): string {
    const timestamp = Date.now();
    // Use .m4a for both platforms (AAC encoding)
    const fileName = `recording_${timestamp}.m4a`;
    const directory =
      Platform.OS === 'ios'
        ? RNFS.CachesDirectoryPath
        : RNFS.ExternalDirectoryPath || RNFS.DocumentDirectoryPath;
    const path = `${directory}/recordings/${fileName}`;
    console.log('Generated file path:', path);
    return path;
  }

  private getRecordingsDirectory(): string {
    return Platform.OS === 'ios'
      ? `${RNFS.CachesDirectoryPath}/recordings`
      : `${RNFS.ExternalDirectoryPath || RNFS.DocumentDirectoryPath}/recordings`;
  }


  async startRecording(
    locationInfo?: {
      latitude: number;
      longitude: number;
      locationName?: string;
    } | null,
    parentEmail?: string | null,
    uploadedBy?: string,
  ): Promise<string | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Microphone permission denied');
      }

      const directory = this.getRecordingsDirectory();
      console.log('Recordings directory:', directory);

      const dirExists = await RNFS.exists(directory);
      console.log('Directory exists:', dirExists);
      if (!dirExists) {
        await RNFS.mkdir(directory);
        console.log('Directory created');
      }

      const filePath = this.generateFilePath();

      console.log('Starting recorder with path:', filePath);

      // Stop any existing recorder/player first
      try {
        await this.audioRecorderPlayer.stopRecorder();
        this.audioRecorderPlayer.removeRecordBackListener();
      } catch (e) {
        console.log('No existing recorder to stop');
      }
      try {
        await this.audioRecorderPlayer.stopPlayer();
        this.audioRecorderPlayer.removePlayBackListener();
      } catch (e) {
        console.log('No existing player to stop');
      }

      // Set subscription duration for recording updates (1 second)
      this.audioRecorderPlayer.setSubscriptionDuration(1);

      // Configure audio settings - use platform-specific settings
      let audioSet: any = undefined;
      if (Platform.OS === 'android') {
        audioSet = {
          AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
          AudioSourceAndroid: AudioSourceAndroidType.MIC,
          OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
        };
      }
      // For iOS, use default settings (let the library handle it)

      if (DEMO_MODE) {
        // Demo mode - simulate recording without actual microphone
        console.log('DEMO MODE: Simulating recording start');
        this.startDemoRecording();
      } else {
        // Real recording mode
        console.log('Calling startRecorder with audioSet:', audioSet);
        try {
          const result = await this.audioRecorderPlayer.startRecorder(
            filePath,
            audioSet,
          );
          console.log('Recorder started successfully:', result);
        } catch (recorderError: any) {
          console.error('Recorder initialization failed:', recorderError);
          if (Platform.OS === 'ios') {
            throw new Error(
              'Failed to start recording. If using the iOS Simulator, please test on a real device as the Simulator has limited microphone support.',
            );
          }
          throw recorderError;
        }

        // Add listener for recording progress
        this.audioRecorderPlayer.addRecordBackListener((e: {currentPosition: number}) => {
          const durationSeconds = Math.floor(e.currentPosition / 1000);
          if (this.onStateChange) {
            this.onStateChange({recordingDuration: durationSeconds});
          }
        });

        // Keep Android foreground service alive during recording
        if (Platform.OS === 'android') {
          const channelId = await notifee.createChannel({
            id: 'recording-active',
            name: 'Recording',
          });
          await notifee.displayNotification({
            id: 'recording-active',
            title: 'Recording in progress',
            body: 'ENACT is recording your session.',
            data: {type: 'recording'},
            android: {
              channelId,
              smallIcon: 'ic_launcher',
              ongoing: true,
              asForegroundService: true,
            },
          });
        }
      }

      const sessionId = `session_${Date.now()}`;
      const state: PersistedRecordingState = {
        isRecording: true,
        sessionId,
        filePath,
        startTime: Date.now(),
        location: locationInfo || null,
        parentEmail: parentEmail || null,
        uploadedBy: uploadedBy || 'Parent',
      };
      await this.persistState(state);

      this.recordingTimer = setTimeout(() => {
        this.stopRecording();
      }, RECORDING_DURATION_MS);

      return filePath;
    } catch (error) {
      console.error('Failed to start recording:', error);
      await this.cleanup();
      throw error;
    }
  }

  async startBackgroundService(): Promise<void> {
    // BackgroundActions removed — audio recorder handles background natively
  }

  async stopRecording(): Promise<string | null> {
    try {
      if (this.recordingTimer) {
        clearTimeout(this.recordingTimer);
        this.recordingTimer = null;
      }

      let result: string | null = null;

      if (DEMO_MODE) {
        // Demo mode - just stop the simulation
        console.log('DEMO MODE: Stopping simulated recording');
        this.stopDemoRecording();
        result = 'demo_recording_stopped';
      } else {
        result = await this.audioRecorderPlayer.stopRecorder();
        this.audioRecorderPlayer.removeRecordBackListener();
      }

      if (Platform.OS === 'android') {
        await notifee.stopForegroundService();
        await notifee.cancelNotification('recording-active');
      }

      const state = await this.getPersistedState();
      if (state) {
        const endTime = Date.now();
        const duration = Math.floor((endTime - state.startTime) / 1000);

        const session: RecordingSession = {
          id: state.sessionId,
          filePath: state.filePath,
          startTime: state.startTime,
          endTime,
          duration,
          location: state.location,
        };

        await this.saveRecordingSession(session);
        await this.showCompletionNotification(duration);

        // Upload to Banium research backend if parent email is available
        if (state.parentEmail && !DEMO_MODE) {
          this.uploadToBanium(
            state.filePath,
            state.parentEmail,
            state.uploadedBy || 'Parent',
            state.startTime,
          ).catch(e => console.error('Banium upload error:', e));
        }
      }

      await this.clearPersistedState();

      return result;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {...options, signal: controller.signal});
    } finally {
      clearTimeout(timer);
    }
  }

  // Render free tier spins down after 15 min. Ping a lightweight endpoint first
  // and wait up to 60s for it to wake before sending the heavy audio payload.
  private async warmUpBanium(): Promise<void> {
    const MAX_WAIT_MS = 90_000;
    const POLL_INTERVAL_MS = 3_000;
    const start = Date.now();
    console.log('Banium: warming up server...');
    while (Date.now() - start < MAX_WAIT_MS) {
      try {
        const res = await this.fetchWithTimeout(
          `${BANIUM_BASE_URL}/health`,
          {method: 'GET'},
          5_000,
        );
        if (res.ok || res.status < 500) {
          console.log(`Banium: server warm (${Date.now() - start}ms)`);
          return;
        }
      } catch {
        // still waking up
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    console.warn('Banium: warm-up timed out, proceeding anyway');
  }

  private async uploadToBanium(
    filePath: string,
    parentEmail: string,
    uploadedBy: string,
    startTime: number,
  ): Promise<void> {
    const fileExists = await RNFS.exists(filePath);
    if (!fileExists) {
      console.warn('Banium upload skipped: file not found at', filePath);
      return;
    }

    const channelId = await notifee.createChannel({
      id: 'banium-upload',
      name: 'Research Upload',
    });

    await notifee.displayNotification({
      id: 'banium-upload',
      title: 'Uploading for analysis...',
      body: 'Your session recording is being sent for research analysis.',
      data: {type: 'recording'},
      android: {channelId, smallIcon: 'ic_launcher', ongoing: true},
    });

    try {
      await this.warmUpBanium();

      const buildFormData = () => {
        const formData = new FormData();
        formData.append('audio', {
          uri: Platform.OS === 'android' ? `file://${filePath}` : filePath,
          type: 'audio/m4a',
          name: `recording_${startTime}.m4a`,
        } as any);
        formData.append('parentEmail', parentEmail);
        formData.append('uploadedBy', uploadedBy);
        formData.append('recordingDate', new Date(startTime).toISOString());
        return formData;
      };

      const SUBMIT_TIMEOUT_MS = 300_000; // 5 min — covers cold start + RevAI transcription
      let response: Response;
      try {
        console.log('Banium: submitting ENACT recording (attempt 1)');
        response = await this.fetchWithTimeout(
          `${BANIUM_BASE_URL}/api/integrations/enact/submit`,
          {method: 'POST', body: buildFormData()},
          SUBMIT_TIMEOUT_MS,
        );
      } catch (firstErr: any) {
        console.warn('Banium submit attempt 1 failed, retrying:', firstErr?.message);
        await new Promise(r => setTimeout(r, 15000));
        console.log('Banium: submitting ENACT recording (attempt 2)');
        response = await this.fetchWithTimeout(
          `${BANIUM_BASE_URL}/api/integrations/enact/submit`,
          {method: 'POST', body: buildFormData()},
          SUBMIT_TIMEOUT_MS,
        );
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `Submit failed: ${response.status}`);
      }

      await notifee.cancelNotification('banium-upload');
      await notifee.displayNotification({
        title: 'Analysis Complete',
        body: 'Your session has been processed for research.',
        data: {type: 'recording'},
        android: {channelId, smallIcon: 'ic_launcher'},
      });
    } catch (error: any) {
      await notifee.cancelNotification('banium-upload');
      await notifee.displayNotification({
        title: 'Upload Failed',
        body: 'Could not send recording for analysis. It is saved locally.',
        data: {type: 'recording'},
        android: {channelId, smallIcon: 'ic_launcher'},
      });
      throw error;
    }
  }

  private async saveRecordingSession(session: RecordingSession): Promise<void> {
    try {
      const existingData = await AsyncStorage.getItem(SAVED_RECORDINGS_KEY);
      const recordings: RecordingSession[] = existingData
        ? JSON.parse(existingData)
        : [];
      recordings.unshift(session);
      await AsyncStorage.setItem(
        SAVED_RECORDINGS_KEY,
        JSON.stringify(recordings),
      );
    } catch (error) {
      console.error('Failed to save recording session:', error);
    }
  }

  async getSavedRecordings(): Promise<RecordingSession[]> {
    try {
      const data = await AsyncStorage.getItem(SAVED_RECORDINGS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async deleteRecording(id: string): Promise<void> {
    try {
      const recordings = await this.getSavedRecordings();
      const recording = recordings.find(r => r.id === id);

      if (recording) {
        const fileExists = await RNFS.exists(recording.filePath);
        if (fileExists) {
          await RNFS.unlink(recording.filePath);
        }
      }

      const updatedRecordings = recordings.filter(r => r.id !== id);
      await AsyncStorage.setItem(
        SAVED_RECORDINGS_KEY,
        JSON.stringify(updatedRecordings),
      );
    } catch (error) {
      console.error('Failed to delete recording:', error);
      throw error;
    }
  }

  private async showCompletionNotification(durationSeconds: number): Promise<void> {
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const channelId = await notifee.createChannel({
      id: 'recording-complete',
      name: 'Recording Notifications',
    });

    await notifee.displayNotification({
      title: 'Recording Complete',
      body: `Your ${durationText} audio recording has been saved.`,
      data: {type: 'recording'},
      android: {
        channelId,
        smallIcon: 'ic_launcher',
        pressAction: {id: 'default'},
      },
    });
  }

  private async persistState(state: PersistedRecordingState): Promise<void> {
    await AsyncStorage.setItem(RECORDING_STATE_KEY, JSON.stringify(state));
  }

  async getPersistedState(): Promise<PersistedRecordingState | null> {
    try {
      const data = await AsyncStorage.getItem(RECORDING_STATE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async clearPersistedState(): Promise<void> {
    await AsyncStorage.removeItem(RECORDING_STATE_KEY);
  }

  private async cleanup(): Promise<void> {
    if (this.recordingTimer) {
      clearTimeout(this.recordingTimer);
      this.recordingTimer = null;
    }
    if (DEMO_MODE) {
      this.stopDemoRecording();
    }
  }

  async isCurrentlyRecording(): Promise<boolean> {
    const state = await this.getPersistedState();
    return state?.isRecording === true;
  }

  setStateChangeCallback(
    callback: (state: Partial<{recordingDuration: number}>) => void,
  ): void {
    this.onStateChange = callback;
  }

  async playRecording(filePath: string): Promise<void> {
    await this.audioRecorderPlayer.startPlayer(filePath);
  }

  async stopPlayback(): Promise<void> {
    await this.audioRecorderPlayer.stopPlayer();
  }

  async pausePlayback(): Promise<void> {
    await this.audioRecorderPlayer.pausePlayer();
  }

  async resumePlayback(): Promise<void> {
    await this.audioRecorderPlayer.resumePlayer();
  }

  addPlayBackListener(
    callback: (e: {currentPosition: number; duration: number}) => void,
  ): void {
    this.audioRecorderPlayer.addPlayBackListener(callback);
  }

  removePlayBackListener(): void {
    this.audioRecorderPlayer.removePlayBackListener();
  }
}

export const audioRecordingService = new AudioRecordingService();
export default AudioRecordingService;
