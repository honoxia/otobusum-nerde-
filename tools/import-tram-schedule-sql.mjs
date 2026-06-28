#!/usr/bin/env node

/**
 * Import ChatGPT/OCR-produced JSON or SQL-like tram departure rows into
 * src/data/tram-schedule.json.
 *
 * Usage:
 *   node tools/import-tram-schedule-sql.mjs <sql-text-file> [source-id]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schedulePath = path.join(__dirname, '..', 'src', 'data', 'tram-schedule.json');

const [, , inputPath, explicitSourceId] = process.argv;

if (!inputPath) {
  console.error('Usage: node tools/import-tram-schedule-sql.mjs <sql-text-file> [source-id]');
  process.exit(1);
}

const normalize = (value) => {
  const fixed = value
    .replace(/Ä°/g, 'I')
    .replace(/Ý/g, 'I')
    .replace(/Þ/g, 'S')
    .replace(/þ/g, 'S')
    .replace(/Ã/g, 'I')
    .replace(/Ã/g, 'S')
    .replace(/Ãœ/g, 'U')
    .replace(/Ã–/g, 'O')
    .replace(/Ã‡/g, 'C')
    .replace(/Åž/g, 'S')
    .replace(/Å/g, 'S')
    .replace(/Äž/g, 'G')
    .replace(/Ä/g, 'G')
    .replace(/Ä±/g, 'I');

  return fixed
    .toLocaleUpperCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/\s+/g, ' ')
    .trim();
};

const text = fs.readFileSync(inputPath, 'utf8').trim();
const schedule = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));

const sortHourKeys = (daySchedule) => {
  const sorted = {};
  for (const hour of Object.keys(daySchedule).sort()) {
    sorted[hour] = [...new Set(daySchedule[hour])].sort((a, b) => a - b);
  }
  return sorted;
};

const countDepartures = (daySchedule) =>
  Object.values(daySchedule).reduce((total, minutes) => total + minutes.length, 0);

const importRoute = (source, route) => {
  schedule.routes[source.id] = {
    name: source.name,
    weekday: sortHourKeys(route.weekday ?? {}),
    sunday: sortHourKeys(route.sunday ?? {}),
  };

  fs.writeFileSync(schedulePath, `${JSON.stringify(schedule, null, 2)}\n`);

  console.log(
    `Imported ${source.id} ${source.name}: weekday=${countDepartures(
      schedule.routes[source.id].weekday,
    )}, sunday=${countDepartures(schedule.routes[source.id].sunday)}`,
  );
};

if (text.startsWith('{')) {
  const route = JSON.parse(text);
  const sourceByName = schedule.sources.find((item) => normalize(item.name) === normalize(route.name ?? ''));
  const sourceById = schedule.sources.find((item) => item.id === (explicitSourceId ?? route.id));
  const source = sourceByName ?? sourceById;

  if (!source) {
    console.error(`Could not match JSON route "${route.name ?? route.id}" to a tram-schedule source.`);
    process.exit(1);
  }

  if (sourceByName && sourceById && sourceByName.id !== sourceById.id) {
    console.warn(
      `Route id/name mismatch: JSON id ${sourceById.id} is "${sourceById.name}", but name matches ${sourceByName.id} "${sourceByName.name}". Using ${sourceByName.id}.`,
    );
  }

  importRoute(source, route);
  process.exit(0);
}

const rowPattern =
  /\('([^']+)'\s*,\s*'([^']+)'\s*,\s*'(\d{2}):(\d{2}):\d{2}'(?:\s*,\s*(\d+))?\)/g;

const rows = [];
let match;

while ((match = rowPattern.exec(text))) {
  rows.push({
    direction: match[1],
    serviceDay: match[2],
    hour: match[3],
    minute: Number(match[4]),
    dayOffset: Number(match[5] ?? 0),
  });
}

if (rows.length === 0) {
  console.error('No departure rows found in input.');
  process.exit(1);
}

const directionNames = [...new Set(rows.map((row) => row.direction))];

if (directionNames.length !== 1) {
  console.error(`Expected one direction, found: ${directionNames.join(', ')}`);
  process.exit(1);
}

const direction = directionNames[0];
const source =
  explicitSourceId != null
    ? schedule.sources.find((item) => item.id === explicitSourceId)
    : schedule.sources.find((item) => normalize(item.name) === normalize(direction));

if (!source) {
  console.error(`Could not match direction "${direction}" to a tram-schedule source.`);
  process.exit(1);
}

const toDayKey = (serviceDay) => {
  const normalized = normalize(serviceDay);
  if (normalized === 'PZT_CMT' || normalized === 'PAZARTESI_CUMARTESI') return 'weekday';
  if (normalized === 'PAZAR') return 'sunday';
  throw new Error(`Unknown service day: ${serviceDay}`);
};

const route = {
  name: source.name,
  weekday: {},
  sunday: {},
};

for (const row of rows) {
  const dayKey = toDayKey(row.serviceDay);
  const bucket = route[dayKey][row.hour] ?? [];
  bucket.push(row.minute);
  route[dayKey][row.hour] = bucket;
}

route.weekday = sortHourKeys(route.weekday);
route.sunday = sortHourKeys(route.sunday);
importRoute(source, route);
