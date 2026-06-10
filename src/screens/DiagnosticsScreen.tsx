import React, {useState, useEffect, useCallback, useContext} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Share,
  SafeAreaView,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Linking,
} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import BackgroundFetch from 'react-native-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import {useNavigation} from '@react-navigation/native';
import {AuthContext, AuthContextType} from '../context/AuthContext';
import DLogger from '../diagnostics/DiagnosticsLogger';
import type {DiagEvent, DiagState} from '../diagnostics/DiagnosticsLogger';
import {BASE_URL} from '../config';

// ─── Types ───────────────────────────────────────────────────────────────────

type StatusLevel = 'ok' | 'warn' | 'error' | 'unknown';

type StatusRow = {
  label: string;
  value: string;
  level: StatusLevel;
  detail?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function levelColor(level: StatusLevel): string {
  switch (level) {
    case 'ok':      return '#16a34a';
    case 'warn':    return '#d97706';
    case 'error':   return '#dc2626';
    default:        return '#6b7280';
  }
}

function levelBg(level: StatusLevel): string {
  switch (level) {
    case 'ok':      return '#dcfce7';
    case 'warn':    return '#fef3c7';
    case 'error':   return '#fee2e2';
    default:        return '#f3f4f6';
  }
}

function fmt(iso: string | null | undefined): string {
  if (!iso) {return 'Never';}
  const d = new Date(iso);
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  const timeStr = d.toLocaleTimeString('en-US', {hour12: false});
  if (diff < 60)  {return `${diff}s ago  (${timeStr})`;}
  if (diff < 3600){return `${Math.floor(diff / 60)}m ago  (${timeStr})`;}
  return `${Math.floor(diff / 3600)}h ago  (${timeStr})`;
}

const BF_LABEL: Record<number, string> = {
  0: 'DENIED — OS blocking background jobs',
  1: 'RESTRICTED — may be deferred by OS',
  2: 'AVAILABLE',
};
const BF_LEVEL: Record<number, StatusLevel> = {0: 'error', 1: 'warn', 2: 'ok'};

const FCM_LABEL: Record<number, string> = {
  [-1]: 'NOT_DETERMINED',
  0: 'DENIED',
  1: 'AUTHORIZED',
  2: 'PROVISIONAL',
  3: 'EPHEMERAL',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusRowView: React.FC<StatusRow> = ({label, value, level, detail}) => (
  <View style={[styles.statusRow, {borderLeftColor: levelColor(level)}]}>
    <View style={styles.statusLeft}>
      <Text style={styles.statusLabel}>{label}</Text>
      {detail ? <Text style={styles.statusDetail}>{detail}</Text> : null}
    </View>
    <View style={[styles.statusBadge, {backgroundColor: levelBg(level)}]}>
      <Text style={[styles.statusValue, {color: levelColor(level)}]}>{value}</Text>
    </View>
  </View>
);

const EventRow: React.FC<{event: DiagEvent; index: number}> = ({event, index}) => {
  const time = new Date(event.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const meta = Object.entries(event.metadata)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join('  |  ');

  return (
    <View style={[styles.eventRow, index % 2 === 0 ? styles.eventRowEven : styles.eventRowOdd]}>
      <View style={styles.eventHeader}>
        <Text style={styles.eventTime}>{time}</Text>
        <Text style={styles.eventAppState}>[{event.appState}]</Text>
        {event.critical && <View style={styles.criticalBadge}><Text style={styles.criticalText}>CRITICAL</Text></View>}
      </View>
      <Text style={[styles.eventName, event.critical ? styles.eventNameCritical : null]}>
        {event.eventName}
      </Text>
      {meta ? <Text style={styles.eventMeta} numberOfLines={3}>{meta}</Text> : null}
    </View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

const DiagnosticsScreen: React.FC = () => {
  const navigation = useNavigation();
  const {userInfo} = useContext<AuthContextType>(AuthContext);

  const [statusRows, setStatusRows] = useState<StatusRow[]>([]);
  const [diagState, setDiagState] = useState<DiagState | null>(null);
  const [events, setEvents] = useState<DiagEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [testNotifStatus, setTestNotifStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [testNotifResult, setTestNotifResult] = useState('');
  const [testLocStatus, setTestLocStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [testLocResult, setTestLocResult] = useState('');

  // ── Status gathering ─────────────────────────────────────────────────────

  const gatherStatuses = useCallback(async (): Promise<StatusRow[]> => {
    const rows: StatusRow[] = [];

    // Device info
    rows.push({
      label: 'Device',
      value: DLogger.deviceInfo,
      level: 'unknown',
    });

    // FCM token
    try {
      const token = await messaging().getToken();
      await DLogger.updateState({fcmToken: token});
      rows.push({
        label: 'FCM Token',
        value: token ? `...${token.slice(-16)}` : 'NULL',
        level: token ? 'ok' : 'error',
        detail: token ? 'Full token in logs' : 'Not registered — notifications impossible',
      });
    } catch (e: any) {
      rows.push({label: 'FCM Token', value: 'ERROR', level: 'error', detail: String(e?.message)});
    }

    // FCM permission
    try {
      const status = await messaging().hasPermission();
      rows.push({
        label: 'FCM Permission',
        value: FCM_LABEL[status] ?? `STATUS_${status}`,
        level: status === 1 ? 'ok' : 'error',
      });
    } catch (e: any) {
      rows.push({label: 'FCM Permission', value: 'ERROR', level: 'error', detail: String(e?.message)});
    }

    // Notifee permission
    try {
      const settings = await notifee.getNotificationSettings();
      const auth = settings.authorizationStatus;
      rows.push({
        label: 'Notifee Permission',
        value: auth === 1 ? 'AUTHORIZED' : auth === 0 ? 'DENIED' : `STATUS_${auth}`,
        level: auth === 1 ? 'ok' : 'error',
      });
    } catch (e: any) {
      rows.push({label: 'Notifee Permission', value: 'ERROR', level: 'error', detail: String(e?.message)});
    }

    if (Platform.OS === 'android') {
      // Fine location
      try {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        rows.push({
          label: 'Location (Fine)',
          value: granted ? 'GRANTED' : 'DENIED',
          level: granted ? 'ok' : 'error',
        });
      } catch (_) {
        rows.push({label: 'Location (Fine)', value: 'ERROR', level: 'error'});
      }

      // Background location (Android 10+)
      if (Platform.Version >= 29) {
        try {
          const granted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
          );
          rows.push({
            label: 'Background Location',
            value: granted ? 'GRANTED' : 'DENIED',
            level: granted ? 'ok' : 'error',
            detail: granted
              ? undefined
              : 'Required for background notifications. Settings → Apps → ENACT → Location → Allow all the time',
          });
        } catch (_) {
          rows.push({label: 'Background Location', value: 'ERROR', level: 'error'});
        }
      } else {
        rows.push({label: 'Background Location', value: 'N/A (API < 29)', level: 'unknown'});
      }

      // POST_NOTIFICATIONS (Android 13+)
      if (Platform.Version >= 33) {
        try {
          const granted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
          rows.push({
            label: 'POST_NOTIFICATIONS',
            value: granted ? 'GRANTED' : 'DENIED',
            level: granted ? 'ok' : 'error',
          });
        } catch (_) {
          rows.push({label: 'POST_NOTIFICATIONS', value: 'ERROR', level: 'error'});
        }
      }

      // BackgroundFetch status
      try {
        const bfStatus = await BackgroundFetch.status();
        await DLogger.updateState({bgFetchConfigureStatus: bfStatus});
        rows.push({
          label: 'BackgroundFetch Status',
          value: BF_LABEL[bfStatus] ?? `STATUS_${bfStatus}`,
          level: BF_LEVEL[bfStatus] ?? 'unknown',
          detail:
            bfStatus !== 2
              ? 'Settings → Apps → ENACT → Battery → Unrestricted'
              : undefined,
        });
      } catch (e: any) {
        rows.push({label: 'BackgroundFetch Status', value: 'ERROR', level: 'error', detail: String(e?.message)});
      }

      // Battery optimization (via BF status proxy + prompt history)
      try {
        const prompted = await AsyncStorage.getItem('batteryOptimizationPrompted');
        const bfStatus = await BackgroundFetch.status();
        const isUnrestricted = bfStatus === 2;
        rows.push({
          label: 'Battery Optimization',
          value: isUnrestricted ? 'Likely unrestricted' : 'Likely RESTRICTED',
          level: isUnrestricted ? 'ok' : 'warn',
          detail: `User prompted: ${prompted ? 'Yes' : 'No'}. Tap to open Settings.`,
        });
      } catch (_) {
        rows.push({label: 'Battery Optimization', value: 'Unknown', level: 'unknown'});
      }
    } else {
      // iOS location
      rows.push({
        label: 'Location Permission',
        value: 'Check iOS Settings',
        level: 'unknown',
        detail: 'Settings → Privacy → Location Services → ENACT → Always',
      });
      rows.push({
        label: 'Battery Optimization',
        value: 'N/A (iOS)',
        level: 'unknown',
      });
    }

    return rows;
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, state, evts] = await Promise.all([
        gatherStatuses(),
        DLogger.getState(),
        DLogger.getEvents(),
      ]);
      setStatusRows(rows);
      setDiagState(state);
      setEvents([...evts].reverse()); // newest first
    } finally {
      setLoading(false);
    }
  }, [gatherStatuses]);

  useEffect(() => {
    DLogger.log('DIAG_SCREEN_OPENED', {userId: userInfo?.id});
    loadAll();
  }, [loadAll, userInfo?.id]);

  // ── Test Notification ────────────────────────────────────────────────────

  const runTestNotification = async () => {
    if (!userInfo?.access_token) {return;}
    setTestNotifStatus('loading');
    setTestNotifResult('');
    DLogger.log('DIAG_TEST_NOTIF_START', {}, true);

    try {
      const res = await fetch(`${BASE_URL}/endpoint/test-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.access_token}`,
        },
      });
      const body = await res.json();
      const ok = res.ok && body.success;
      DLogger.log(
        ok ? 'DIAG_TEST_NOTIF_SUCCESS' : 'DIAG_TEST_NOTIF_FAIL',
        {httpStatus: res.status, body},
        true,
      );
      setTestNotifStatus(ok ? 'ok' : 'error');
      setTestNotifResult(JSON.stringify(body, null, 2));
    } catch (e: any) {
      DLogger.log('DIAG_TEST_NOTIF_ERROR', {error: String(e?.message)}, true);
      setTestNotifStatus('error');
      setTestNotifResult(String(e?.message ?? e));
    }
  };

  // ── Test Location Check ──────────────────────────────────────────────────

  const runTestLocationCheck = async () => {
    if (!userInfo?.access_token) {return;}
    setTestLocStatus('loading');
    setTestLocResult('');
    DLogger.log('DIAG_TEST_LOC_START', {}, true);

    try {
      const position = await new Promise<any>((resolve, reject) =>
        Geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 0,
        }),
      );

      const {latitude, longitude, accuracy} = position.coords;
      DLogger.log('DIAG_TEST_LOC_ACQUIRED', {latitude, longitude, accuracy}, true);

      let contentPreferences: string[] = [];
      try {
        const raw = await AsyncStorage.getItem('contentPreferences');
        if (raw) {contentPreferences = JSON.parse(raw);}
      } catch (_) {}

      const res = await fetch(`${BASE_URL}/endpoint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.access_token}`,
        },
        body: JSON.stringify({
          latitude,
          longitude,
          contentPreferences,
        }),
      });

      const body = await res.json();
      DLogger.log('DIAG_TEST_LOC_RESPONSE', {
        httpStatus: res.status,
        status: body.status,
        location: body.location,
      }, true);
      setTestLocStatus(res.ok ? 'ok' : 'error');
      setTestLocResult(
        JSON.stringify(
          {request: {latitude, longitude, accuracy, contentPreferences}, response: body},
          null,
          2,
        ),
      );
    } catch (e: any) {
      DLogger.log('DIAG_TEST_LOC_ERROR', {error: String(e?.message)}, true);
      setTestLocStatus('error');
      setTestLocResult(String(e?.message ?? e));
    }
  };

  // ── Share / Clear ────────────────────────────────────────────────────────

  const shareAllLogs = async () => {
    const allEvents = await DLogger.getEvents();
    const state = await DLogger.getState();
    const content = [
      `=== ENACT Diagnostic Report ===`,
      `Generated: ${new Date().toISOString()}`,
      `Device: ${DLogger.deviceInfo}`,
      `Platform: ${Platform.OS}`,
      ``,
      `=== State ===`,
      JSON.stringify(state, null, 2),
      ``,
      `=== Events (${allEvents.length}) ===`,
      ...allEvents.map(
        e =>
          `[${e.timestamp}] [${e.appState}] ${e.eventName}${e.critical ? ' [CRITICAL]' : ''}\n  ${JSON.stringify(e.metadata)}`,
      ),
    ].join('\n');

    await Share.share({message: content, title: 'ENACT Diagnostic Logs'});
  };

  const clearAllLogs = async () => {
    await DLogger.clearAll();
    await loadAll();
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Diagnostics</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadAll} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#4f46e5" />
          ) : (
            <Text style={styles.refreshBtnText}>Refresh</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAll} />}>

        {/* ── Status Section ─────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Device & Permission Status</Text>
        <View style={styles.card}>
          {statusRows.map((row, i) => (
            <React.Fragment key={row.label}>
              {i > 0 && <View style={styles.divider} />}
              <StatusRowView {...row} />
            </React.Fragment>
          ))}
          {statusRows.length === 0 && loading && (
            <ActivityIndicator color="#4f46e5" style={{padding: 16}} />
          )}
          {Platform.OS === 'android' && (
            <TouchableOpacity
              style={styles.openSettingsBtn}
              onPress={() => Linking.openSettings()}>
              <Text style={styles.openSettingsBtnText}>Open App Settings</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Last Events Section ─────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Pipeline Timestamps</Text>
        <View style={styles.card}>
          {[
            {label: 'Last Location Poll', value: fmt(diagState?.lastLocationPoll?.timestamp), sub: diagState?.lastLocationPoll?.result},
            {label: 'Last BG Fetch Execution', value: fmt(diagState?.lastBgFetchExecution?.timestamp), sub: diagState?.lastBgFetchExecution?.taskId},
            {label: 'Last Notif Received', value: fmt(diagState?.lastNotificationReceived?.timestamp), sub: diagState?.lastNotificationReceived?.title},
            {label: 'Last Notif Displayed', value: fmt(diagState?.lastNotificationDisplayed?.timestamp), sub: diagState?.lastNotificationDisplayed?.title},
            {label: 'Last Notif Tapped', value: fmt(diagState?.lastNotificationTapped?.timestamp), sub: diagState?.lastNotificationTapped?.title},
          ].map((item, i) => (
            <React.Fragment key={item.label}>
              {i > 0 && <View style={styles.divider} />}
              <View style={styles.timestampRow}>
                <Text style={styles.timestampLabel}>{item.label}</Text>
                <Text style={styles.timestampValue}>{item.value}</Text>
                {item.sub ? <Text style={styles.timestampSub}>{item.sub}</Text> : null}
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* ── Actions Section ─────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Manual Tests</Text>
        <View style={styles.card}>
          {/* Test Notification */}
          <TouchableOpacity
            style={[styles.actionBtn, testNotifStatus === 'loading' && styles.actionBtnDisabled]}
            onPress={runTestNotification}
            disabled={testNotifStatus === 'loading' || !userInfo?.access_token}>
            {testNotifStatus === 'loading' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>Test Notification (backend → FCM)</Text>
            )}
          </TouchableOpacity>
          {testNotifStatus !== 'idle' && testNotifStatus !== 'loading' && (
            <View style={[styles.resultBox, {borderColor: testNotifStatus === 'ok' ? '#16a34a' : '#dc2626'}]}>
              <Text style={[styles.resultTitle, {color: testNotifStatus === 'ok' ? '#16a34a' : '#dc2626'}]}>
                {testNotifStatus === 'ok' ? '✓ FCM send succeeded' : '✗ FCM send failed'}
              </Text>
              <Text style={styles.resultBody}>{testNotifResult}</Text>
            </View>
          )}

          <View style={styles.divider} />

          {/* Test Location Check */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary, testLocStatus === 'loading' && styles.actionBtnDisabled]}
            onPress={runTestLocationCheck}
            disabled={testLocStatus === 'loading' || !userInfo?.access_token}>
            {testLocStatus === 'loading' ? (
              <ActivityIndicator color="#4f46e5" />
            ) : (
              <Text style={[styles.actionBtnText, {color: '#4f46e5'}]}>
                Test Location Check
              </Text>
            )}
          </TouchableOpacity>
          {testLocStatus !== 'idle' && testLocStatus !== 'loading' && (
            <View style={[styles.resultBox, {borderColor: testLocStatus === 'ok' ? '#16a34a' : '#dc2626'}]}>
              <Text style={[styles.resultTitle, {color: testLocStatus === 'ok' ? '#16a34a' : '#dc2626'}]}>
                {testLocStatus === 'ok' ? '✓ Location check complete' : '✗ Location check failed'}
              </Text>
              <Text style={styles.resultBody}>{testLocResult}</Text>
            </View>
          )}
        </View>

        {/* ── Log Management ─────────────────────────────────────────────── */}
        <View style={styles.logActionsRow}>
          <TouchableOpacity style={styles.logBtn} onPress={shareAllLogs}>
            <Text style={styles.logBtnText}>Share All Logs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.logBtn, styles.logBtnDanger]} onPress={clearAllLogs}>
            <Text style={[styles.logBtnText, {color: '#dc2626'}]}>Clear Logs</Text>
          </TouchableOpacity>
        </View>

        {/* ── Event Timeline ─────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Event Timeline ({events.length})</Text>
        {events.length === 0 ? (
          <View style={styles.emptyEvents}>
            <Text style={styles.emptyEventsText}>No events recorded yet.{'\n'}Events appear after notification pipeline activity.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {events.map((evt, i) => (
              <EventRow key={evt.id} event={evt} index={i} />
            ))}
          </View>
        )}

        <View style={{height: 40}} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f9fafb'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {padding: 4},
  backBtnText: {color: '#4f46e5', fontSize: 15, fontWeight: '600'},
  headerTitle: {fontSize: 16, fontWeight: '700', color: '#111827', flex: 1, textAlign: 'center'},
  refreshBtn: {minWidth: 60, alignItems: 'flex-end'},
  refreshBtnText: {color: '#4f46e5', fontSize: 14, fontWeight: '600'},
  scroll: {flex: 1},
  scrollContent: {padding: 16},
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  divider: {height: 1, backgroundColor: '#f3f4f6'},
  // Status rows
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderLeftWidth: 3,
  },
  statusLeft: {flex: 1, marginRight: 8},
  statusLabel: {fontSize: 13, fontWeight: '600', color: '#374151'},
  statusDetail: {fontSize: 11, color: '#9ca3af', marginTop: 2, lineHeight: 15},
  statusBadge: {borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start'},
  statusValue: {fontSize: 11, fontWeight: '700'},
  // Timestamps
  timestampRow: {padding: 12},
  timestampLabel: {fontSize: 12, fontWeight: '600', color: '#6b7280'},
  timestampValue: {fontSize: 13, color: '#111827', marginTop: 2},
  timestampSub: {fontSize: 11, color: '#9ca3af', marginTop: 2},
  // Actions
  actionBtn: {
    backgroundColor: '#4f46e5',
    margin: 12,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  actionBtnSecondary: {backgroundColor: '#ede9fe'},
  actionBtnDisabled: {opacity: 0.5},
  actionBtnText: {color: '#fff', fontWeight: '700', fontSize: 14},
  resultBox: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fafafa',
  },
  resultTitle: {fontSize: 12, fontWeight: '700', marginBottom: 4},
  resultBody: {fontSize: 11, color: '#374151', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'},
  // Log management
  logActionsRow: {flexDirection: 'row', gap: 10, marginTop: 12},
  logBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 10,
    alignItems: 'center',
  },
  logBtnDanger: {borderColor: '#fca5a5'},
  logBtnText: {fontSize: 13, fontWeight: '600', color: '#374151'},
  // Open settings
  openSettingsBtn: {
    margin: 12,
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    alignItems: 'center',
  },
  openSettingsBtnText: {fontSize: 12, color: '#4f46e5', fontWeight: '600'},
  // Event timeline
  emptyEvents: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyEventsText: {color: '#9ca3af', fontSize: 13, textAlign: 'center', lineHeight: 20},
  eventRow: {padding: 10},
  eventRowEven: {backgroundColor: '#fff'},
  eventRowOdd: {backgroundColor: '#f9fafb'},
  eventHeader: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2},
  eventTime: {fontSize: 11, color: '#9ca3af', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'},
  eventAppState: {fontSize: 10, color: '#d1d5db'},
  criticalBadge: {backgroundColor: '#fef3c7', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1},
  criticalText: {fontSize: 9, fontWeight: '700', color: '#d97706'},
  eventName: {fontSize: 12, fontWeight: '700', color: '#1f2937'},
  eventNameCritical: {color: '#dc2626'},
  eventMeta: {fontSize: 10, color: '#6b7280', marginTop: 2, lineHeight: 14, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'},
});

export default DiagnosticsScreen;
