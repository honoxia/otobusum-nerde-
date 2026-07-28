# Mac + honoxia diski — Xcode ile App Store

## 0) Önkoşullar (Mac)
- Xcode (App Store) kurulu, bir kez açılıp lisans kabul edilmiş
- `xcode-select -p` çalışıyor
- Apple Developer hesabı **Active** (Hello Developer görüyorsan OK)
- Harici disk bağlı (`/Volumes/honoxia` veya `/Volumes/Honoxia`)

## 1) App Store Connect’te uygulamayı oluştur (bir kez)
1. https://appstoreconnect.apple.com → My Apps → **+** → New App
2. Platforms: **iOS**
3. Name: **Eskişehir Ulaşım**
4. Primary Language: Turkish
5. Bundle ID: **com.honoxia.otobusumnerde**
   - Listede yoksa: https://developer.apple.com/account/resources/identifiers/list
     → **+** → App IDs → App → Bundle ID (Explicit): `com.honoxia.otobusumnerde`
6. SKU: `otobusumnerde`
7. User Access: Full Access

## 2) Projeyi honoxia diskinde hazırla
Mac Terminal:

```bash
# Disk adını kontrol
ls /Volumes

# Bu repoyu bir kez iç diske veya indirme klasörüne alıp script'i çalıştır,
# script projeyi honoxia'ya klonlar:
cd ~/Downloads   # veya repoyu nereye indirdiysen
# henüz repo yoksa:
git clone -b cursor/ios-app-store-publish-4cee https://github.com/honoxia/otobusum-nerde-.git
cd otobusum-nerde-
bash scripts/mac-xcode-setup.sh
```

Disk adı farklıysa:

```bash
HONOXIA_ROOT=/Volumes/DiskAdin bash scripts/mac-xcode-setup.sh
```

Script bitince Xcode açılır.

## 3) Xcode imzalama
1. Sol üstte mavi proje ikonu → target **otobusumnerde** (veya benzeri)
2. **Signing & Capabilities**
3. ☑ Automatically manage signing
4. **Team**: Developer Program hesabın (Personal Team değil)
5. Bundle Identifier: `com.honoxia.otobusumnerde`

## 4) Archive ve yükle
1. Üstte cihaz: **Any iOS Device (arm64)** (Simulator seçili olmasın)
2. **Product → Archive** (birkaç dakika sürebilir)
3. Organizer → **Distribute App**
4. **App Store Connect** → Upload
5. Options: varsayılanlar yeterli → Upload

## 5) App Store Connect tamamla
Upload sonrası (10–20 dk processing):
- Ekran görüntüleri: repoda `store/ios/screenshots/`
- Açıklama / anahtar kelimeler: `store/ios/metadata.json`
- Privacy Policy: GitHub Pages sonrası  
  `https://honoxia.github.io/otobusum-nerde-/privacy.html`  
  (Pages açılmadıysa geçici olarak `docs/privacy.html` içeriğini herhangi bir public URL’e koy)
- Age Rating, kategori: Navigation / Travel
- Build seç → **Add for Review** → Submit

## Notlar
- `ios/` klasörü git’te yok; her Mac’te `expo prebuild` ile üretilir (script yapıyor).
- Konum izni test için Review’da Eskişehir konumu / simulator custom location kullan.
- Resmî belediye uygulaması olmadığını açıklamada belirt (metadata’da var).
