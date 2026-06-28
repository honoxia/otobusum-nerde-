#!/usr/bin/env node
/**
 * ESTRAM tramvay tarife tazelik kontrolü.
 *
 * ESTRAM kalkış saatlerini mevsimsel (yaz/kış) GÖRSEL olarak yayınlıyor.
 * Görsel dosya adlarında tarih/sürüm var (big-<id>-<tarih>.jpg). Bu script
 * canlı sayfadaki güncel görselleri çekip src/data/tram-schedule.json'daki
 * kayıtlı sürümlerle karşılaştırır. Fark varsa = tarife değişti = yeniden
 * OCR gerekiyor (ör. yazdan kışa geçiş).
 *
 * Kullanım:  node tools/check-tram-schedule.mjs
 * Çıkış kodu: 0 = değişiklik yok, 1 = tarife güncellenmiş (OCR gerek)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEDULE_PATH = path.join(__dirname, '..', 'src', 'data', 'tram-schedule.json');
const PAGE_URL = 'https://www.estram.com.tr/hareket-saatleri.php?cat_icerik=4';

async function main() {
  const stored = JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
  const storedById = Object.fromEntries(stored.sources.map((s) => [s.id, s]));

  const res = await fetch(PAGE_URL);
  const html = Buffer.from(await res.arrayBuffer()).toString('latin1');

  const live = {};
  for (const m of html.matchAll(/img_icerik\/\d{4}\/big-(\d+)-([0-9-]+)\.jpg/g)) {
    live[m[1]] = m[0];
  }

  const changes = [];
  for (const [id, img] of Object.entries(live)) {
    const prev = storedById[id];
    if (!prev) changes.push(`YENİ hat ${id}: ${img}`);
    else if (prev.image !== img) changes.push(`DEĞİŞTİ ${id} (${prev.name}): ${prev.image} -> ${img}`);
  }
  for (const s of stored.sources) {
    if (!live[s.id]) changes.push(`KAYBOLDU ${s.id} (${s.name})`);
  }

  if (changes.length === 0) {
    console.log(`✅ Tarife güncel (${stored.meta.season}, ${stored.meta.fetchedAt}). Değişiklik yok.`);
    process.exit(0);
  }
  console.log('⚠️ ESTRAM tarifesi DEĞİŞMİŞ — yeniden OCR gerekiyor:');
  changes.forEach((c) => console.log('  - ' + c));
  process.exit(1);
}

main().catch((e) => {
  console.error('Kontrol başarısız:', e.message);
  process.exit(2);
});
