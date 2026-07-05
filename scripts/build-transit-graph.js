const fs = require('fs');
const path = require('path');

const stopsData = require('../src/data/stops-data.json');
const routesData = require('../src/data/routes-data.json');
const tramData = require('../src/data/tram-data.json');
const dolmusData = require('../src/data/dolmus-data.json');

const OUT_DIR = path.join(__dirname, '..', 'src', 'data', 'transit');
const VERSION = '1.1-phase-a';
const GENERATED_AT = readExistingGeneratedAt() || new Date().toISOString();

const MAX_BYTES = {
  'graph-core.json': 1_250_000,
  'shapes.json': 800_000,
  'schedules.json': 100_000,
};

const DEFAULT_WAIT_MIN = {
  bus: 10,
  tram: 6,
  dolmus: 8,
};
const WALK_SPEED_M_PER_MIN = 5000 / 60;
const TRANSFER_RADIUS_M = 250;
const MAX_TRANSFERS_PER_STOP = 6;

function readExistingGeneratedAt() {
  try {
    const corePath = path.join(OUT_DIR, 'graph-core.json');
    if (!fs.existsSync(corePath)) return null;
    const core = JSON.parse(fs.readFileSync(corePath, 'utf8'));
    return core?.metadata?.version === VERSION ? core.metadata.generatedAt : null;
  } catch {
    return null;
  }
}

function roundCoord(value) {
  return Number(value.toFixed(5));
}

function roundCoordinates(coordinates) {
  return {
    latitude: roundCoord(coordinates.latitude),
    longitude: roundCoord(coordinates.longitude),
  };
}

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

function nearestPathOffset(point, coordinates, cumulative) {
  let nearest = null;
  for (let i = 0; i < coordinates.length; i += 1) {
    const distance = distanceMeters(point, coordinates[i]);
    if (!nearest || distance < nearest.distance) {
      nearest = { distance, offset: cumulative[i] };
    }
  }
  return nearest ? nearest.offset : null;
}

function pathCumulative(coordinates) {
  const cumulative = [0];
  for (let i = 1; i < coordinates.length; i += 1) {
    cumulative.push(cumulative[i - 1] + distanceMeters(coordinates[i - 1], coordinates[i]));
  }
  return cumulative;
}

function segmentMeters(stops, shapeCoordinates) {
  if (!shapeCoordinates || shapeCoordinates.length < 2) {
    return stops.slice(0, -1).map((stop, index) => Math.round(distanceMeters(stop.coordinates, stops[index + 1].coordinates)));
  }

  const cumulative = pathCumulative(shapeCoordinates);
  const offsets = stops.map((stop) => nearestPathOffset(stop.coordinates, shapeCoordinates, cumulative));
  return stops.slice(0, -1).map((stop, index) => {
    const from = offsets[index];
    const to = offsets[index + 1];
    if (from !== null && to !== null && to > from) {
      return Math.round(to - from);
    }
    return Math.round(distanceMeters(stop.coordinates, stops[index + 1].coordinates));
  });
}

