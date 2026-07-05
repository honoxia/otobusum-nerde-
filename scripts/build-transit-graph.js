const fs = require('fs');
const path = require('path');

const stopsData = require('../src/data/stops-data.json');
const routesData = require('../src/data/routes-data.json');
const tramData = require('../src/data/tram-data.json');
const tramScheduleData = require('../src/data/tram-schedule.json');
const dolmusData = require('../src/data/dolmus-data.json');
const tramStopOffsetsData = require('../src/data/tram-stop-offsets.json');

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

const TRAM_ROUTE_CONFIG = {
  '845': { lineRef: '36', from: 'OGU', to: 'OTOGAR' },
  '846': { lineRef: '36', from: 'OTOGAR', to: 'OGU' },
  '847': { lineRef: 'T9', from: 'SSK', to: 'CAMLICA' },
  '849': { lineRef: 'T8', from: 'SSK', to: 'BATIKENT' },
  '851': { lineRef: '7', from: 'OGU', to: 'CANKAYA' },
  '852': { lineRef: '7', from: 'CANKAYA', to: 'OGU' },
  '853': { lineRef: '12', from: 'OGU', to: '75.YIL' },
  '857': { lineRef: 'T4', from: 'OGU', to: 'OTOGAR' },
  '859': { lineRef: 'T3', from: 'SSK', to: 'OGU' },
  '861': { lineRef: 'T1', from: 'SSK', to: 'OTOGAR' },
  '856': { lineRef: 'T10', from: 'SEHIR HASTANESI', to: 'KUMLUBEL' },
};

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

