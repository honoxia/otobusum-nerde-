# 📋 YAPILACAKLAR

Proje: **Eskişehir Otobüs Takip Sistemi**
Platform: **React Native (Expo) - STANDALONE**
Son Güncelleme: 25 Ocak 2026
Tamamlanma Oranı: **%97**

---

## ✅ TAMAMLANAN AŞAMALAR

### Standalone Dönüşüm ✅
- [x] Backend tamamen kaldırıldı
- [x] Doğrudan MQTT bağlantısı (Flespi)
- [x] 370+ araç gerçek zamanlı takip
- [x] Yerel ETA hesaplama

### Durak & Hat Verileri ✅
- [x] Nimbus API'den 2748 durak çekildi
- [x] 313 rota, 120 hat varyantı (16M, 23S vb.)
- [x] Durak bazlı hat eşleştirme
- [x] stops-data.json güncellendi

### ETA Sistemi ✅
- [x] Durak bazlı ETA algoritması
- [x] Hat varyantları otomatik eşleşme (16→16M, 23→23S)
- [x] "Bu hat bu duraktan geçmiyor" kontrolü
- [x] Konum bazlı hat tahmini (araçlar için)

### UI Güzelleştirme ✅ (24 Ocak 2026)
- [x] Tema sistemi (Light/Dark mode)
- [x] ThemeProvider, useTheme hook
- [x] Renk paleti (OLED-optimized dark mode)
- [x] Common components (Card, Chip, Button, Skeleton)
- [x] StopCard - Durak kartı + hat chip'leri
- [x] ETACard - Renkli, büyük ETA gösterimi
- [x] Bottom Sheet (Modal-based - Expo Go uyumlu)
- [x] Custom map markers (hat numaralı BusMarker)
- [x] UserMarker pulse animasyonu
- [x] Toast bildirimleri
- [x] Loading skeleton states

### Hat Yön Bilgisi ✅ (25 Ocak 2026)
- [x] routes-data.json oluşturuldu (119 hat, 311 rota)
- [x] RouteService - yön belirleme algoritması
- [x] ETA sonucunda yön gösterimi: "23S (Batıkent yönü) - 2 dk"
- [x] ETACard'da yön bilgisi entegrasyonu

---

## 🔴 YAPILACAKLAR (Öncelik Sırasına Göre)

### 1. Sesli Komut 🟡 (Orta Öncelik)

**Mevcut Durum:** TTS (Text-to-Speech) çalışıyor, STT (Speech-to-Text) aktif değil

**Gereksinimler:**
- @react-native-voice/voice paketi
- Development build (Expo Go'da çalışmaz)

**Yapılacaklar:**
- [ ] Development build oluştur (`eas build --profile development`)
- [ ] Voice recognition entegrasyonu
- [ ] Türkçe dil desteği (`tr-TR`)
- [ ] "Dinleniyor..." UI göstergesi
- [ ] Hata durumları (mikrofon izni, ağ hatası)

**Örnek Akış:**
```
Kullanıcı: [🎤 basılı tutar]
Uygulama: "Dinliyorum..."
Kullanıcı: "Yirmi üç ne zaman gelecek?"
Uygulama: "23S, 2 dakika sonra, Batıkent yönü"
```

---

### 2. APK Oluşturma 🟢 (Son Aşama)

**Yöntem:** EAS Build (Expo Application Services)

**Adımlar:**
```bash
# 1. EAS CLI kur
npm install -g eas-cli

# 2. Expo hesabına giriş
eas login

# 3. Proje yapılandır
eas build:configure

# 4. APK oluştur (preview profili)
eas build --platform android --profile preview

# 5. veya Play Store için AAB
eas build --platform android --profile production
```

**Yapılacaklar:**
- [ ] EAS hesabı oluştur
- [ ] app.json yapılandır (versiyon, paket adı)
- [ ] İkon ve splash screen tasarla
- [ ] Preview APK oluştur (test için)
- [ ] Production AAB oluştur (Play Store için)

**eas.json Örneği:**
```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

---

## 🔧 İYİLEŞTİRMELER (Opsiyonel)

### Performans
- [ ] Map clustering (çok marker olunca)
- [ ] Debounce araç güncellemeleri

### Kullanıcı Deneyimi
- [ ] Favori duraklar (AsyncStorage)
- [ ] Bildirimler (otobüs yaklaştığında)
- [ ] Hat rotası gösterimi (Polyline)
- [ ] Offline mod (son bilinen veriler)
- [ ] Kullanıcıya yön seçtirme (opsiyonel)

### Veri Güncelleme
- [ ] stops-data.json otomatik güncelleme
- [ ] Versiyon kontrolü

---

## 📊 ÖNCELİK TABLOSU

| # | Görev | Öncelik | Durum | Tahmini Süre |
|---|-------|---------|-------|--------------|
| 1 | ~~UI Güzelleştirme~~ | ~~🔴 Yüksek~~ | ✅ Tamamlandı | ~~2-3 gün~~ |
| 2 | ~~Hat Yön Bilgisi~~ | ~~🔴 Yüksek~~ | ✅ Tamamlandı | ~~1 gün~~ |
| 3 | Sesli Komut | 🟡 Orta | Bekliyor | 1 gün |
| 4 | APK Oluşturma | 🟢 Son | Bekliyor | 1 saat |

---

## 🎯 SONRAKI ADIM

**Önerilen Sıralama:**

```
1. Sesli Komut ← SIRADA
   └── Development build
   └── Voice entegrasyonu
   └── Test et

2. APK
   └── EAS yapılandır
   └── Build al
   └── Dağıt
```

---

## 📈 İSTATİSTİKLER

| Metrik | Değer |
|--------|-------|
| Duraklar | 2748 |
| Rotalar | 311 |
| Hat Sayısı | 119 |
| Hat Varyantları | 120 |
| Aktif Araçlar | 370+ |
| Tamamlanma | %97 |

---

## 🆕 SON EKLENENLER (25 Ocak 2026)

### Hat Yön Sistemi
```
src/data/
└── routes-data.json     # 119 hat, 311 rota yön bilgisi

src/services/routes/
└── RouteService.ts      # Yön belirleme algoritması
    ├── getDirectionsForLine()     # Hattın tüm yönleri
    ├── determineDirection()       # Aracın yönünü belirle
    ├── getDirectionsAtStop()      # Duraktaki yönler
    └── formatDirection()          # "BATIKENT - ODP" → "Batıkent yönü"
```

### ETAResult Güncellemesi
```typescript
interface ETAResult {
  // ... mevcut alanlar
  direction?: string;     // "Batıkent yönü"
  directionFull?: string; // "BATIKENT - ODUNPAZARI"
}
```

### ETACard Yön Gösterimi
- Hat numarasının altında yön chip'i
- Örnek: "23S" altında "Batıkent yönü"

---

**Son Güncelleme:** 25 Ocak 2026
**Mimari:** Standalone (Backend Yok)
**Sonraki Hedef:** Sesli Komut (STT)
