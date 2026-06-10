import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform, AppState} from 'react-native';
import {BASE_URL} from '../config';

export const DIAG_EVENTS_KEY = 'diag_events_v1';
export const DIAG_STATE_KEY = 'diag_state_v1';
const MAX_EVENTS = 50;

export type DiagEvent = {
  id: string;
  timestamp: string;
  userId: string | null;
  platform: string;
  appState: string;
  deviceInfo: string;
  eventName: string;
  metadata: Record<string, unknown>;
  critical: boolean;
};

export type DiagState = {
  lastLocationPoll: {
    timestamp: string;
    result: string;
    coords?: {latitude: number; longitude: number};
  } | null;
  lastBgFetchExecution: {timestamp: string; taskId: string} | null;
  lastNotificationReceived: {timestamp: string; title: string; source: string} | null;
  lastNotificationDisplayed: {timestamp: string; title: string} | null;
  lastNotificationTapped: {timestamp: string; title: string} | null;
  fcmToken: string | null;
  bgFetchConfigureStatus: number | null;
};

const DEFAULT_STATE: DiagState = {
  lastLocationPoll: null,
  lastBgFetchExecution: null,
  lastNotificationReceived: null,
  lastNotificationDisplayed: null,
  lastNotificationTapped: null,
  fcmToken: null,
  bgFetchConfigureStatus: null,
};

class DiagnosticsLogger {
  private userId: string | null = null;
  private accessToken: string | null = null;
  readonly deviceInfo: string;

  constructor() {
    const version = Platform.Version;
    const model =
      (Platform.constants as any)?.Model ??
      (Platform.constants as any)?.uiName ??
      'Unknown Device';
    this.deviceInfo =
      Platform.OS === 'android'
        ? `Android API ${version} / ${model}`
        : `iOS ${version}`;
  }

  setUser(userId: string | null, accessToken: string | null): void {
    this.userId = userId;
    this.accessToken = accessToken;
  }

  async log(
    eventName: string,
    metadata: Record<string, unknown> = {},
    critical = false,
  ): Promise<void> {
    const event: DiagEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      userId: this.userId,
      platform: Platform.OS,
      appState: AppState.currentState ?? 'unknown',
      deviceInfo: this.deviceInfo,
      eventName,
      metadata,
      critical,
    };

    console.log(`[DIAG:${eventName}]`, JSON.stringify(metadata));

    this._appendToStorage(event).catch(() => {});

    if (critical && this.accessToken) {
      this._sendToBackend(event).catch(() => {});
    }
  }

  async updateState(patch: Partial<DiagState>): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(DIAG_STATE_KEY);
      const state: DiagState = raw ? JSON.parse(raw) : {...DEFAULT_STATE};
      await AsyncStorage.setItem(
        DIAG_STATE_KEY,
        JSON.stringify({...state, ...patch}),
      );
    } catch (_) {}
  }

  async getState(): Promise<DiagState> {
    try {
      const raw = await AsyncStorage.getItem(DIAG_STATE_KEY);
      return raw ? JSON.parse(raw) : {...DEFAULT_STATE};
    } catch (_) {
      return {...DEFAULT_STATE};
    }
  }

  async getEvents(): Promise<DiagEvent[]> {
    try {
      const raw = await AsyncStorage.getItem(DIAG_EVENTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([DIAG_EVENTS_KEY, DIAG_STATE_KEY]);
  }

  private async _appendToStorage(event: DiagEvent): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(DIAG_EVENTS_KEY);
      const events: DiagEvent[] = raw ? JSON.parse(raw) : [];
      events.push(event);
      await AsyncStorage.setItem(
        DIAG_EVENTS_KEY,
        JSON.stringify(events.slice(-MAX_EVENTS)),
      );
    } catch (_) {}
  }

  private async _sendToBackend(event: DiagEvent): Promise<void> {
    if (!this.accessToken) {
      return;
    }
    try {
      await fetch(`${BASE_URL}/api/diagnostics/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(event),
      });
    } catch (_) {}
  }
}

export const DLogger = new DiagnosticsLogger();
export default DLogger;
