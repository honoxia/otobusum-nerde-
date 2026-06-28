# Tramvay tarifeli ETA modeli — yapılacaklar (codex devir notu)

Amaç: Tramvaylar için **tarifeli** "X hattı, Y durağı, ~kaçta geçer" tahmini.
Canlı GPS YOK (ASİS API'si auth/native-imza ile kapalı, koruma aşmıyoruz — yasal sınır).
Onun yerine: **ESTRAM kalkış saatleri (public)** + **ray geometrisinden segment süreleri**.

## Eldeki hazır parçalar
- `src/data/tram-data.json` — 10 hat (paths geometrisi), 135 durak (koordinat + lines[]). OSM kaynaklı.
- `src/data/tram-schedule.json` — `meta` (sezon=yaz, tarih) + `sources` (23 ESTRAM route görselinin id/ad/dosya/tarih). **`routes` alanı BOŞ — doldurulacak.**
- `tools/check-tram-schedule.mjs` — tarife değişti mi kontrolü (kışa geçiş). `node tools/check-tram-schedule.mjs`.

## Yapılacaklar

### 1. 23 timetable görselini OCR'la → `tram-schedule.json` `routes`
- Görsel URL'leri: `https://www.estram.com.tr/img_icerik/2026/<image>` (her route'un `image` alanı `sources`'ta).
- Her görsel: SOL = "PAZARTESİ-CUMARTESİ", SAĞ = "PAZAR". Satır = saat (`05:`), yanında o saatteki kalkış dakikaları.
- Hedef format:
  ```json
  "routes": {
    "862": { "name": "OTOGAR - SSK",
      "weekday": { "05": [35,38,45,57], "06": [8,19,30,41,52], ... },
      "sunday":  { "05": [35,38,45,57], ... } }
  }
  ```
- Örnek doğrulandı: 862 (OTOGAR-SSK) `05:` → 35,38,45,57 / `06:` → 08,19,30,41,52. (`D:/mobile2/tram_862_otogar_ssk.jpg` indirilmiş.)

### 2. ESTRAM route'larını (OTOGAR-SSK…) bizim hatlara/sıralı duraklara eşle
- Terminaller ortak durak: OTOGAR, SSK, OGÜ, ŞEHİR HASTANESİ, KUMLUBEL, 75.YIL, ÇANKAYA, BATIKENT, ÇAMLICA, ES-ES, Opera.
- Sıralı durak listesi: 6 hat OSM'den temiz; T1/T3/T8/T9 (SSK hatları) OSM'de durak üyesi yok → ray geometrisinden sıralanmalı (bkz. scratchpad `tram_order.js` yaklaşımı: paths'i greedy chain'le, durakları en yakın vertex index'ine göre sırala).

### 3. Kümülatif segment offset (terminal → her durak)
- Her hat için ardışık duraklar arası **ray mesafesi** (haversine, tram-data paths'ten) topla.
- `offset(durak) = kümülatif_mesafe ÷ ORTALAMA_HIZ + durakBaşınaBekleme`.
- `ORTALAMA_HIZ` tek sabit (config). Başlangıç ~18-22 km/h, kullanıcı 1 hat çekip ölçünce kalibre edilecek.

### 4. Tahmin + UI
- `passTime(durak) = kalkışSaati + offset(terminal→durak)` — gün tipine göre (hafta içi/Pazar).
- Tramvay durağına basınca "sıradaki geçişler: HH:MM, HH:MM…" göster.
- `meta.season` ile "**Yaz tarifesi**" notu göster (stale şeffaflığı).

### 5. Kalibrasyon (kullanıcı verisi gelince)
- Kullanıcı 1 hattı filme alıp (durak→saat) verecek. Gerçek segment süreleriyle `ORTALAMA_HIZ`'ı ayarla.

## Sınır (önemli)
- ASİS Omni API'sine DOKUNMA (omniapi.asiselektronik.com.tr) — auth/native X-AuthKey ile kapalı, koruma aşmak yasal değil.
- Sadece public ESTRAM görselleri + OSM geometrisi + kullanıcının kendi gözlemi kullanılır.
