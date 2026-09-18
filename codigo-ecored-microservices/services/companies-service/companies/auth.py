from dataclasses import dataclass

from rest_framework import authentication, exceptions


@dataclass(frozen=True)
class GatewayUser:
    """Identidad mínima que DRF necesita para autorizar una petición."""

    uid: str
    email: str = ""

    @property
    def is_authenticated(self):
        return True


class GatewayHeaderAuthentication(authentication.BaseAuthentication):
    """Acepta únicamente la identidad interna construida por API Gateway."""

    def authenticate(self, request):
        uid = request.headers.get("X-User-Id", "").strip()
        if not uid:
            raise exceptions.AuthenticationFailed(
                "Falta la identidad validada por el gateway",
            )
        user = GatewayUser(
            uid=uid,
            email=request.headers.get("X-User-Email", "").strip(),
        )
        return user, None
