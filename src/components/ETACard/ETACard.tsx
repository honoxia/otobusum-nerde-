import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { ETAResult } from '../../types/shared-types';

interface ETACardProps {
  result: ETAResult;
}

export const ETACard: React.FC<ETACardProps> = ({ result }) => {
  const { colors } = useTheme();

  // Duruma göre aksan rengi + kısa etiket
  const getStatus = (): { color: string; label: string; showMinutes: boolean } => {
    if (result.status === 'ok' && result.etaMinutes != null) {
      if (result.etaMinutes <= 2) return { color: colors.error, label: 'Geliyor!', showMinutes: true };
      if (result.etaMinutes <= 5) return { color: colors.warning, label: 'Yaklaşıyor', showMinutes: true };
      return { color: colors.success, label: 'Yolda', showMinutes: true };
    }
    if (result.status === 'no_vehicle_approaching') {
      return { color: colors.textTertiary, label: 'Yaklaşan araç yok', showMinutes: false };
    }
    if (result.status === 'no_nearby_stop') {
      return { color: colors.textTertiary, label: 'Bu hat yakın duraklardan geçmiyor', showMinutes: false };
    }
    return { color: colors.error, label: result.errorMessage || 'Hata oluştu', showMinutes: false };
  };

  const s = getStatus();

  return (
    <View>
      <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderLeftColor: s.color }]}>
        {/* Üst satır: hat rozeti + durum + durak */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {result.line && (
              <View style={[styles.lineBadge, { backgroundColor: s.color }]}>
                <Text style={styles.lineBadgeText}>{result.line}</Text>
              </View>
            )}
            <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
          </View>
          {result.stopName && (
            <Text style={[styles.stopName, { color: colors.textSecondary }]} numberOfLines={1}>
              {result.stopName}
            </Text>
          )}
        </View>

        {s.showMinutes && result.etaMinutes != null ? (
          <>
            <View style={styles.etaRow}>
              <Text style={[styles.etaBig, { color: colors.textPrimary }]}>{result.etaMinutes}</Text>
              <Text style={[styles.etaUnit, { color: colors.textSecondary }]}>dakika</Text>
            </View>
            {result.distance != null && (
              <Text style={[styles.distance, { color: colors.textSecondary }]}>
                Otobüs {(result.distance / 1000).toFixed(1)} km uzakta
              </Text>
            )}
          </>
        ) : (
          !result.line && <Text style={[styles.bareStatus, { color: colors.textPrimary }]}>{s.label}</Text>
        )}
      </View>

      {/* Sonraki seferler (Nimbus tarifeli) */}
      {result.scheduledArrivals && result.scheduledArrivals.length > 0 && (
        <View style={[styles.schedule, { backgroundColor: colors.surface }]}>
          <View style={[styles.scheduleHeader, { borderBottomColor: colors.divider }]}>
            <Text style={[styles.scheduleTitle, { color: colors.textPrimary }]}>Sonraki Seferler</Text>
          </View>
          {result.scheduledArrivals.slice(0, 3).map((a, i) => (
            <View
              key={i}
              style={[styles.scheduleRow, i < Math.min(result.scheduledArrivals!.length, 3) - 1 && { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}
            >
              <View style={styles.scheduleLeft}>
                <View style={[styles.schedBadge, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={[styles.schedBadgeText, { color: colors.textPrimary }]}>{a.line}</Text>
                </View>
                <Text style={[styles.schedDir, { color: colors.textPrimary }]} numberOfLines={1}>{a.direction}</Text>
              </View>
              <Text style={[styles.schedEta, { color: i === 0 ? colors.primaryLight : colors.textSecondary }]}>{a.etaMinutes} dk</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  lineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  lineBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  stopName: {
    fontSize: 12,
    flexShrink: 1,
    textAlign: 'right',
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 14,
  },
  etaBig: {
    fontSize: 48,
    lineHeight: 50,
    fontWeight: '800',
    letterSpacing: -1,
  },
  etaUnit: {
    fontSize: 20,
    fontWeight: '600',
  },
  distance: {
    fontSize: 16,
    marginTop: 4,
  },
  bareStatus: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  schedule: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  scheduleHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scheduleTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  scheduleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  schedBadge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  schedBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  schedDir: {
    fontSize: 16,
    flexShrink: 1,
  },
  schedEta: {
    fontSize: 16,
    fontWeight: '500',
  },
});
