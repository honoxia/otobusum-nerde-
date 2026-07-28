#!/usr/bin/env bash
# MacBook + harici honoxia diskinde Xcode iOS projesi hazırlar.
# Kullanım (Mac Terminal):
#   bash scripts/mac-xcode-setup.sh
#   HONOXIA_ROOT=/Volumes/Honoxia bash scripts/mac-xcode-setup.sh
set -euo pipefail

DISK_CANDIDATES=(
  "${HONOXIA_ROOT:-}"
  "/Volumes/honoxia"
  "/Volumes/Honoxia"
  "/Volumes/HONOXIA"
)

ROOT=""
for candidate in "${DISK_CANDIDATES[@]}"; do
  if [[ -n "$candidate" && -d "$candidate" ]]; then
    ROOT="$candidate"
    break
  fi
done

if [[ -z "$ROOT" ]]; then
  echo "HATA: honoxia diski bulunamadı."
  echo "Diski bağla ve adı /Volumes altında görünsün."
  echo "veya: HONOXIA_ROOT=/Volumes/DiskAdin bash scripts/mac-xcode-setup.sh"
  ls /Volumes 2>/dev/null || true
  exit 1
fi

PROJECT_DIR="${HONOXIA_PROJECT_DIR:-$ROOT/otobusum-nerde}"
REPO_URL="${REPO_URL:-https://github.com/honoxia/otobusum-nerde-.git}"
BRANCH="${BRANCH:-cursor/ios-app-store-publish-4cee}"

echo "→ Disk: $ROOT"
echo "→ Proje: $PROJECT_DIR"
echo "→ Branch: $BRANCH"

command -v git >/dev/null || { echo "git yok"; exit 1; }
command -v node >/dev/null || { echo "Node.js yok (https://nodejs.org)"; exit 1; }
command -v xcodebuild >/dev/null || { echo "Xcode yok (App Store'dan kur)"; exit 1; }

if [[ ! -d "$PROJECT_DIR/.git" ]]; then
  echo "→ Repo klonlanıyor..."
  git clone --branch "$BRANCH" "$REPO_URL" "$PROJECT_DIR"
else
  echo "→ Repo güncelleniyor..."
  git -C "$PROJECT_DIR" fetch origin
  git -C "$PROJECT_DIR" checkout "$BRANCH"
  git -C "$PROJECT_DIR" pull --ff-only origin "$BRANCH" || true
fi

cd "$PROJECT_DIR"

if [[ ! -f .env && -f .env.example ]]; then
  cp .env.example .env
  echo "→ .env oluşturuldu (.env.example'dan). Gerekirse düzenle."
fi

echo "→ npm install"
npm install

echo "→ iOS native proje (expo prebuild)"
npx expo prebuild --platform ios --clean

if ! command -v pod >/dev/null; then
  echo "→ CocoaPods kuruluyor (sudo gerekebilir)..."
  sudo gem install cocoapods
fi

echo "→ pod install"
(cd ios && pod install)

WORKSPACE=$(find ios -maxdepth 1 -name '*.xcworkspace' | head -1)
if [[ -z "$WORKSPACE" ]]; then
  echo "HATA: ios/*.xcworkspace bulunamadı"
  exit 1
fi

echo ""
echo "Hazır. Xcode açılıyor: $WORKSPACE"
echo ""
echo "Xcode'da:"
echo "  1) Sol taraftan proje adını seç → Signing & Capabilities"
echo "  2) Team: Apple Developer hesabın"
echo "  3) Bundle Identifier: com.honoxia.otobusumnerde"
echo "  4) Product → Destination → Any iOS Device (arm64)"
echo "  5) Product → Archive"
echo "  6) Distribute App → App Store Connect"
echo ""
open "$WORKSPACE"
