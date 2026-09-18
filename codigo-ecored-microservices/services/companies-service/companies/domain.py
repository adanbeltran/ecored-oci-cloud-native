# Una sola fuente de verdad evita repetir campos obligatorios en cada vista.
REQUIRED_FIELDS = ("name", "nit", "city", "sector")


class CompanyValidationError(ValueError):
    """Error esperado cuando el JSON no cumple el contrato de Empresas."""


def validate_company(payload):
    """Valida y normaliza datos externos antes de enviarlos a MongoDB."""
    if not isinstance(payload, dict):
        raise CompanyValidationError("El cuerpo debe ser un objeto JSON")

    # Se crea un objeto nuevo para no persistir propiedades no autorizadas.
    company = {}
    for field in REQUIRED_FIELDS:
        # str y strip normalizan números o textos y eliminan espacios laterales.
        value = str(payload.get(field, "")).strip()
        if not value:
            raise CompanyValidationError(f"El campo '{field}' es obligatorio")
        company[field] = value
    return company
