/**
 * Nimbus API'den route verilerini çekip routes-data.json oluşturur
 * Her route için hat numarası ve yön bilgisi eşleştirir
 */

const fs = require('fs');
const https = require('https');

const LOCATOR_HASH = '4d5af2578d1f42adabc3165aa4456953';
const API_URL = `https://nimbus.wialon.com/api/locator/${LOCATOR_HASH}/data`;

function fetchData() {
  return new Promise((resolve, reject) => {
    https.get(API_URL, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Fetching data from Nimbus API...');
  const apiData = await fetchData();

  console.log('Routes:', apiData.routes.length);
  console.log('Stops:', apiData.stops.length);

  // stops-data.json'u oku
  const stopsDataPath = 'D:/mobile2/otobusumnerde/src/data/stops-data.json';
  const stopsData = JSON.parse(fs.readFileSync(stopsDataPath, 'utf8'));

  // wialonId -> lines map oluştur
  const stopLinesMap = new Map();
  stopsData.forEach(stop => {
    stopLinesMap.set(stop.wialonId, stop.lines);
  });

  console.log('Stop lines map size:', stopLinesMap.size);

  // Her route için hat eşleştirmesi yap
  const routesWithLines = [];

  apiData.routes.forEach(route => {
    if (!route.s || route.s.length === 0) return;

    // Route'un geçtiği durakların hatlarını topla
    const lineFrequency = {};
    let matchedStops = 0;

    route.s.forEach(stopId => {
      const lines = stopLinesMap.get(stopId);
      if (lines && lines.length > 0) {
        matchedStops++;
        lines.forEach(line => {
          lineFrequency[line] = (lineFrequency[line] || 0) + 1;
        });
      }
    });

    if (Object.keys(lineFrequency).length === 0) return;

    // En sık geçen hattı bul (en az %50 coverage olmalı)
    const sorted = Object.entries(lineFrequency).sort((a, b) => b[1] - a[1]);
    const [topLine, topCount] = sorted[0];
    const coverage = topCount / route.s.length;

    // Coverage %50'nin üzerindeyse kabul et
    if (coverage >= 0.5) {
      routesWithLines.push({
        routeId: route.id,
        line: topLine,
        direction: route.d,
        stopIds: route.s,
        stopCount: route.s.length,
        coverage: Math.round(coverage * 100)
      });
    }
  });

  console.log('\nMatched routes:', routesWithLines.length);

  // Hat bazlı grupla
  const lineRoutesMap = {};

  routesWithLines.forEach(route => {
    if (!lineRoutesMap[route.line]) {
      lineRoutesMap[route.line] = [];
    }
    lineRoutesMap[route.line].push({
      routeId: route.routeId,
      direction: route.direction,
      stopIds: route.stopIds,
      stopCount: route.stopCount
    });
  });

  // routes-data.json formatını oluştur
  const routesData = Object.entries(lineRoutesMap).map(([line, routes]) => ({
    line,
    routes: routes.map(r => ({
      routeId: r.routeId,
      direction: r.direction,
      stopIds: r.stopIds
    }))
  })).sort((a, b) => {
    // Sayısal sıralama (16S vs 4M gibi)
    const numA = parseInt(a.line.match(/\d+/)?.[0] || '999');
    const numB = parseInt(b.line.match(/\d+/)?.[0] || '999');
    if (numA !== numB) return numA - numB;
    return a.line.localeCompare(b.line);
  });

  // Kaydet
  const outputPath = 'D:/mobile2/otobusumnerde/src/data/routes-data.json';
  fs.writeFileSync(outputPath, JSON.stringify(routesData, null, 2), 'utf8');

  console.log('\n✅ routes-data.json oluşturuldu:', outputPath);
  console.log('Toplam hat:', routesData.length);

  // Örnek çıktı
  console.log('\nÖrnek veriler:');
  routesData.slice(0, 10).forEach(item => {
    console.log(`${item.line}: ${item.routes.length} yön`);
    item.routes.forEach(r => {
      console.log(`  - ${r.direction}`);
    });
  });
}

main().catch(console.error);
