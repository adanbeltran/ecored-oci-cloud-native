# Alpine mantiene pequeña la imagen de ejecución de Node.
FROM node:24-alpine

# Dentro de un contenedor el proceso debe escuchar más allá de localhost.
ENV HOST=0.0.0.0
WORKDIR /app

# El lockfile fija versiones reproducibles y mejora la caché de construcción.
COPY package*.json ./
RUN npm ci --omit=dev

# Solo se copia el código necesario para ejecutar el microservicio.
COPY src ./src
EXPOSE 8002

# package.json define start como node src/server.js.
CMD ["npm", "start"]
