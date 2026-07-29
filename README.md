<div align="center">
  <img src="assets/icon.png" width="112" alt="Eskişehir Ulaşım uygulama ikonu">
  <h1>Eskişehir Ulaşım</h1>
  <p>Otobüs, tramvay ve dolmuş yolculuklarını tek ekranda buluşturan bağımsız mobil ulaşım rehberi.</p>

  <p>
    <img src="https://img.shields.io/badge/Expo-54-000020?logo=expo&logoColor=white" alt="Expo SDK 54">
    <img src="https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react&logoColor=111111" alt="React Native 0.81">
    <img src="https://img.shields.io/badge/iOS-App_Store'a_gönderildi-147EFB?logo=apple&logoColor=white" alt="iOS App Store'a gönderildi">
    <img src="https://img.shields.io/badge/Android-APK_hazır-3DDC84?logo=android&logoColor=111111" alt="Android APK hazır">
  </p>
</div>

Eskişehir Ulaşım; yakındaki durakları bulur, hatların tahmini geliş süresini
hesaplar, güzergâhları haritada gösterir ve farklı ulaşım türlerini birleştiren
yolculuk seçenekleri üretir.

> [!IMPORTANT]
> Bu proje Eskişehir Büyükşehir Belediyesi'nin resmî uygulaması değildir.
> Gösterilen canlı konumlar ve tahmini süreler yalnızca bilgilendirme amaçlıdır.

<p align="center">
  <img src="assets/screenshots/app.jpg" width="360" alt="Eskişehir Ulaşım otobüs ekranı">
</p>

## Öne çıkanlar

| Özellik | Açıklama |
| --- | --- |
| Canlı otobüs takibi | Araçları ve seçilen hattın güzergâhını haritada gösterir |
| Yakındaki duraklar | Kullanıcının konumuna en yakın uygun durağı otomatik bulur |
| Tahmini varış | Canlı araç verisi veya tarife üzerinden kalan süreyi hesaplar |
| Tramvay rehberi | Tramvay hatlarını, duraklarını ve geçiş bilgilerini sunar |
| Dolmuş rehberi | Güzergâhları, yönleri ve günlere göre hareket saatlerini gösterir |
| Yolculuk planlama | Otobüs, tramvay ve dolmuş seçenekleriyle doğrudan veya aktarmalı rota üretir |
| Sesli bilgilendirme | ETA sonucunu Türkçe olarak seslendirebilir |

## Ulaşım türleri

### Otobüs

- Canlı araç konumları ve hat bazlı harita görünümü
- Kullanıcıya en yakın uygun durağın otomatik bulunması
- Gidiş ve dönüş yönü seçimi
- Canlı araç verisiyle rota bazlı kalan süre hesabı
- Canlı araç bulunmadığında Nimbus tarifeli varış bilgisi
- ETA sonucunu sesli okuma

### Tramvay

- Eskişehir tramvay ağı ve hat güzergâhları
- En yakın tramvay durağının bulunması
- Kullanılabildiğinde canlı Nimbus geçiş bilgileri
- Canlı veri olmadığında tarife ve durak sürelerine dayalı tahminler

### Dolmuş

- Kırmızı 23, Mavi 23, Yeşil 23, Siyah 5 ve Kırmızı 19 hatları
- Yönlere ayrılmış güzergâh seçimi
- Harita üzerinde gerçek rota geometrisi
- Hafta içi, cumartesi ve pazar hareket saatleri
- Kullanıcının rotaya en yakın konumu için yaklaşık geçiş süresi

### Yolculuk planlama

- Mevcut konumdan veya seçilen başlangıç noktasından rota oluşturma
- Durak arayarak ya da haritadan hedef seçme
- Otobüs, tramvay ve dolmuş seçeneklerini birlikte değerlendirme
- Doğrudan veya tek aktarmalı yolculuk alternatifleri
- Yürüme, bekleme ve araç içi süreleriyle yaklaşık toplam süre

## Platform durumu

| Platform | Durum |
| --- | --- |
| iOS | Production build App Store Connect'e gönderildi |
| Android | EAS üzerinden kurulabilir APK ve Play Store için AAB üretilebilir |
| Web | Expo geliştirme ortamında çalıştırılabilir |

Android paket ve iOS bundle kimliği `com.honoxia.otobusumnerde` olarak
tanımlıdır.

## Veri yaklaşımı

Uygulama tek bir kaynağa bağlı kalmak yerine canlı ve statik verileri birlikte
kullanır:

