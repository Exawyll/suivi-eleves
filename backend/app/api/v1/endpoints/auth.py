from fastapi import APIRouter, Query, status

from app.api.deps import ClientIp, CurrentUser, DbSession
from app.schemas.auth import (
    ChangePasswordRequest,
    CryptoMaterial,
    KdfParamsResponse,
    LoginRequest,
    MeResponse,
    RefreshRequest,
    SessionResponse,
    SignupRequest,
    UserResponse,
)
from app.services.auth_service import AuthService, IssuedSession

router = APIRouter(prefix="/auth", tags=["auth"])


def _session_response(session: IssuedSession) -> SessionResponse:
    return SessionResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        user=UserResponse.model_validate(session.user),
        crypto=CryptoMaterial.model_validate(session.user),
    )


@router.get("/kdf-params")
async def kdf_params(db: DbSession, email: str = Query(max_length=320)) -> KdfParamsResponse:
    """The salt and iteration count needed to derive the key from a password.

    Answers for an unknown address too, with a stable decoy — otherwise this
    endpoint would be a way to test whether someone has an account.
    """
    params = await AuthService(db).kdf_params(email.strip().lower())
    return KdfParamsResponse(kdf_salt=params.salt, kdf_iterations=params.iterations)


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest, db: DbSession) -> SessionResponse:
    return _session_response(await AuthService(db).signup(payload))


@router.post("/login")
async def login(payload: LoginRequest, db: DbSession, ip: ClientIp) -> SessionResponse:
    return _session_response(await AuthService(db).login(payload, client_ip=ip))


@router.post("/refresh")
async def refresh(payload: RefreshRequest, db: DbSession) -> SessionResponse:
    return _session_response(await AuthService(db).refresh(payload.refresh_token))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: RefreshRequest, db: DbSession) -> None:
    await AuthService(db).logout(payload.refresh_token)


@router.get("/me")
async def me(user: CurrentUser) -> MeResponse:
    return MeResponse(
        user=UserResponse.model_validate(user),
        crypto=CryptoMaterial.model_validate(user),
    )


@router.post("/password")
async def change_password(
    payload: ChangePasswordRequest, user: CurrentUser, db: DbSession
) -> SessionResponse:
    """Re-wraps the data key under a new password and signs the other devices out."""
    return _session_response(await AuthService(db).change_password(user, payload))
