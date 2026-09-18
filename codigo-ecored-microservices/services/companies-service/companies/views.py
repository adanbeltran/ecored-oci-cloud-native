from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .domain import CompanyValidationError, validate_company
from .repositories import get_company_repository


class HealthView(APIView):
    """Endpoint público usado por Docker, Kubernetes y diagnósticos."""

    # Salud no necesita una sesión de usuario.
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"service": "companies", "status": "ok"})


class CompanyListCreateView(APIView):
    """Lista y crea empresas del usuario autenticado."""

    def get(self, request):
        # owner_uid evita mezclar datos de usuarios diferentes.
        return Response(get_company_repository().list_by_owner(request.user.uid))

    def post(self, request):
        # El dominio valida antes de que la infraestructura persista.
        try:
            company = validate_company(request.data)
        except CompanyValidationError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        created = get_company_repository().create(request.user.uid, company)
        return Response(created, status=status.HTTP_201_CREATED)


class CompanyDetailView(APIView):
    """Busca una empresa solamente si pertenece al usuario solicitante."""

    def get(self, request, company_id):
        company = get_company_repository().get_owned(company_id, request.user.uid)
        if company is None:
            return Response({"detail": "Empresa no encontrada"}, status=status.HTTP_404_NOT_FOUND)
        return Response(company)