- Otobüs konumları MQTT üzerinden alınır.
- Nimbus, otobüs ve tramvay için canlı veya tarifeli varış kaynağı olarak kullanılır.
- OpenStreetMap verileri harita, tramvay ağı ve güzergâh geometrilerinde kullanılır.
- Yerel tarife ve rota verileri, canlı servislerin cevap vermediği durumlarda devamlılık sağlar.
- Dolmuş geçişleri, bilinen hareket saatleri ve rota üzerindeki zaman noktalarından yaklaşık olarak hesaplanır.

Canlı servislerin erişilemediği anlarda uygulama, uygun olduğu yerde tarifeli
tahmine veya liste görünümüne geçer. Gösterilen süreler trafik, veri gecikmesi ve
işletme koşullarına göre değişebilir.

### Mevcut veri kapsamı

| Veri | Adet |
| --- | ---: |
| Otobüs durağı | 2.748 |
| Otobüs rotası | 114 |
| Tramvay durağı | 135 |
| Tramvay hattı | 10 |
| Dolmuş güzergâh kaydı | 7 |
| Transit graph durağı | 2.919 |
| Transit pattern | 299 |
| Aktarma bağlantısı | 4.619 |

## Teknik yapı

| Teknoloji | Kullanım |
| --- | --- |
| Expo SDK 54 | Mobil geliştirme ve EAS Build altyapısı |
| React Native 0.81 | Android ve iOS arayüzü |
| TypeScript | Uygulama ve servis katmanlarında tip güvenliği |
| React Native WebView + Leaflet | Varsayılan OpenStreetMap görünümü |
| react-native-maps | İsteğe bağlı Google Maps sağlayıcısı |
| MQTT | Canlı otobüs konumları |
| Wialon / Nimbus | Canlı ve tarifeli durak verileri |
| expo-location | Kullanıcı konumu ve yakın durak hesabı |
| expo-speech | ETA sonucunun seslendirilmesi |

## Proje yapısı

```text
src/
├── components/       Arayüz bileşenleri, haritalar ve dolmuş ekranları
├── data/             Durak, rota, tarife ve transit graph verileri
├── hooks/            Konum, durak ve canlı araç hook'ları
├── screens/          Ana ekran, otobüs, tramvay ve rota planlayıcı
├── services/         ETA, MQTT, Nimbus, tramvay ve yolculuk servisleri
├── theme/            Renk, tipografi ve ölçü sistemi
├── types/            Ortak TypeScript tipleri
└── utils/            Coğrafi hesaplar ve veri yardımcıları
```

## Hızlı başlangıç

Gereksinimler:

- Node.js 18 veya üzeri
- npm
- Android için Android Studio / Android SDK
- iOS için macOS ve Xcode
- Dağıtım build'leri için EAS CLI

Projeyi çalıştırın:

```bash
npm install
npm run start
```

Platform komutları:

```bash
npm run android
npm run ios
npm run web
```

## Ortam değişkenleri

Proje kökünde bir `.env` dosyası oluşturulabilir:

```env
EXPO_PUBLIC_MAP_PROVIDER=osm
EXPO_PUBLIC_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=

FLESPI_CHANNEL_ID=
FLESPI_DEVICE_IDS=

NIMBUS_LOCATOR_HASH=
EXPO_PUBLIC_TRAM_NIMBUS_LOCATOR_HASH=
```

OpenStreetMap varsayılan sağlayıcıdır ve Google Maps anahtarı gerektirmez.
Google Maps kullanmak için `EXPO_PUBLIC_MAP_PROVIDER=google` ile birlikte
geçerli bir `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` tanımlanmalıdır.

## Doğrulama

```bash
npm run typecheck
npm run check:transit-graph
npm run benchmark:transit-routing
```

Transit verisini yeniden üretip tüm kontrolleri çalıştırmak için:

```bash
npm run validate:transit
```

## Build alma

### Android APK

EAS ile cihaza doğrudan kurulabilir dahili APK oluşturmak için:

```bash
npm run build:apk
```

Play Store'a gönderilecek production AAB için:

```bash
eas build --platform android --profile production
```

### iOS

Production iOS build'i oluşturmak için:

```bash
npm run build:ios
```

Son production build'ini App Store Connect'e göndermek için:

```bash
npm run submit:ios
```

`development`, `preview` ve `production` profilleri
[eas.json](eas.json) içinde tanımlıdır.

## Destek ve gizlilik

- [Destek](SUPPORT.md)
- [Gizlilik Politikası](PRIVACY.md)

## Veri ve doğruluk notu

Canlı servis kesintileri, trafik, veri gecikmeleri ve işletme değişiklikleri
gösterilen konum ve tahminleri etkileyebilir. Yolculuk öncesinde resmî duyuruların
da kontrol edilmesi önerilir.
