# Otobusum Nerde

Eskisehir icin otobus, tramvay, dolmus ve guzergah planlama odakli mobil ulasim rehberi.

Uygulama Expo/React Native ile gelistirilir. Varsayilan harita modu OpenStreetMap + WebView/Leaflet'tir; Google Maps provider opsiyonel olarak acilabilir. Android paket adi `com.honoxia.otobusumnerde`, uygulama surumu `1.0.1` olarak yapilandirilmistir.

## Guncel kapsam

- **Ana menu**: Otobus, tramvay, dolmus ve guzergah planlama ekranlari.
- **Otobus**: MQTT/Flespi uzerinden canli arac konumlari, en yakin durak, hat sorgusu, yon secimi, ETA hesabi ve Nimbus tarifeli varis yedegi.
- **Tramvay**: OSM tabanli tramvay agi, en yakin tramvay duragi, canli Nimbus durak verisi varsa canli gecisler, yoksa yaz tarifesi ve durak offset'lerine dayali beklenen saatler.
- **Dolmus**: Hat listesi, gidis/donus yonleri, harita uzerinde guzergah, hafta ici/cumartesi/pazar hareket saatleri ve kullaniciya en yakin rota bacagina gore siradaki gecis.
- **Guzergah planlama**: Mevcut konumdan durak arama veya haritadan hedef secme; otobus, tramvay ve dolmus agi uzerinde direkt veya tek aktarmali alternatifler.
- **Harita yedegi**: OSM/WebView yuklenemezse durak ve arac bilgilerini liste modunda gosteren fallback ekran.

## Veri ozeti

| Veri | Adet |
| --- | ---: |
| Otobus duragi | 2748 |
| Otobus rotasi | 114 |
| Tramvay duragi | 135 |
| Tramvay hatti | 10 |
| Dolmus hatti | 6 |
| Transit graph duragi | 2919 |
| Transit graph pattern'i | 299 |
| Transfer baglantisi | 4619 |
| Frekans tarifesi | 16 |
| Kalkis tarifesi | 30 |

## Teknik altyapi

| Teknoloji | Kullanim |
| --- | --- |
| Expo SDK 54 | Mobil uygulama ve EAS build altyapisi |
| React Native 0.81 | Native ekranlar ve bilesenler |
| TypeScript | Tip guvenligi |
| React Native WebView | OSM/Leaflet haritasi ve rota cizimleri |
| react-native-maps | Opsiyonel Google Maps provider |
| precompiled-mqtt | Canli otobus konumlari |
| Wialon/Nimbus | Tarifeli ve canli durak verisi |
| expo-location | Kullanici konumu ve yakin durak hesaplari |
| expo-speech | Otobus ETA sonucunu seslendirme |

## Proje yapisi

```text
src/
|-- components/
|   |-- BottomSheet/        # Durak detay sheet'i
|   |-- Dolmus/             # Dolmus liste ve harita ekranlari
|   |-- Map/                # OSM, Google Maps, marker ve harita HTML'i
|   |-- StopCard/           # En yakin durak karti
|   |-- ETACard/            # Otobus ETA sonuc karti
|   `-- common/             # Ortak UI bilesenleri
|-- data/
|   |-- transit/            # Transit graph, shapes ve tarifeler
|   |-- stops-data.json     # Otobus duraklari
|   |-- routes-data.json    # Otobus rotalari
|   |-- tram-data.json      # Tramvay agi
|   |-- tram-schedule.json  # Tramvay tarife verisi
|   `-- dolmus-data.json    # Dolmus guzergah ve saatleri
|-- hooks/                  # Konum, durak ve canli arac hook'lari
|-- screens/                # Home, Bus, Tram, Route Planner ekranlari
|-- services/
|   |-- dolmus/             # Dolmus gecis ve rota hesaplari
|   |-- mqtt/               # MQTT baglantisi
|   |-- routes/             # Otobus rota servisi
|   |-- routing/            # JourneyPlanner
|   |-- stops/              # Durak servisi
|   |-- tram/               # Tramvay ve Nimbus servisleri
|   |-- ETAService.ts       # Otobus ETA algoritmasi
|   `-- NimbusService.ts    # Otobus tarifeli veri entegrasyonu
|-- theme/                  # Renk, spacing ve typography sistemi
|-- types/                  # Ortak TypeScript tipleri
`-- utils/                  # Geo, query parser ve graph yardimcilari
```

## Kurulum

### Gereksinimler

- Node.js 18+
- npm
- Expo CLI veya `npx expo`
- Android Studio / Android SDK (native Android calistirma veya APK icin)
- EAS CLI (EAS build icin)

### Bagimliliklar

```bash
npm install
```

### Ortam degiskenleri

`.env` dosyasi olusturup ihtiyac duyulan degerleri girin:

```env
# Harita
EXPO_PUBLIC_MAP_PROVIDER=osm
EXPO_PUBLIC_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=

# Otobus canli veri / filtreleme
FLESPI_CHANNEL_ID=
FLESPI_DEVICE_IDS=

# Nimbus locator override'lari
NIMBUS_LOCATOR_HASH=
EXPO_PUBLIC_TRAM_NIMBUS_LOCATOR_HASH=
```

Notlar:

- `EXPO_PUBLIC_MAP_PROVIDER=osm` varsayilan ve ucretsiz moddur.
- Google Maps kullanmak icin `EXPO_PUBLIC_MAP_PROVIDER=google` ve `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` gerekir.
- Flespi token uygulama icine gomulmez; servis canli public token'i calisma aninda locator sayfasindan alacak sekilde tasarlanmistir.
- Nimbus locator hash degerleri config icinde varsayilanlara sahiptir; ortam degiskenleri override icindir.

## Calistirma

```bash
npm run start
npm run android
npm run ios
npm run web
```

## Dogrulama ve veri uretimi

```bash
npm run typecheck
npm run build:transit-graph
npm run check:transit-graph
npm run benchmark:transit-routing
npm run validate:transit
```

Script ozeti:

- `build:transit-graph`: Otobus, tramvay ve dolmus verilerinden transit graph ciktisi uretir.
- `check:transit-graph`: Graph, shape, tarife ve transfer tutarliligini denetler.
- `benchmark:transit-routing`: Rota planlama performansi icin smoke/benchmark calistirir.
- `validate:transit`: Graph build, graph check, routing benchmark ve TypeScript kontrolunu tek komutta calistirir.

## Android build

```bash
npm run build:apk
```

EAS profilleri:

- `development`: Development client, internal distribution.
- `preview`: Internal APK.
- `production`: Android App Bundle ve auto increment.

## Ekran goruntusu

![Uygulama ekran goruntusu](assets/screenshots/app.jpg)

## Notlar

- Tramvay tarafinda kapali/native-imzali ASIS API'leri kullanilmaz. Mevcut model public ESTRAM/Nimbus verisi, OSM geometrisi ve olculmus/doldurulmus durak offset'leri ile calisir.
- Canli veri olmadiginda uygulama tarifeli tahminleri saklamaya ve kullaniciya kaynak durumunu gostermeye odaklanir.
