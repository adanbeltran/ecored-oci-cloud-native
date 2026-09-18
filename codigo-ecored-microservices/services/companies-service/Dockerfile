# Imagen oficial reducida con la versión de Python usada por el proyecto.
FROM python:3.12-slim

# Evita archivos .pyc y hace que los logs lleguen inmediatamente a Docker.
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# Todas las instrucciones siguientes se ejecutan dentro de /app.
WORKDIR /app

# Copiar dependencias primero permite reutilizar la caché de esta capa.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# .dockerignore impide copiar .env, entornos virtuales y archivos temporales.
COPY . .

# Documenta el puerto; la publicación real se hace con docker run -p.
EXPOSE 8001

# Gunicorn sirve Django en producción y escucha todas las interfaces del contenedor.
CMD ["gunicorn", "company_api.wsgi:application", "--bind", "0.0.0.0:8001", "--workers", "2"]