function slugify(value) {
  return (
    String(value)
      .toLocaleLowerCase('tr-TR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0131/g, 'i')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'variant'
  );
}

function directionKey(direction, index) {
  const normalized = slugify(direction);
  if (normalized.includes('gidis')) return 'gidis';
  if (normalized.includes('donus')) return 'donus';
  return `variant-${index + 1}`;
}

function routeId(mode, line) {
  return `${mode}:${slugify(line)}`;
}

function busPatternId(line, direction, index) {
  return `${routeId('bus', line)}:${directionKey(direction, index)}`;
}

function tramPatternId(line, index) {
  return `${routeId('tram', line.ref || line.name)}:variant-${index + 1}`;
}

function dolmusPatternId(line) {
  return `${routeId('dolmus', line.line)}:${line.loop ? 'loop' : 'main'}`;
}

function collectDepartures(daySchedule) {
  return Object.entries(daySchedule || {})
    .flatMap(([hour, minutes]) => (minutes || []).map((minute) => Number(hour) * 60 + minute))
    .filter((minute) => Number.isFinite(minute))
    .sort((a, b) => a - b);
}

function frequencyFromDepartures(id, patternId, serviceId, departures) {
  if (departures.length < 2) return null;

  const gaps = departures.slice(1).map((minute, index) => minute - departures[index]).filter((gap) => gap > 0);
  if (gaps.length === 0) return null;

  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  return {
    id,
    patternId,
    serviceId,
    startMin: departures[0],
    endMin: departures[departures.length - 1],
    headwayMin: Math.max(1, Math.round(median)),
  };
}

function orderTramStops(line, stops) {
  const coordinates = line.paths.flat().map(roundCoordinates);
  if (coordinates.length < 2) return [];

  const cumulative = pathCumulative(coordinates);
  return stops
    .filter((stop) => stop.lines.includes(line.ref))
    .map((stop) => ({ stop, offset: nearestPathOffset(stop.coordinates, coordinates, cumulative) }))
    .filter((entry) => entry.offset !== null)
    .sort((a, b) => a.offset - b.offset)
    .map((entry) => entry.stop);
}

function buildGraph() {
  const stops = [];
  const routes = [];
  const patterns = [];
  const shapes = [];
  const frequencies = [];
  const routeIds = new Set();

  const busStopBySourceId = new Map();
  stopsData.forEach((stop) => {
    if (!stop.wialonId) return;

    const graphStop = {
      id: `bus:${stop.wialonId}`,
      sourceId: stop.wialonId,
      source: 'asis',
      mode: 'bus',
      name: stop.name,
      coordinates: roundCoordinates(stop.coordinates),
      lines: stop.lines,
    };
    stops.push(graphStop);
    busStopBySourceId.set(stop.wialonId, graphStop);
  });

  routesData.forEach((lineRoutes) => {
    const id = routeId('bus', lineRoutes.line);
    if (!routeIds.has(id)) {
      routes.push({
        id,
        mode: 'bus',
        line: lineRoutes.line,
        source: 'asis',
      });
      routeIds.add(id);
    }

    lineRoutes.routes.forEach((route, index) => {
      const patternStops = route.stopIds.map((stopId) => busStopBySourceId.get(stopId)).filter(Boolean);
      if (patternStops.length < 2) return;

      patterns.push({
        id: busPatternId(lineRoutes.line, route.direction, index),
        routeId: id,
        mode: 'bus',
        line: lineRoutes.line,
        directionKey: directionKey(route.direction, index),
        directionName: route.direction,
        source: 'asis',
        sourceRouteIds: [route.routeId],
        stopIds: patternStops.map((stop) => stop.id),
        segmentMeters: segmentMeters(patternStops),
        defaultWaitMin: DEFAULT_WAIT_MIN.bus,
      });
    });
  });

  const tramStops = tramData.stops.map((stop) => ({
    id: `tram:${stop.id}`,
    sourceId: stop.osmId,
    source: 'osm',
    mode: 'tram',
    name: stop.name,
    coordinates: roundCoordinates(stop.coordinates),
    lines: stop.lines,
  }));
  stops.push(...tramStops);

  tramData.lines.forEach((line, index) => {
    const id = routeId('tram', line.ref || line.name);
    const patternId = tramPatternId(line, index);
    const shapeId = `${patternId}:shape`;
    const shapeCoordinates = line.paths.flat().map(roundCoordinates);
    const patternStops = orderTramStops(line, tramStops);

    if (!routeIds.has(id)) {
      routes.push({
        id,
        mode: 'tram',
        line: line.ref || line.name,
        color: line.color,
        source: 'osm',
      });
      routeIds.add(id);
    }

    if (patternStops.length < 2) return;
    patterns.push({
      id: patternId,
      routeId: id,
      mode: 'tram',
      line: line.ref || line.name,
      directionKey: `variant-${index + 1}`,
      directionName: [line.from, line.to].filter(Boolean).join(' - ') || line.name,
      source: 'osm',
      sourceRouteIds: [line.osmId],
      stopIds: patternStops.map((stop) => stop.id),
      segmentMeters: segmentMeters(patternStops, shapeCoordinates),
      shapeId,
      defaultWaitMin: DEFAULT_WAIT_MIN.tram,
    });
    shapes.push({ id: shapeId, patternId, coordinates: shapeCoordinates });
  });

  dolmusData.forEach((line, lineIndex) => {
    const id = routeId('dolmus', line.line);
    const patternId = dolmusPatternId(line);
    const shapeId = `${patternId}:shape`;
    const shapeCoordinates = line.path.map(roundCoordinates);
    const patternStops = line.waypoints
      .filter((waypoint) => waypoint.coordinates)
      .map((waypoint, waypointIndex) => ({
        id: `dolmus:${lineIndex}:${waypointIndex}`,
        source: 'static',
        mode: 'dolmus',
        name: waypoint.name,
        coordinates: roundCoordinates(waypoint.coordinates),
        lines: [line.line],
      }));

    if (!routeIds.has(id)) {
      routes.push({
        id,
        mode: 'dolmus',
        line: line.line,
        color: line.color,
        source: 'static',
      });
      routeIds.add(id);
    }
    stops.push(...patternStops);

    if (patternStops.length < 2) return;
    patterns.push({
      id: patternId,
      routeId: id,
      mode: 'dolmus',
      line: line.line,
      directionKey: line.loop ? 'loop' : 'main',
      directionName: line.loop ? 'Ring' : line.firstStop,
      source: 'static',
      sourceRouteIds: [],
      stopIds: patternStops.map((stop) => stop.id),
      segmentMeters: segmentMeters(patternStops, shapeCoordinates),
      shapeId,
      scheduleIds: ['weekday', 'saturday', 'sunday'].map((serviceId) => `${patternId}:${serviceId}`),
      defaultWaitMin: DEFAULT_WAIT_MIN.dolmus,
    });
    shapes.push({ id: shapeId, patternId, coordinates: shapeCoordinates });

    ['weekday', 'saturday', 'sunday'].forEach((serviceId) => {
      const frequency = frequencyFromDepartures(
        `${patternId}:${serviceId}`,
        patternId,
        serviceId,
        collectDepartures(line.schedule?.[serviceId])
      );
      if (frequency) frequencies.push(frequency);
    });
  });

  const transfers = buildTransfers(stops);

  return {
    core: {
      metadata: {
        version: VERSION,
        generatedAt: GENERATED_AT,
        sources: ['asis', 'osm', 'static'],
      },
      stops,
      routes,
      patterns,
      transfers,
    },
    shapes: {
      metadata: {
        version: VERSION,
        generatedAt: GENERATED_AT,
      },
      shapes,
    },
    schedules: {
      metadata: {
        version: VERSION,
        generatedAt: GENERATED_AT,
      },
      frequencies,
    },
  };
}

function transferBucketKey(coordinates) {
  return `${Math.floor(coordinates.latitude * 1000)}:${Math.floor(coordinates.longitude * 1000)}`;
}

function neighborBucketKeys(coordinates) {
  const lat = Math.floor(coordinates.latitude * 1000);
  const lon = Math.floor(coordinates.longitude * 1000);
  const keys = [];

  for (let dLat = -1; dLat <= 1; dLat += 1) {
    for (let dLon = -1; dLon <= 1; dLon += 1) {
      keys.push(`${lat + dLat}:${lon + dLon}`);
    }
  }

  return keys;
}

function buildTransfers(stops) {
  const buckets = new Map();
  stops.forEach((stop) => {
    const key = transferBucketKey(stop.coordinates);
    const bucket = buckets.get(key) || [];
    bucket.push(stop);
    buckets.set(key, bucket);
  });

  return stops.flatMap((fromStop) => {
    const candidates = neighborBucketKeys(fromStop.coordinates)
      .flatMap((key) => buckets.get(key) || [])
      .filter((toStop) => toStop.id !== fromStop.id)
      .map((toStop) => ({
        fromStopId: fromStop.id,
        toStopId: toStop.id,
        distanceMeters: Math.round(distanceMeters(fromStop.coordinates, toStop.coordinates)),
      }))
      .filter((transfer) => transfer.distanceMeters <= TRANSFER_RADIUS_M)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, MAX_TRANSFERS_PER_STOP);

    return candidates.map((transfer) => ({
      ...transfer,
      walkMin: Math.max(1, Math.round(transfer.distanceMeters / WALK_SPEED_M_PER_MIN)),
    }));
  });
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });
  return [...duplicates];
}

