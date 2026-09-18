import os
from datetime import datetime, timezone
from functools import lru_cache

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import MongoClient


class MongoCompanyRepository:
    """Encapsula todas las operaciones de Empresas sobre MongoDB."""

    def __init__(self, uri, database_name):
        # Un timeout corto permite detectar pronto una URI o una ACL incorrecta.
        self.client = MongoClient(uri, serverSelectionTimeoutMS=5000)

        # MongoClient es perezoso; ping fuerza una conexión real al construirlo.
        self.client.admin.command("ping")

        # Solo este repositorio conoce el nombre físico de la colección.
        self.collection = self.client[database_name]["companies"]

    @staticmethod
    def _serialize(document):
        """Convierte tipos BSON en un objeto que DRF puede serializar a JSON."""
        if not document:
            return None

        result = dict(document)
        result["id"] = str(result.pop("_id"))

        if hasattr(result.get("created_at"), "isoformat"):
            result["created_at"] = result["created_at"].isoformat()

        return result

    def list_by_owner(self, owner_uid):
        """Retorna únicamente las empresas pertenecientes al usuario."""
        documents = self.collection.find({"owner_uid": owner_uid}).sort(
            "created_at",
            -1,
        )
        return [self._serialize(document) for document in documents]

    def create(self, owner_uid, company):
        """Persiste una empresa asociándola al UID autenticado."""
        document = {
            **company,
            "owner_uid": owner_uid,
            "created_at": datetime.now(timezone.utc),
        }
        document["_id"] = self.collection.insert_one(document).inserted_id
        return self._serialize(document)

    def get_owned(self, company_id, owner_uid):
        """Busca una empresa por ID y propietario en una sola consulta."""
        try:
            object_id = ObjectId(company_id)
        except InvalidId:
            return None

        document = self.collection.find_one(
            {"_id": object_id, "owner_uid": owner_uid},
        )
        return self._serialize(document)


@lru_cache(maxsize=1)
def get_company_repository():
    """Construye una sola instancia y exige configuración MongoDB real."""
    uri = os.getenv("MONGODB_URI", "").strip()
    if not uri:
        raise RuntimeError("Falta la variable obligatoria MONGODB_URI")

    database_name = os.getenv("MONGODB_DB_NAME", "ecored_companies").strip()
    return MongoCompanyRepository(uri, database_name)
