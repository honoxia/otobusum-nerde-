const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'src', 'data', 'transit');
const MAX_BYTES = {
  'graph-core.json': 1_250_000,
  'shapes.json': 800_000,
  'schedules.json': 100_000,
};
const MAX_TRANSFERS_PER_STOP = 6;
const MAX_TRANSFER_DISTANCE_M = 250;

function readJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf8'));
}

function fileSize(filename) {
  return fs.statSync(path.join(DATA_DIR, filename)).size;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function duplicates(values) {
  const seen = new Set();
  const duplicated = new Set();
  values.forEach((value) => {
    if (seen.has(value)) duplicated.add(value);
    seen.add(value);
  });
  return [...duplicated];
}

function assertNoDuplicates(label, values) {
  const duplicated = duplicates(values);
  assert(duplicated.length === 0, `${label} has duplicate ids: ${duplicated.slice(0, 5).join(', ')}`);
}

function main() {
  const core = readJson('graph-core.json');
  const shapes = readJson('shapes.json');
  const schedules = readJson('schedules.json');

  Object.entries(MAX_BYTES).forEach(([filename, maxBytes]) => {
    const size = fileSize(filename);
    assert(size <= maxBytes, `${filename} is ${size} bytes, over ${maxBytes} byte budget`);
  });

  assert(core.metadata.version === '1.1-phase-a', 'Unexpected graph-core version');
  assert(core.stops.length > 2500, `Expected >2500 stops, got ${core.stops.length}`);
  assert(core.routes.length > 100, `Expected >100 routes, got ${core.routes.length}`);
  assert(core.patterns.length > 250, `Expected >250 patterns, got ${core.patterns.length}`);
  assert(core.transfers.length > 1000, `Expected transfer graph, got ${core.transfers.length} transfers`);
  assert(shapes.shapes.length > 0, 'Expected shapes to be split into shapes.json');
  assert(schedules.frequencies.length > 0, 'Expected dolmus frequencies in schedules.json');
  assert(schedules.departures.length > 0, 'Expected tram departure schedules in schedules.json');

  assertNoDuplicates('Stops', core.stops.map((stop) => stop.id));
  assertNoDuplicates('Routes', core.routes.map((route) => route.id));
  assertNoDuplicates('Patterns', core.patterns.map((pattern) => pattern.id));
  assertNoDuplicates('Shapes', shapes.shapes.map((shape) => shape.id));
  assertNoDuplicates('Frequencies', schedules.frequencies.map((frequency) => frequency.id));
  assertNoDuplicates('Departure schedules', schedules.departures.map((schedule) => schedule.id));

  const stopIds = new Set(core.stops.map((stop) => stop.id));
  const routeIds = new Set(core.routes.map((route) => route.id));
  const patternIds = new Set(core.patterns.map((pattern) => pattern.id));
  const shapeIds = new Set(shapes.shapes.map((shape) => shape.id));

  core.patterns.forEach((pattern) => {
    assert(routeIds.has(pattern.routeId), `Pattern ${pattern.id} references missing route ${pattern.routeId}`);
    assert(pattern.stopIds.length >= 2, `Pattern ${pattern.id} has fewer than 2 stops`);
    assert(
      pattern.stopIds.every((stopId) => stopIds.has(stopId)),
      `Pattern ${pattern.id} references missing stop`
    );
    if (pattern.segmentMeters) {
      assert(
        pattern.segmentMeters.length === pattern.stopIds.length - 1,
        `Pattern ${pattern.id} segment count does not match stop count`
      );
    }
    if (pattern.shapeId) {
      assert(shapeIds.has(pattern.shapeId), `Pattern ${pattern.id} references missing shape ${pattern.shapeId}`);
    }
    if (pattern.mode === 'bus') {
      assert(pattern.sourceRouteIds.length > 0, `Bus pattern ${pattern.id} must keep sourceRouteIds metadata`);
      assert(
        !pattern.sourceRouteIds.some((sourceRouteId) => pattern.id.includes(String(sourceRouteId))),
        `Bus pattern ${pattern.id} leaks unstable source route id into stable id`
      );
    }
  });

  const transfersByStop = new Map();
  core.transfers.forEach((transfer) => {
    assert(stopIds.has(transfer.fromStopId), `Transfer references missing fromStop ${transfer.fromStopId}`);
    assert(stopIds.has(transfer.toStopId), `Transfer references missing toStop ${transfer.toStopId}`);
    assert(transfer.distanceMeters <= MAX_TRANSFER_DISTANCE_M, `Transfer exceeds ${MAX_TRANSFER_DISTANCE_M}m`);
    assert(transfer.walkMin > 0, 'Transfer walkMin must be positive');
    transfersByStop.set(transfer.fromStopId, (transfersByStop.get(transfer.fromStopId) || 0) + 1);
  });

  const maxTransfersForStop = Math.max(...transfersByStop.values());
  assert(
    maxTransfersForStop <= MAX_TRANSFERS_PER_STOP,
    `A stop has ${maxTransfersForStop} transfers, over ${MAX_TRANSFERS_PER_STOP}`
  );

  shapes.shapes.forEach((shape) => {
    assert(patternIds.has(shape.patternId), `Shape ${shape.id} references missing pattern ${shape.patternId}`);
    assert(shape.coordinates.length >= 2, `Shape ${shape.id} has fewer than 2 coordinates`);
  });

  schedules.frequencies.forEach((frequency) => {
    assert(patternIds.has(frequency.patternId), `Frequency ${frequency.id} references missing pattern`);
    assert(frequency.endMin > frequency.startMin, `Frequency ${frequency.id} has invalid time window`);
    assert(frequency.headwayMin > 0, `Frequency ${frequency.id} has invalid headway`);
  });

  schedules.departures.forEach((schedule) => {
    assert(patternIds.has(schedule.patternId), `Departure schedule ${schedule.id} references missing pattern`);
    assert(schedule.departureMins.length > 0, `Departure schedule ${schedule.id} has no departures`);
    schedule.departureMins.forEach((minute, index) => {
      assert(minute >= 0 && minute < 1440, `Departure schedule ${schedule.id} has minute outside day`);
      if (index > 0) {
        assert(minute >= schedule.departureMins[index - 1], `Departure schedule ${schedule.id} is not sorted`);
      }
    });
  });

  const dolmusPatterns = core.patterns.filter((pattern) => pattern.mode === 'dolmus');
  assert(dolmusPatterns.every((pattern) => pattern.scheduleIds?.length), 'Every dolmus pattern must reference schedules');
  const tramPatterns = core.patterns.filter((pattern) => pattern.mode === 'tram');
  assert(tramPatterns.some((pattern) => pattern.scheduleIds?.length), 'Expected tram patterns to reference schedules');

  const samplePattern = core.patterns.find((pattern) => pattern.stopIds.length >= 4);
  assert(samplePattern, 'Expected at least one pattern with 4+ stops for route smoke check');
  assert(samplePattern.segmentMeters?.slice(0, 3).every((meters) => meters > 0), 'Sample pattern has invalid segments');

  console.log(
    `Transit graph check passed: ${core.stops.length} stops, ${core.routes.length} routes, ${core.patterns.length} patterns, ${core.transfers.length} transfers`
  );
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