function assertValidGraph(graph) {
  const errors = [];
  const stopIds = new Set(graph.core.stops.map((stop) => stop.id));
  const routeIds = new Set(graph.core.routes.map((route) => route.id));
  const patternIds = new Set(graph.core.patterns.map((pattern) => pattern.id));
  const shapeIds = new Set(graph.shapes.shapes.map((shape) => shape.id));

  const duplicateStops = findDuplicates(graph.core.stops.map((stop) => stop.id));
  const duplicateRoutes = findDuplicates(graph.core.routes.map((route) => route.id));
  const duplicatePatterns = findDuplicates(graph.core.patterns.map((pattern) => pattern.id));
  const duplicateShapes = findDuplicates(graph.shapes.shapes.map((shape) => shape.id));

  if (duplicateStops.length) errors.push(`Duplicate stop ids: ${duplicateStops.slice(0, 5).join(', ')}`);
  if (duplicateRoutes.length) errors.push(`Duplicate route ids: ${duplicateRoutes.slice(0, 5).join(', ')}`);
  if (duplicatePatterns.length) errors.push(`Duplicate pattern ids: ${duplicatePatterns.slice(0, 5).join(', ')}`);
  if (duplicateShapes.length) errors.push(`Duplicate shape ids: ${duplicateShapes.slice(0, 5).join(', ')}`);

  graph.core.patterns.forEach((pattern) => {
    if (!routeIds.has(pattern.routeId)) {
      errors.push(`Pattern ${pattern.id} references missing route ${pattern.routeId}`);
    }

    const missingStops = pattern.stopIds.filter((stopId) => !stopIds.has(stopId));
    if (missingStops.length) {
      errors.push(`Pattern ${pattern.id} references missing stops ${missingStops.slice(0, 5).join(', ')}`);
    }

    if (pattern.segmentMeters && pattern.segmentMeters.length !== pattern.stopIds.length - 1) {
      errors.push(`Pattern ${pattern.id} has ${pattern.segmentMeters.length} segments for ${pattern.stopIds.length} stops`);
    }

    if (pattern.shapeId && !shapeIds.has(pattern.shapeId)) {
      errors.push(`Pattern ${pattern.id} references missing shape ${pattern.shapeId}`);
    }

    if (pattern.mode === 'bus' && pattern.id.includes(':route-')) {
      errors.push(`Pattern ${pattern.id} appears to include an unstable source route id`);
    }
  });

  graph.core.transfers.forEach((transfer) => {
    if (!stopIds.has(transfer.fromStopId)) {
      errors.push(`Transfer references missing fromStop ${transfer.fromStopId}`);
    }
    if (!stopIds.has(transfer.toStopId)) {
      errors.push(`Transfer references missing toStop ${transfer.toStopId}`);
    }
    if (transfer.distanceMeters < 0 || transfer.walkMin <= 0) {
      errors.push(`Transfer ${transfer.fromStopId} -> ${transfer.toStopId} has invalid distance/walk time`);
    }
  });

  graph.shapes.shapes.forEach((shape) => {
    if (!patternIds.has(shape.patternId)) {
      errors.push(`Shape ${shape.id} references missing pattern ${shape.patternId}`);
    }
    if (shape.coordinates.length < 2) {
      errors.push(`Shape ${shape.id} has fewer than 2 coordinates`);
    }
  });

  graph.schedules.frequencies.forEach((frequency) => {
    if (!patternIds.has(frequency.patternId)) {
      errors.push(`Frequency ${frequency.id} references missing pattern ${frequency.patternId}`);
    }
    if (frequency.endMin <= frequency.startMin || frequency.headwayMin <= 0) {
      errors.push(`Frequency ${frequency.id} has invalid time window/headway`);
    }
  });

  if (errors.length) {
    throw new Error(`Transit graph validation failed:\n- ${errors.join('\n- ')}`);
  }
}

function writeJson(filename, value) {
  const json = `${JSON.stringify(value)}\n`;
  const byteLength = Buffer.byteLength(json, 'utf8');
  const maxBytes = MAX_BYTES[filename];
  if (maxBytes && byteLength > maxBytes) {
    throw new Error(`${filename} is ${byteLength} bytes, over the ${maxBytes} byte budget`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, filename), json);
  return byteLength;
}

const graph = buildGraph();
assertValidGraph(graph);

const sizes = {
  core: writeJson('graph-core.json', graph.core),
  shapes: writeJson('shapes.json', graph.shapes),
  schedules: writeJson('schedules.json', graph.schedules),
};

console.log(
  `Transit graph built: ${graph.core.stops.length} stops, ${graph.core.routes.length} routes, ${graph.core.patterns.length} patterns, ${graph.core.transfers.length} transfers, ${graph.shapes.shapes.length} shapes, ${graph.schedules.frequencies.length} frequencies`
);
console.log(`Transit graph sizes: core=${sizes.core}B shapes=${sizes.shapes}B schedules=${sizes.schedules}B`);
