import uuid
from typing import Annotated, Literal

from pydantic import Base64Bytes, EmailStr, Field, field_validator

from app.schemas.base import Base64Out, CarnetSchema

# Sizes of the client's crypto material, in decoded bytes. Ranges rather than
# exact values so the scheme can be tuned without a migration, but tight enough
# that a malformed or hostile payload is rejected at the edge.
KdfSalt = Annotated[Base64Bytes, Field(min_length=16, max_length=64)]
WrappedDek = Annotated[Base64Bytes, Field(min_length=32, max_length=128)]
DekNonce = Annotated[Base64Bytes, Field(min_length=12, max_length=16)]
AuthSecret = Annotated[str, Field(min_length=16, max_length=512)]
# A floor, not a default: the client picks the count, and refusing a low one
# stops a tampered client from silently weakening a user's key derivation.
KdfIterations = Annotated[int, Field(ge=600_000, le=10_000_000)]

Name = Annotated[str, Field(min_length=1, max_length=100)]


class EmailCarrier(CarnetSchema):
    """Shared email normalisation: the address is the account's identity."""

    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalise_email(cls, value: str) -> str:
        return value.strip().lower()


class UserResponse(CarnetSchema):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    recovery_enabled: bool


class CryptoMaterial(CarnetSchema):
    """What a fresh device needs to derive the key that unwraps the carnet."""

    kdf_salt: Base64Out
    kdf_iterations: int
    wrapped_dek: Base64Out
    dek_nonce: Base64Out


class KdfParamsResponse(CarnetSchema):
    kdf_salt: Base64Out
    kdf_iterations: int


class SessionResponse(CarnetSchema):
    access_token: str
    refresh_token: str
    token_type: Literal["Bearer"] = "Bearer"
    user: UserResponse
    crypto: CryptoMaterial


class MeResponse(CarnetSchema):
    user: UserResponse
    crypto: CryptoMaterial


class SignupRequest(EmailCarrier):
    first_name: Name
    last_name: Name
    auth_secret: AuthSecret
    kdf_salt: KdfSalt
    kdf_iterations: KdfIterations
    wrapped_dek: WrappedDek
    dek_nonce: DekNonce


class LoginRequest(EmailCarrier):
    auth_secret: AuthSecret


class RefreshRequest(CarnetSchema):
    refresh_token: Annotated[str, Field(min_length=16, max_length=512)]


class ChangePasswordRequest(CarnetSchema):
    """Re-wrapping the data key is all a password change needs.

    The carnet itself is encrypted with the data key, which does not change —
    so no record has to be re-encrypted, however large the carnet is.
    """

    current_auth_secret: AuthSecret
    new_auth_secret: AuthSecret
    kdf_salt: KdfSalt
    kdf_iterations: KdfIterations
    wrapped_dek: WrappedDek
    dek_nonce: DekNonce


class RecoveryMaterial(CarnetSchema):
    """What a device holding the recovery key needs to unwrap the carnet."""

    wrapped_dek_recovery: Base64Out
    dek_nonce_recovery: Base64Out


class SetupRecoveryRequest(CarnetSchema):
    """Creates or replaces the recovery key. Requires a valid session, because
    re-wrapping the DEK for recovery needs it unwrapped first — exactly what
    being logged in already proves."""

    recovery_auth_secret: AuthSecret
    wrapped_dek_recovery: WrappedDek
    dek_nonce_recovery: DekNonce


class StartRecoveryRequest(EmailCarrier):
    """First step of a password-forgotten flow: trades the recovery secret for
    the wrapped DEK, so the client can unwrap it before asking for a new
    password."""

    recovery_auth_secret: AuthSecret


class CompleteRecoveryRequest(EmailCarrier):
    """Second step. `recovery_auth_secret` is re-verified here rather than
    trusted from the first call — there is no session yet to carry that proof
    across two requests, so each one stands on its own.

    Replaces the password *and* rotates the recovery key: the one just used
    is spent, exactly like a refresh token is on rotation.
    """

    recovery_auth_secret: AuthSecret
    new_auth_secret: AuthSecret
    kdf_salt: KdfSalt
    kdf_iterations: KdfIterations
    wrapped_dek: WrappedDek
    dek_nonce: DekNonce
    new_recovery_auth_secret: AuthSecret
    new_wrapped_dek_recovery: WrappedDek
    new_dek_nonce_recovery: DekNonce
