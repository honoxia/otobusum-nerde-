import { useState, useEffect, useCallback, useRef } from 'react';
import { BusPosition } from '../types/shared-types';
import mqttService from '../services/mqtt/MqttService';
import { config } from '../config';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseLiveVehiclesResult {
  vehicles: BusPosition[];
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  error: string | null;
  reconnect: () => void;
}

// Vehicle position TTL (default 5 minutes)
const VEHICLE_TTL_MS = config.app.vehiclePositionTtlMs;

/**
 * useLiveVehicles Hook
 * MQTT üzerinden canlı araç verilerini takip eder
 */
export function useLiveVehicles(lines?: string[]): UseLiveVehiclesResult {
  const [vehicles, setVehicles] = useState<Map<string, BusPosition>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const cleanupInterval = useRef<NodeJS.Timeout | null>(null);

  // Vehicle update handler
  const handleVehicleUpdate = useCallback((vehicle: BusPosition) => {
    if (!isMounted.current) return;

    // Filter by lines if specified
    if (lines && lines.length > 0 && !lines.includes(vehicle.line)) {
      return;
    }

    setVehicles((prev) => {
      const next = new Map(prev);
      next.set(vehicle.deviceId, vehicle);
      return next;
    });
  }, [lines]);

  // Status change handler
  const handleStatusChange = useCallback((status: ConnectionStatus, err?: string) => {
    if (!isMounted.current) return;

    setConnectionStatus(status);
    if (err) {
      setError(err);
    } else if (status === 'connected') {
      setError(null);
    }
  }, []);

  // Cleanup old vehicles
  const cleanupOldVehicles = useCallback(() => {
    const now = Date.now();
    setVehicles((prev) => {
      const next = new Map(prev);
      let removed = 0;

      for (const [deviceId, vehicle] of next) {
        if (now - vehicle.timestamp > VEHICLE_TTL_MS) {
          next.delete(deviceId);
          removed++;
        }
      }

      if (removed > 0) {
        console.log(`[useLiveVehicles] Removed ${removed} stale vehicles`);
      }

      return next;
    });
  }, []);

  // Connect on mount
  useEffect(() => {
    isMounted.current = true;

    // Subscribe to updates
    const unsubVehicle = mqttService.onVehicleUpdate(handleVehicleUpdate);
    const unsubStatus = mqttService.onStatusChange(handleStatusChange);

    // Connect to MQTT
    mqttService.connect();

    // Start cleanup interval (every 30 seconds)
    cleanupInterval.current = setInterval(cleanupOldVehicles, 30000);

    return () => {
      isMounted.current = false;
      unsubVehicle();
      unsubStatus();

      if (cleanupInterval.current) {
        clearInterval(cleanupInterval.current);
        cleanupInterval.current = null;
      }

      // Don't disconnect - let other components use the connection
    };
  }, [handleVehicleUpdate, handleStatusChange, cleanupOldVehicles]);

  // Clear vehicles when lines filter changes
  useEffect(() => {
    if (lines && lines.length > 0) {
      setVehicles((prev) => {
        const next = new Map<string, BusPosition>();
        for (const [deviceId, vehicle] of prev) {
          if (lines.includes(vehicle.line)) {
            next.set(deviceId, vehicle);
          }
        }
        return next;
      });
    }
  }, [lines?.join(',')]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    setError(null);
    setVehicles(new Map());
    mqttService.disconnect();
    mqttService.connect();
  }, []);

  // Convert Map to array
  const vehicleArray = Array.from(vehicles.values());

  return {
    vehicles: vehicleArray,
    isConnected: connectionStatus === 'connected',
    connectionStatus,
    error,
    reconnect,
  };
}

export default useLiveVehicles;
