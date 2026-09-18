# Primera etapa: compila React y produce archivos HTML, CSS y JavaScript.
FROM node:24-alpine AS build
WORKDIR /app

# npm ci instala exactamente las versiones registradas en package-lock.json.
COPY package*.json ./
RUN npm ci
COPY . .

# La compilación es genérica: no incorpora configuración del estudiante.
RUN npm run build

# Segunda etapa: sirve únicamente los archivos estáticos, sin Node ni fuentes.
FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker-entrypoint.d/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh
EXPOSE 80