function normalizeRouteText(value) {
  return String(value || '')
    .toLocaleUpperCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0130/g, 'I')
    .replace(/\u015E/g, 'S')
    .replace(/\u011E/g, 'G')
    .replace(/\u00DC/g, 'U')
    .replace(/\u00D6/g, 'O')
    .replace(/\u00C7/g, 'C')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalTramEndpoint(value) {
  const normalized = normalizeRouteText(value);
  if (normalized === 'OGU' || normalized === 'OSMANGAZI' || normalized === 'OSMANGAZI UNIVERSITESI') {
    return 'OGU';
  }
  return normalized;
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

function departureSchedule(id, patternId, serviceId, sourceRouteId, departures) {
  if (departures.length === 0) return null;

  return {
    id,
    patternId,
    serviceId,
    sourceRouteId,
    departureMins: departures,
  };
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

function tramEndpoints(line) {
  if (line.from || line.to) {
    return {
      from: canonicalTramEndpoint(line.from),
      to: canonicalTramEndpoint(line.to),
    };
  }

  const parts = String(line.name || '')
    .split(/\s[-–]\s/)
    .map((part) => normalizeRouteText(part));

  return {
    from: canonicalTramEndpoint(parts[0] || ''),
    to: canonicalTramEndpoint(parts[parts.length - 1] || ''),
  };
}

function matchingTramScheduleRoute(line) {
  const endpoints = tramEndpoints(line);

  return Object.entries(TRAM_ROUTE_CONFIG).find(([, config]) => {
    if (config.lineRef !== line.ref) return false;
    return canonicalTramEndpoint(config.from) === endpoints.from && canonicalTramEndpoint(config.to) === endpoints.to;
  });
}

// Mirrors TramService fixed-interval rule: order stops by rail distance from the
// departure terminal, then apply FIXED_INTERVAL_MIN_PER_STOP per stop.
const FIXED_INTERVAL_MIN_PER_STOP = 2;
const ROUTE_ON_PATH_TOLERANCE_METERS = 450;

function stopMatchesTerminal(stopName, terminal) {
  const normalizedStop = normalizeRouteText(stopName);
  const normalizedTerminal = normalizeRouteText(terminal);

  if (normalizedTerminal === 'OGU') return normalizedStop.includes('OSMANGAZI');
  if (normalizedTerminal === 'ES-ES') return normalizedStop.includes('ES-ES');
  if (normalizedTerminal === 'SEHIR HASTANESI') return normalizedStop.includes('SEHIR HASTANESI');
  if (normalizedTerminal === '75.YIL') return normalizedStop.includes('75.YIL');
  if (normalizedTerminal === 'KUMLUBEL') {
    return normalizedStop.includes('KUMLUBEL') || normalizedStop.includes('TRAMVAY DURAGI');
  }

  return normalizedStop.includes(normalizedTerminal);
}

function buildRailGraph(lineRef) {
  const lines = tramData.lines.filter((line) => line.ref === lineRef);
  if (lines.length === 0) return null;

  const nodeIndexByKey = new Map();
  const nodes = [];
  const adjacency = [];

  const getNodeIndex = (coordinates) => {
    const key = `${coordinates.latitude.toFixed(5)},${coordinates.longitude.toFixed(5)}`;
    const existing = nodeIndexByKey.get(key);
    if (existing != null) return existing;

    const index = nodes.length;
    nodeIndexByKey.set(key, index);
    nodes.push(coordinates);
    adjacency.push([]);
    return index;
  };

  lines.forEach((line) => {
    line.paths.forEach((linePath) => {
      for (let index = 1; index < linePath.length; index += 1) {
        const from = getNodeIndex(linePath[index - 1]);
        const to = getNodeIndex(linePath[index]);
        if (from === to) continue;
        const meters = distanceMeters(linePath[index - 1], linePath[index]);
        adjacency[from].push({ to, meters });
        adjacency[to].push({ to: from, meters });
      }
    });
  });

  const lineStops = tramData.stops.filter((stop) => stop.lines.includes(lineRef));
  const stopNodeById = new Map();
  lineStops.forEach((stop) => {
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    nodes.forEach((node, index) => {
      const distance = distanceMeters(stop.coordinates, node);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    stopNodeById.set(stop.id, nearestIndex);
  });

  return { nodes, adjacency, lineStops, stopNodeById };
}

function dijkstra(graph, startNode) {
  const distances = Array(graph.nodes.length).fill(Infinity);
  const visited = new Set();
  distances[startNode] = 0;

  while (visited.size < graph.nodes.length) {
    let current = -1;
    let currentDistance = Infinity;
    for (let index = 0; index < distances.length; index += 1) {
      if (!visited.has(index) && distances[index] < currentDistance) {
        current = index;
        currentDistance = distances[index];
      }
    }
    if (current < 0) break;
    visited.add(current);

    graph.adjacency[current].forEach((edge) => {
      const nextDistance = currentDistance + edge.meters;
      if (nextDistance < distances[edge.to]) {
        distances[edge.to] = nextDistance;
      }
    });
  }

  return distances;
}

function resolveTerminalNode(graph, terminal, oppositeTerminal) {
  const terminalStop = graph.lineStops.find((stop) => stopMatchesTerminal(stop.name, terminal));
  if (terminalStop) return graph.stopNodeById.get(terminalStop.id) ?? null;

  const oppositeStop = graph.lineStops.find((stop) => stopMatchesTerminal(stop.name, oppositeTerminal));
  const oppositeNode = oppositeStop ? graph.stopNodeById.get(oppositeStop.id) : null;
  if (oppositeNode == null) return null;

  // Some OSM layers miss terminal stop nodes; use the farthest rail node instead.
  const distances = dijkstra(graph, oppositeNode);
  let farthestNode = null;
  let farthestDistance = -1;
  distances.forEach((distance, index) => {
    if (Number.isFinite(distance) && distance > farthestDistance) {
      farthestDistance = distance;
      farthestNode = index;
    }
  });
  return farthestNode;
}

function fixedIntervalStopOffsets(config, patternStops) {
  const graph = buildRailGraph(config.lineRef);
  if (!graph) return undefined;

  const startNode = resolveTerminalNode(graph, config.from, config.to);
  const endNode = resolveTerminalNode(graph, config.to, config.from);
  if (startNode == null || endNode == null || startNode === endNode) return undefined;

  const startDistances = dijkstra(graph, startNode);
  const endDistances = dijkstra(graph, endNode);
  const routeMeters = startDistances[endNode];
  if (!Number.isFinite(routeMeters)) return undefined;

  const orderedStops = graph.lineStops
    .map((stop) => {
      const node = graph.stopNodeById.get(stop.id);
      if (node == null) return null;
      const fromStart = startDistances[node];
      const toEnd = endDistances[node];
      if (!Number.isFinite(fromStart) || !Number.isFinite(toEnd)) return null;
      if (fromStart + toEnd > routeMeters + ROUTE_ON_PATH_TOLERANCE_METERS) return null;
      return { normalizedName: normalizeRouteText(stop.name), fromStart };
    })
    .filter(Boolean)
    .sort((a, b) => a.fromStart - b.fromStart);

  const offsetsByName = new Map();
  orderedStops.forEach((stop) => {
    if (!offsetsByName.has(stop.normalizedName)) {
      offsetsByName.set(stop.normalizedName, offsetsByName.size * FIXED_INTERVAL_MIN_PER_STOP);
    }
  });
  if (offsetsByName.size === 0) return undefined;

  const offsets = patternStops.map((stop) => offsetsByName.get(normalizeRouteText(stop.name)) ?? null);
  return offsets.some((value) => value !== null) ? offsets : undefined;
}

function tramStopOffsets(sourceRouteId, patternStops) {
  const measured = tramStopOffsetsData[sourceRouteId];
  if (!measured) return undefined;

  const offsetsByName = new Map(
    Object.entries(measured).map(([stopName, minutes]) => [normalizeRouteText(stopName), minutes])
  );

  const offsets = patternStops.map((stop) => {
    const normalized = normalizeRouteText(stop.name);
    if (offsetsByName.has(normalized)) return offsetsByName.get(normalized);
    for (const [name, minutes] of offsetsByName) {
      if (normalized.includes(name) || name.includes(normalized)) return minutes;
    }
    return null;
  });

  return offsets.some((value) => value !== null) ? offsets : undefined;
}

function buildGraph() {
  const stops = [];
  const routes = [];
  const patterns = [];
  const shapes = [];
  const frequencies = [];
  const departures = [];
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
    const matchingScheduleRoute = matchingTramScheduleRoute(line);
    const scheduleIds = [];
    let stopOffsetsMin;
    if (matchingScheduleRoute) {
      const [sourceRouteId, scheduleRouteConfig] = matchingScheduleRoute;
      stopOffsetsMin =
        tramStopOffsets(sourceRouteId, patternStops) ??
        fixedIntervalStopOffsets(scheduleRouteConfig, patternStops);
      [
        ['weekday', 'weekday'],
        ['saturday', 'weekday'],
        ['sunday', 'sunday'],
      ].forEach(([serviceId, sourceServiceId]) => {
        const scheduleId = `${patternId}:${serviceId}`;
        const schedule = departureSchedule(
          scheduleId,
          patternId,
          serviceId,
          sourceRouteId,
          collectDepartures(tramScheduleData.routes?.[sourceRouteId]?.[sourceServiceId])
        );
        if (schedule) {
          scheduleIds.push(scheduleId);
          departures.push(schedule);
        }
      });
    }

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
      stopOffsetsMin,
      shapeId,
      scheduleIds,
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
      departures,
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

  graph.schedules.departures.forEach((schedule) => {
    if (!patternIds.has(schedule.patternId)) {
      errors.push(`Departure schedule ${schedule.id} references missing pattern ${schedule.patternId}`);
    }
    if (!schedule.departureMins.length) {
      errors.push(`Departure schedule ${schedule.id} has no departures`);
    }
    const sorted = [...schedule.departureMins].sort((a, b) => a - b);
    if (sorted.some((minute, index) => minute !== schedule.departureMins[index] || minute < 0 || minute >= 1440)) {
      errors.push(`Departure schedule ${schedule.id} has invalid departure minutes`);
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
  `Transit graph built: ${graph.core.stops.length} stops, ${graph.core.routes.length} routes, ${graph.core.patterns.length} patterns, ${graph.core.transfers.length} transfers, ${graph.shapes.shapes.length} shapes, ${graph.schedules.frequencies.length} frequencies, ${graph.schedules.departures.length} departure schedules`
);
console.log(`Transit graph sizes: core=${sizes.core}B shapes=${sizes.shapes}B schedules=${sizes.schedules}B`);
