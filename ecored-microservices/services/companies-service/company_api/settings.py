import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "").strip()
if not SECRET_KEY:
    raise RuntimeError("Falta la variable obligatoria DJANGO_SECRET_KEY")

DEBUG = os.getenv("DJANGO_DEBUG", "False").lower() == "true"
ALLOWED_HOSTS = [
    value.strip()
    for value in os.getenv(
        "DJANGO_ALLOWED_HOSTS",
        "127.0.0.1,localhost",
    ).split(",")
    if value.strip()
]

INSTALLED_APPS = [
    "corsheaders",
    "rest_framework",
    "companies",
]
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]
ROOT_URLCONF = "company_api.urls"
TEMPLATES = []
WSGI_APPLICATION = "company_api.wsgi.application"

# Django no almacena modelos: MongoDB se usa directamente mediante repositorios.
DATABASES = {"default": {"ENGINE": "django.db.backends.dummy"}}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS = [
    value.strip()
    for value in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    if value.strip()
]
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["companies.auth.GatewayHeaderAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "UNAUTHENTICATED_USER": None,
}
