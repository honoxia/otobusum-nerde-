# Otobusum Nerde

Eskisehir ilindeki otobusleri gercek zamanli olarak takip edebileceginiz mobil uygulama.

## Ozellikler

- **Gercek Zamanli Otobus Takibi**: MQTT uzerinden canli otobus konumlarini haritada gorun
- **ETA Hesaplama**: Sectiginiz hat icin en yakin duraga tahmini varis suresi
- **Akilli Yon Tespiti**: Otobuslerin hangi yonde gittigini rota bazli analiz ile belirler
- **Durak Bazli Sorgulama**: En yakin duraklarinizi otomatik bulur
- **Tarifeli Varis Zamanlari**: Canli arac yoksa Nimbus API'den tarifeli varis zamanlarini gosterir
- **Harita Uzerinde Gosterim**: Otobusler (kirmizi daire + hat numarasi) ve duraklar (mavi pin) farkli gorunur

## Teknik Altyapi

| Teknoloji | Kullanim |
|-----------|----------|
| React Native + Expo | Mobil uygulama framework'u |
| TypeScript | Tip guvenligi |
| react-native-maps | Google Maps entegrasyonu |
| MQTT.js | Gercek zamanli otobus konumlari (Flespi) |
| Nimbus/Wialon API | Tarifeli varis zamanlari |

## Mimari

```
src/
├── components/          # UI bilesenleri
│   ├── Map/            # Harita, BusMarker, StopMarker
│   ├── ETACard/        # ETA gosterim karti
│   └── QueryInput/     # Hat sorgulama inputu
├── services/           # Is mantigi
│   ├── MqttService.ts  # MQTT baglantisi
│   ├── ETAService.ts   # ETA hesaplama algoritmasi
│   ├── NimbusService.ts # Nimbus API entegrasyonu
│   ├── stops/          # Durak verileri ve servisi
│   └── routes/         # Rota verileri ve servisi
├── hooks/              # React hooks
├── types/              # TypeScript tipleri
└── config/             # Yapilandirma
```

## Kurulum

### Gereksinimler

- Node.js 18+
- npm veya yarn
- Expo CLI
- Android Studio (APK build icin)
- Google Maps API Key

### Adimlar

1. **Bagimliliklari yukleyin:**

```bash
npm install
```

2. **Ortam degiskenlerini ayarlayin:**

```bash
cp .env.example .env
```

`.env` dosyasini duzenleyin:

```env
# Google Maps (Android build icin zorunlu)
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here

# Flespi MQTT token'i uygulama icine gomulmez.
# Canli public token Nimbus locator sayfasindan calisma aninda cekilir.

# Nimbus (opsiyonel - tarifeli zamanlar icin)
NIMBUS_LOCATOR_HASH=your_hash
```

3. **Uygulamayi baslatın (gelistirme):**

```bash
npx expo start
```

4. **APK olusturma:**

```bash
# EAS ile build
npx eas build --platform android --profile preview

# veya lokal build
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

## API Key Alma

### Google Maps API Key

1. [Google Cloud Console](https://console.cloud.google.com)'a gidin
2. Yeni proje olusturun
3. "Maps SDK for Android" API'sini etkinlestirin
4. Credentials > Create Credentials > API Key
5. (Onerilen) Key'i Android uygulamanizla kisitlayin

### Flespi Token

1. [Flespi](https://flespi.com)'de hesap olusturun
2. Token olusturun
3. MQTT channel ayarlayin

## ETA Hesaplama Algoritmasi

Uygulama su adimlari izler:

1. Kullanicinin GPS konumunu al
2. En yakin duraklari bul (1km icinde)
3. Sorgulanan hatin o duraklardan gecip gecmedigini kontrol et
4. O hattaki araclarin konumlarini MQTT'den al
5. Aracin rotasinin hedefe duragina ugrayip ugramayacagini kontrol et
6. Yaklasan araclari filtrele (heading + rota analizi)
7. ETA hesapla: `(mesafe x 1.25) / hiz + (durak sayisi x 25 sn)`
8. Arac yoksa Nimbus'tan tarifeli zamanları goster

## Ekran Goruntusu

![Uygulama ekran goruntusu](assets/screenshots/app.jpg)

## Lisans

MIT
