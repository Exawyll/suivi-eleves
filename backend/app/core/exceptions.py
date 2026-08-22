class CarnetError(Exception):
    """Base class for business errors.

    Services raise these instead of HTTPException: the HTTP status is a
    transport concern that belongs to the endpoint layer, and keeping it out of
    the services lets them be reused and tested without FastAPI.
    """

    status_code: int = 400
    detail: str = "Requête invalide."

    def __init__(self, detail: str | None = None) -> None:
        """The class carries a sensible default; a caller may sharpen it."""
        self.detail = detail or type(self).detail
        super().__init__(self.detail)


class NotFoundError(CarnetError):
    status_code = 404
    detail = "Ressource introuvable."


class ConflictError(CarnetError):
    status_code = 409
    detail = "Conflit avec l'état actuel de la ressource."


class AuthenticationError(CarnetError):
    status_code = 401
    detail = "Authentification requise."


class TooManyAttemptsError(CarnetError):
    status_code = 429
    detail = "Trop de tentatives. Réessayez dans quelques minutes."
