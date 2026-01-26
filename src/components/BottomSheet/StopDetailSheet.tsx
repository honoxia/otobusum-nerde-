import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useTheme } from '../../theme';
import { Chip } from '../common';
import { BusStop } from '../../types/shared-types';

interface StopDetailSheetProps {
  stop: BusStop | null;
  distance?: number;
  onLinePress?: (line: string) => void;
  onClose?: () => void;
}

export interface StopDetailSheetRef {
  snapToIndex: (index: number) => void;
  close: () => void;
}

export const StopDetailSheet = forwardRef<StopDetailSheetRef, StopDetailSheetProps>(
  ({ stop, distance, onLinePress, onClose }, ref) => {
    const theme = useTheme();
    const [visible, setVisible] = useState(false);

    useImperativeHandle(ref, () => ({
      snapToIndex: (index: number) => {
        if (index >= 0) setVisible(true);
        else setVisible(false);
      },
      close: () => setVisible(false),
    }));

    const formatDistance = (meters: number): string => {
      if (meters < 1000) {
        return `${Math.round(meters)} m`;
      }
      return `${(meters / 1000).toFixed(1)} km`;
    };

    const handleClose = () => {
      setVisible(false);
      onClose?.();
    };

    const handleLinePress = (line: string) => {
      onLinePress?.(line);
      handleClose();
    };

    if (!stop) return null;

    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} onPress={handleClose} />
          <View style={[styles.sheet, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />

            <ScrollView contentContainerStyle={styles.content}>
              <View style={styles.header}>
                <View style={[styles.stopIcon, { backgroundColor: theme.colors.warning }]}>
                  <Text style={styles.stopIconText}>●</Text>
                </View>
                <View style={styles.headerText}>
                  <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
                    {stop.name}
                  </Text>
                  {distance !== undefined && (
                    <Text style={[styles.distance, { color: theme.colors.textSecondary }]}>
                      {formatDistance(distance)} uzaklıkta
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                  Bu duraktan geçen hatlar
                </Text>
                <View style={styles.chipsGrid}>
                  {stop.lines.map((line) => (
                    <Chip
                      key={line}
                      label={line}
                      variant="outlined"
                      color="primary"
                      size="md"
                      onPress={() => handleLinePress(line)}
                      style={styles.chip}
                    />
                  ))}
                </View>
              </View>

              <View style={[styles.infoSection, { borderTopColor: theme.colors.border }]}>
                <Text style={[styles.infoText, { color: theme.colors.textTertiary }]}>
                  Hat numarasına tıklayarak tahmini varış süresini sorgulayabilirsiniz.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }
);

StopDetailSheet.displayName = 'StopDetailSheet';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.6,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  content: {
    padding: 20,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  stopIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stopIconText: {
    color: '#fff',
    fontSize: 16,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  distance: {
    fontSize: 14,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginBottom: 4,
  },
  infoSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  infoText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
