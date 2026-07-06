const graph = require('../src/data/transit/graph-core.json');

const WALK_SPEED_M_PER_MIN = 5000 / 60;
const TRANSFER_PENALTY_MIN = 6;
const DEFAULT_BUS_SPEED_KMH = 22;

const MAX_INDEX_MS = 120;
const MAX_AVG_QUERY_MS = 220;
const MAX_SLOW_QUERY_MS = 600;

function distanceMeters(a, b) {
  const toRad = (value) => (value * Math.PI) / 180;
  const radius = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function roundMinutes(value) {
  return Math.max(1, Math.round(value));
}

function distanceAlongSegments(segmentMeters, fromIndex, toIndex) {
  if (!segmentMeters || segmentMeters.length < toIndex) return null;
  return segmentMeters.slice(fromIndex, toIndex).reduce((sum, meters) => sum + meters, 0);
}

function buildIndexes() {
  const start = performance.now();
  const stopById = new Map(graph.stops.map((stop) => [stop.id, stop]));
  const stopPatternIndex = new Map();
  const transferIndex = new Map();

  const patterns = graph.patterns
    .map((pattern) => ({
      ...pattern,
      stops: pattern.stopIds.map((stopId) => stopById.get(stopId)).filter(Boolean),
    }))
    .filter((pattern) => pattern.stops.length >= 2);

  patterns.forEach((pattern) => {
    pattern.stops.forEach((stop, index) => {
      const matches = stopPatternIndex.get(stop.id) || [];
      matches.push({ pattern, index });
      stopPatternIndex.set(stop.id, matches);
    });
  });

  graph.transfers.forEach((transfer) => {
    const toStop = stopById.get(transfer.toStopId);
    if (!toStop) return;
    const transfers = transferIndex.get(transfer.fromStopId) || [];
    transfers.push({ stop: toStop, distance: transfer.distanceMeters });
    transferIndex.set(transfer.fromStopId, transfers);
  });

  return {
    indexMs: performance.now() - start,
    stops: graph.stops,
    patterns,
    stopPatternIndex,
    transferIndex,
  };
}

function nearbyStops(indexes, point, radiusMeters, fallbackLimit) {
  const nearby = indexes.stops
    .map((stop) => ({
      stop,
      distance: distanceMeters(point, stop.coordinates),
    }))
    .sort((a, b) => a.distance - b.distance);

  const selected = new Map();
  const modes = ['bus', 'tram', 'dolmus'];
  const perModeLimit = Math.max(2, Math.ceil(fallbackLimit / modes.length));

  modes.forEach((mode) => {
    const modeStops = nearby.filter((entry) => entry.stop.mode === mode);
    const withinRadius = modeStops.filter((entry) => entry.distance <= radiusMeters);
    const candidates = withinRadius.length > 0 ? withinRadius : modeStops.slice(0, 1);
    candidates.slice(0, perModeLimit).forEach((entry) => selected.set(entry.stop.id, entry));
  });

  nearby.slice(0, fallbackLimit).forEach((entry) => {
    if (selected.size < fallbackLimit) selected.set(entry.stop.id, entry);
  });

  return [...selected.values()].sort((a, b) => a.distance - b.distance).slice(0, fallbackLimit);
}

function transitLegMinutes(pattern, fromIndex, toIndex) {
  const distance =
    distanceAlongSegments(pattern.segmentMeters, fromIndex, toIndex) ||
    distanceMeters(pattern.stops[fromIndex].coordinates, pattern.stops[toIndex].coordinates);
  const averageSpeed = pattern.mode === 'tram' ? 24 : DEFAULT_BUS_SPEED_KMH;
  const rideMin = roundMinutes(((distance * 1.25) / 1000 / averageSpeed) * 60);
  return rideMin + (pattern.defaultWaitMin || 10);
}

function plan(indexes, origin, destination, resultLimit = 5) {
  const originStops = nearbyStops(indexes, origin, 650, 12);
  const destinationStops = nearbyStops(indexes, destination, 650, 12);
  const destinationByStopId = new Map(destinationStops.map((entry) => [entry.stop.id, entry]));
  const journeys = [];

  for (const originStop of originStops) {
    const originMatches = indexes.stopPatternIndex.get(originStop.stop.id) || [];

    for (const { pattern, index: fromIndex } of originMatches) {
      for (let toIndex = fromIndex + 1; toIndex < pattern.stops.length; toIndex += 1) {
        const destinationStop = destinationByStopId.get(pattern.stops[toIndex].id);
        if (!destinationStop) continue;

        const total =
          originStop.distance / WALK_SPEED_M_PER_MIN +
          transitLegMinutes(pattern, fromIndex, toIndex) +
          destinationStop.distance / WALK_SPEED_M_PER_MIN;
        journeys.push({ total, signature: `${pattern.id}:${originStop.stop.id}:${destinationStop.stop.id}` });
      }

      const maxTransferIndex = Math.min(pattern.stops.length, fromIndex + 14);
      for (let transferFromIndex = fromIndex + 1; transferFromIndex < maxTransferIndex; transferFromIndex += 1) {
        const transferFrom = pattern.stops[transferFromIndex];
        const transferCandidates = (indexes.transferIndex.get(transferFrom.id) || []).slice(0, 4);

        for (const transferTo of transferCandidates) {
          const secondMatches = indexes.stopPatternIndex.get(transferTo.stop.id) || [];

          for (const { pattern: secondPattern, index: transferToIndex } of secondMatches) {
            if (secondPattern.id === pattern.id) continue;

            for (let toIndex = transferToIndex + 1; toIndex < secondPattern.stops.length; toIndex += 1) {
              const destinationStop = destinationByStopId.get(secondPattern.stops[toIndex].id);
              if (!destinationStop) continue;

              const total =
                originStop.distance / WALK_SPEED_M_PER_MIN +
                transitLegMinutes(pattern, fromIndex, transferFromIndex) +
                transferTo.distance / WALK_SPEED_M_PER_MIN +
                transitLegMinutes(secondPattern, transferToIndex, toIndex) +
                destinationStop.distance / WALK_SPEED_M_PER_MIN +
                TRANSFER_PENALTY_MIN;
              journeys.push({
                total,
                signature: `${pattern.id}:${originStop.stop.id}:${transferFrom.id}|${secondPattern.id}:${transferTo.stop.id}:${destinationStop.stop.id}`,
              });
            }
          }
        }
      }
    }
  }

  const seen = new Set();
  return journeys
    .sort((a, b) => a.total - b.total)
    .filter((journey) => {
      if (seen.has(journey.signature)) return false;
      seen.add(journey.signature);
      return true;
    })
    .slice(0, resultLimit);
}

function representativeStops() {
  const byMode = new Map();
  graph.stops.forEach((stop) => {
    const stops = byMode.get(stop.mode) || [];
    stops.push(stop);
    byMode.set(stop.mode, stops);
  });

  const pick = (mode, ratio) => {
    const stops = byMode.get(mode) || graph.stops;
    return stops[Math.min(stops.length - 1, Math.floor(stops.length * ratio))];
  };

  return [
    [pick('bus', 0.05), pick('bus', 0.75)],
    [pick('bus', 0.2), pick('tram', 0.65)],
    [pick('tram', 0.15), pick('bus', 0.85)],
    [pick('dolmus', 0.05), pick('bus', 0.55)],
    [pick('bus', 0.45), pick('dolmus', 0.85)],
  ];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const indexes = buildIndexes();
  const samples = representativeStops();
  const queryResults = samples.map(([origin, destination]) => {
    const start = performance.now();
    const journeys = plan(indexes, origin.coordinates, destination.coordinates);
    return {
      origin: origin.id,
      destination: destination.id,
      elapsedMs: performance.now() - start,
      journeys: journeys.length,
    };
  });

  const avgQueryMs = queryResults.reduce((sum, result) => sum + result.elapsedMs, 0) / queryResults.length;
  const slowestQueryMs = Math.max(...queryResults.map((result) => result.elapsedMs));
  const noResult = queryResults.filter((result) => result.journeys === 0);

  assert(indexes.indexMs <= MAX_INDEX_MS, `Transit index build took ${indexes.indexMs.toFixed(1)}ms`);
  assert(avgQueryMs <= MAX_AVG_QUERY_MS, `Average route query took ${avgQueryMs.toFixed(1)}ms`);
  assert(slowestQueryMs <= MAX_SLOW_QUERY_MS, `Slowest route query took ${slowestQueryMs.toFixed(1)}ms`);
  assert(noResult.length === 0, `Route benchmark had no-result samples: ${noResult.map((item) => `${item.origin}->${item.destination}`).join(', ')}`);

  console.log(
    `Transit routing benchmark passed: index=${indexes.indexMs.toFixed(1)}ms avgQuery=${avgQueryMs.toFixed(1)}ms slowest=${slowestQueryMs.toFixed(1)}ms`
  );
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
