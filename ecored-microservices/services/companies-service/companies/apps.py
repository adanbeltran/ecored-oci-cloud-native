from django.apps import AppConfig


class CompaniesConfig(AppConfig):
    """Configura la aplicación y valida MongoDB antes de aceptar tráfico."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "companies"

    def ready(self):
        # La importación local evita cargar el repositorio antes de que Django
        # haya leído settings.py y el archivo .env.
        from .repositories import get_company_repository

        # MongoClient es perezoso; el repositorio ejecuta ping en su constructor.
        get_company_repository()
