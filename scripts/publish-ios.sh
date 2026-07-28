#!/usr/bin/env bash
# Tek komutla iOS production build (+ isteğe bağlı submit).
# Gereken ortam değişkenleri:
#   EXPO_TOKEN                         (zorunlu)
#   EXPO_APPLE_APP_SPECIFIC_PASSWORD   (veya ASC API key seti)
#   EXPO_ASC_API_KEY_ID / EXPO_ASC_API_KEY_ISSUER_ID / EXPO_ASC_API_KEY_PATH
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${EXPO_TOKEN:-}" ]]; then
  echo "HATA: EXPO_TOKEN yok."
  echo "https://expo.dev/accounts → Access Tokens"
  exit 1
fi

if ! command -v eas >/dev/null 2>&1; then
  npx --yes eas-cli@latest whoami >/dev/null || true
  EAS=(npx --yes eas-cli@latest)
else
  EAS=(eas)
fi

PROFILE="${1:-production}"
AUTO_SUBMIT="${AUTO_SUBMIT:-1}"

ARGS=(build --platform ios --profile "$PROFILE" --non-interactive)
if [[ "$AUTO_SUBMIT" == "1" ]]; then
  ARGS+=(--auto-submit)
fi

echo "→ eas ${ARGS[*]}"
"${EAS[@]}" "${ARGS[@]}"
