# Frontend React

El frontend conserva Firebase Authentication. Su única URL de backend es
`VITE_API_URL`: en local apunta a `http://127.0.0.1:8080/api` y en OCI debe
apuntar al deployment de API Gateway. El interceptor de Axios añade
`Authorization: Bearer <Firebase ID token>` a cada llamada.

```bash
cp .env.example .env
# completar las variables públicas de Firebase
npm install
npm run dev
```

El frontend no conoce las direcciones de los microservicios. Consume
`/companies` y `/materials` a través de una sola URL.

## Una sola imagen para varios ambientes

`docker build` no recibe variables Firebase. Al iniciar el contenedor, el
script `docker-entrypoint.d/40-runtime-config.sh` crea
`/runtime-config.js` con las variables `VITE_*` recibidas mediante
`docker run -e` o, posteriormente, desde la configuración de OKE.

```bash
docker build -t ecored-frontend:1.0 .
docker run --rm -p 8084:80 \
  -e VITE_API_URL=http://127.0.0.1:8080/api \
  -e VITE_FIREBASE_API_KEY=VALOR_PUBLICO \
  -e VITE_FIREBASE_AUTH_DOMAIN=PROYECTO.firebaseapp.com \
  -e VITE_FIREBASE_PROJECT_ID=PROYECTO \
  -e VITE_FIREBASE_APP_ID=APP_ID \
  ecored-frontend:1.0
```
