#!/usr/bin/env sh
set -eu

gateway=${GATEWAY_URL:-http://127.0.0.1:8080}
token=${FIREBASE_ID_TOKEN:-}

if [ -z "$token" ]; then
  echo "Falta FIREBASE_ID_TOKEN con un ID token vigente de Firebase." >&2
  exit 1
fi

echo "Verificando gateway local..."
curl --fail --silent --show-error "$gateway/health"
echo

echo "Creando empresa..."
company_json=$(curl --fail --silent --show-error \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  -d '{"name":"EcoRed Local","nit":"900123456","city":"Bogotá","sector":"Reciclaje"}' \
  "$gateway/api/companies")
echo "$company_json"
company_id=$(printf '%s' "$company_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')

echo "Creando material para la empresa $company_id..."
curl --fail --silent --show-error \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  -d "{\"company_id\":\"$company_id\",\"material_type\":\"Cartón\",\"quantity\":25,\"unit\":\"kg\",\"location\":\"Bogotá\"}" \
  "$gateway/api/materials"
echo

echo "Consultando recursos..."
curl --fail --silent --show-error \
  -H "Authorization: Bearer $token" \
  "$gateway/api/companies"
echo
curl --fail --silent --show-error \
  -H "Authorization: Bearer $token" \
  "$gateway/api/materials"
echo
echo "Prueba integral terminada correctamente."
