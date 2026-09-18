# Imagen pequeña y compatible con la versión de Node usada por el proyecto.
FROM node:24-alpine

# El gateway debe aceptar tráfico desde fuera de su contenedor.
ENV HOST=0.0.0.0
WORKDIR /app

# El lockfile hace reproducible la instalación y permite reutilizar la caché.
COPY package*.json ./
RUN npm ci --omit=dev

# El gateway solo necesita el punto de entrada y el validador JWT.
COPY server.js ./server.js
COPY src ./src
EXPOSE 8080

CMD ["npm", "start"]
