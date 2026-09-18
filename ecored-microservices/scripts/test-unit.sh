#!/usr/bin/env sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

echo "1/5 Pruebas de dominio de companies-service"
cd "$project_dir/services/companies-service"
python3 -m unittest discover -s tests -v

echo "2/5 Compilación sintáctica de Python"
python3 -m compileall -q company_api companies tests

echo "3/5 Pruebas de dominio de materials-service"
cd "$project_dir/services/materials-service"
node --test

echo "4/5 Pruebas de autenticación del gateway local"
cd "$project_dir/local-gateway"
npm test

echo "5/5 Validación sintáctica de JavaScript"
cd "$project_dir/services/materials-service"
for file in src/*.js src/repositories/*.js "$project_dir/local-gateway/server.js"; do
  node --check "$file"
done
node --check "$project_dir/local-gateway/src/firebaseTokenValidator.js"

echo "Todas las pruebas unitarias y sintácticas terminaron correctamente."
