import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useTheme } from '../../theme';
import { config } from '../../config';
import { buildOsmHtml } from '../Map/osmMapHtml';
import { DolmusLine, DolmusDaySchedule } from '../../types/shared-types';

interface DolmusMapScreenProps {
  visible: boolean;
  line: DolmusLine | null;
  onClose: () => void;
}

type DayKey = 'weekday' | 'saturday' | 'sunday';

const DAY_TABS: { key: DayKey; label: string }[] = [
  { key: 'weekday', label: 'Hafta İçi' },
  { key: 'saturday', label: 'Cumartesi' },
  { key: 'sunday', label: 'Pazar' },
];

// Bugünün gününe göre varsayılan sekme (0=Pazar, 6=Cumartesi)
function todayKey(): DayKey {
  const d = new Date().getDay();
  if (d === 0) return 'sunday';
  if (d === 6) return 'saturday';
  return 'weekday';
}

// Saat tablosunu satırlara çevir: { "06": [15,29] } -> [["06",[15,29]], ...] sıralı
function scheduleRows(day: DolmusDaySchedule | undefined): [string, number[]][] {
  if (!day) return [];
  return Object.entries(day).sort(([a], [b]) => Number(a) - Number(b));
}

export const DolmusMapScreen: React.FC<DolmusMapScreenProps> = ({ visible, line, onClose }) => {
  const theme = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [day, setDay] = useState<DayKey>(todayKey());

  const html = useMemo(() => buildOsmHtml({ tileUrl: config.map.tileUrl }), []);

  // Harita hazır olunca dolmuş hattını çiz
  const pushDolmus = useCallback(() => {
    if (!line) return;
    const payload = JSON.stringify(line);
    webViewRef.current?.injectJavaScript(
      `window.updateDolmusData(${JSON.stringify(payload)}); true;`
    );
  }, [line]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'ready') pushDolmus();
      } catch {
        // sessiz geç
      }
    },
    [pushDolmus]
  );

  const rows = useMemo(() => scheduleRows(line?.schedule?.[day]), [line, day]);

  if (!line) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <View style={[styles.lineBadge, { backgroundColor: line.color || '#E11D2A' }]}>
            <Text style={styles.lineBadgeText}>{line.line}</Text>
          </View>
          <View style={styles.headerInfo}>
            {!!line.operator && (
              <Text style={[styles.operator, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {line.operator}
              </Text>
            )}
            <Text style={[styles.headerSub, { color: theme.colors.textSecondary }]}>
              {line.waypoints.length} durak{line.loop ? ' · halka' : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={[styles.closeBtnText, { color: theme.colors.textPrimary }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Harita */}
        <View style={styles.mapWrap}>
          <WebView
            ref={webViewRef}
            style={styles.webview}
            originWhitelist={['about:blank']}
            source={{ html }}
            javaScriptEnabled
            domStorageEnabled={false}
            allowFileAccess={false}
            mixedContentMode="never"
            onMessage={handleMessage}
            androidLayerType="hardware"
          />
        </View>

        {/* Gün sekmeleri */}
        <View style={[styles.tabs, { borderTopColor: theme.colors.border }]}>
          {DAY_TABS.map((t) => {
            const active = t.key === day;
            return (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.tab,
                  { backgroundColor: active ? (line.color || '#E11D2A') : theme.colors.surface },
                ]}
                onPress={() => setDay(t.key)}
              >
                <Text style={[styles.tabText, { color: active ? '#fff' : theme.colors.textSecondary }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Saat tablosu */}
        <ScrollView style={styles.schedule} contentContainerStyle={styles.scheduleContent}>
          <Text style={[styles.scheduleTitle, { color: theme.colors.textSecondary }]}>
            İlk duraktan ({line.firstStop}) hareket saatleri
          </Text>
          {rows.length === 0 ? (
            <Text style={[styles.empty, { color: theme.colors.textTertiary }]}>
              Bu gün için saat bilgisi yok.
            </Text>
          ) : (
            rows.map(([hour, mins]) => (
              <View key={hour} style={[styles.row, { borderBottomColor: theme.colors.borderLight }]}>
                <Text style={[styles.hour, { color: line.color || '#E11D2A' }]}>{hour}</Text>
                <Text style={[styles.mins, { color: theme.colors.textPrimary }]}>
                  {mins.map((m) => String(m).padStart(2, '0')).join('  ')}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingTop: 48,
    borderBottomWidth: 1,
    gap: 10,
  },
  lineBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  lineBadgeText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  headerInfo: { flex: 1 },
  operator: { fontSize: 13, fontWeight: '600' },
  headerSub: { fontSize: 12 },
  closeBtn: { padding: 8 },
  closeBtnText: { fontSize: 20, fontWeight: '700' },
  mapWrap: { flex: 1, minHeight: 220 },
  webview: { flex: 1, backgroundColor: '#e5e7eb' },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabText: { fontSize: 13, fontWeight: '700' },
  schedule: { maxHeight: 260 },
  scheduleContent: { paddingHorizontal: 14, paddingBottom: 24 },
  scheduleTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  hour: { width: 40, fontSize: 15, fontWeight: '800' },
  mins: { flex: 1, fontSize: 14, letterSpacing: 1 },
  empty: { paddingVertical: 16, fontSize: 13 },
});
