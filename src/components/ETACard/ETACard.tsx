import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { ETAResult } from '../../types/shared-types';

interface ETACardProps {
  result: ETAResult;
}

export const ETACard: React.FC<ETACardProps> = ({ result }) => {
  const theme = useTheme();

  const getStatusConfig = () => {
    switch (result.status) {
      case 'ok':
        if (result.etaMinutes !== null && result.etaMinutes !== undefined) {
          if (result.etaMinutes <= 2) {
            return {
              backgroundColor: theme.colors.error,
              statusText: 'Geliyor!',
              showMinutes: true,
            };
          }
          if (result.etaMinutes <= 5) {
            return {
              backgroundColor: theme.colors.warning,
              statusText: 'Yaklaşıyor',
              showMinutes: true,
            };
          }
          return {
            backgroundColor: theme.colors.success,
            statusText: 'Yolda',
            showMinutes: true,
          };
        }
        return {
          backgroundColor: theme.colors.textSecondary,
          statusText: 'Araç yok',
          showMinutes: false,
        };

      case 'no_vehicle_approaching':
        return {
          backgroundColor: theme.colors.textSecondary,
          statusText: 'Yaklaşan araç yok',
          showMinutes: false,
        };

      case 'no_nearby_stop':
        return {
          backgroundColor: theme.colors.textTertiary,
          statusText: 'Bu hat yakın duraklardan geçmiyor',
          showMinutes: false,
        };

      case 'error':
        return {
          backgroundColor: theme.colors.error,
          statusText: result.errorMessage || 'Hata oluştu',
          showMinutes: false,
        };

      default:
        return {
          backgroundColor: theme.colors.textSecondary,
          statusText: 'Bilinmiyor',
          showMinutes: false,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <View style={[styles.container, { backgroundColor: config.backgroundColor }]}>
      {result.line && (
        <View style={styles.lineContainer}>
          <Text style={[styles.lineLabel, { color: 'rgba(255,255,255,0.8)' }]}>
            Hat
          </Text>
          <Text style={styles.lineNumber}>{result.line}</Text>
          {result.direction && (
            <Text style={styles.directionText}>{result.direction}</Text>
          )}
        </View>
      )}

      <View style={styles.etaContainer}>
        {config.showMinutes && result.etaMinutes !== null && result.etaMinutes !== undefined ? (
          <>
            <Text style={styles.etaMinutes}>{result.etaMinutes}</Text>
            <Text style={styles.etaLabel}>dakika</Text>
          </>
        ) : (
          <Text style={styles.statusText}>{config.statusText}</Text>
        )}
      </View>

      {result.stopName && (
        <View style={styles.stopContainer}>
          <Text style={[styles.stopLabel, { color: 'rgba(255,255,255,0.8)' }]}>
            Durak
          </Text>
          <Text style={styles.stopName} numberOfLines={1}>
            {result.stopName}
          </Text>
        </View>
      )}

      {result.distance && (
        <Text style={[styles.distanceText, { color: 'rgba(255,255,255,0.7)' }]}>
          Otobüs {(result.distance / 1000).toFixed(1)} km uzakta
        </Text>
      )}

      {/* Tarifeli varış zamanları (Nimbus) */}
      {result.scheduledArrivals && result.scheduledArrivals.length > 0 && (
        <View style={styles.scheduledContainer}>
          <Text style={styles.scheduledTitle}>Tarifeli Varış Zamanları</Text>
          {result.scheduledArrivals.slice(0, 3).map((arrival, index) => (
            <View key={index} style={styles.scheduledRow}>
              <Text style={styles.scheduledLine}>{arrival.line}</Text>
              <Text style={styles.scheduledDirection}>{arrival.direction}</Text>
              <Text style={styles.scheduledTime}>{arrival.etaMinutes} dk</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  lineContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  lineLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  lineNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  directionText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  etaContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  etaMinutes: {
    fontSize: 72,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 80,
  },
  etaLabel: {
    fontSize: 18,
    fontWeight: '500',
    color: '#fff',
    marginTop: -4,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    paddingVertical: 20,
  },
  stopContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  stopLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  stopName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  distanceText: {
    fontSize: 12,
    marginTop: 8,
  },
  scheduledContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    width: '100%',
  },
  scheduledTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
    textAlign: 'center',
  },
  scheduledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    marginBottom: 4,
  },
  scheduledLine: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    width: 45,
  },
  scheduledDirection: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    flex: 1,
    marginLeft: 8,
  },
  scheduledTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});
