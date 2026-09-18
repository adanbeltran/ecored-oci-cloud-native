#!/usr/bin/env sh
set -eu

# Escapa caracteres que podrían romper una cadena JavaScript.
escape_javascript() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

# La imagen oficial de Nginx ejecuta este archivo antes de iniciar el servidor.
config_file=/usr/share/nginx/html/runtime-config.js

cat > "$config_file" <<EOF
window.__ECORED_CONFIG__ = Object.freeze({
  VITE_API_URL: "$(escape_javascript "${VITE_API_URL:-}")",
  VITE_FIREBASE_API_KEY: "$(escape_javascript "${VITE_FIREBASE_API_KEY:-}")",
  VITE_FIREBASE_AUTH_DOMAIN: "$(escape_javascript "${VITE_FIREBASE_AUTH_DOMAIN:-}")",
  VITE_FIREBASE_PROJECT_ID: "$(escape_javascript "${VITE_FIREBASE_PROJECT_ID:-}")",
  VITE_FIREBASE_APP_ID: "$(escape_javascript "${VITE_FIREBASE_APP_ID:-}")"
});
EOF
