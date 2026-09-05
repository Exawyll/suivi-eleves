from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import AuthenticationError, ConflictError
from app.core.security import (
    auth_hash_needs_upgrade,
    create_access_token,
    decoy_kdf_salt,
    generate_refresh_token,
    hash_auth_secret,
    hash_refresh_token,
    verify_auth_secret,
)
from app.core.throttle import AttemptThrottle, login_throttle
from app.models.user import User
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    ChangePasswordRequest,
    CompleteRecoveryRequest,
    LoginRequest,
    RecoveryMaterial,
    SetupRecoveryRequest,
    SignupRequest,
    StartRecoveryRequest,
)

DEFAULT_KDF_ITERATIONS = 600_000

# Verified against when the email is unknown, so a missing account costs the
# same time as a wrong secret. Without it, response latency alone would tell an
# attacker which addresses have an account.
_TIMING_DECOY_HASH = hash_auth_secret("carnet:timing-decoy")


@dataclass(frozen=True)
class IssuedSession:
    user: User
    access_token: str
    refresh_token: str


@dataclass(frozen=True)
class KdfParams:
    salt: bytes
    iterations: int


class AuthService:
    """Account lifecycle. Raises business errors; never imports FastAPI."""

    def __init__(self, db: AsyncSession, throttle: AttemptThrottle = login_throttle) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.tokens = RefreshTokenRepository(db)
        self.throttle = throttle

    async def kdf_params(self, email: str) -> KdfParams:
        user = await self.users.get_by_email(email)
        if user is None:
            return KdfParams(salt=decoy_kdf_salt(email), iterations=DEFAULT_KDF_ITERATIONS)
        return KdfParams(salt=user.kdf_salt, iterations=user.kdf_iterations)

    async def signup(self, data: SignupRequest) -> IssuedSession:
        if await self.users.get_by_email(data.email) is not None:
            raise ConflictError(detail="Un compte existe déjà pour cette adresse.")

        try:
            user = await self.users.create(
                email=data.email,
                first_name=data.first_name.strip(),
                last_name=data.last_name.strip(),
                auth_hash=hash_auth_secret(data.auth_secret),
                kdf_salt=data.kdf_salt,
                kdf_iterations=data.kdf_iterations,
                wrapped_dek=data.wrapped_dek,
                dek_nonce=data.dek_nonce,
            )
        except IntegrityError as exc:
            # The check above loses to a second request that got there first;
            # the unique index is what actually decides.
            await self.db.rollback()
            raise ConflictError(detail="Un compte existe déjà pour cette adresse.") from exc

        return await self._issue_session(user)

    async def login(self, data: LoginRequest, *, client_ip: str) -> IssuedSession:
        keys = self._throttle_keys(data.email, client_ip)
        for key in keys:
            self.throttle.check(key)

        user = await self.users.get_by_email(data.email)
        # Both branches run argon2 exactly once, and both fail identically: the
        # client must not be able to tell "no such account" from "wrong
        # password", by response or by timing.
        secret_ok = verify_auth_secret(
            data.auth_secret, user.auth_hash if user else _TIMING_DECOY_HASH
        )
        if user is None or not secret_ok:
            for key in keys:
                self.throttle.record_failure(key)
            raise AuthenticationError(detail="Adresse ou mot de passe incorrect.")

        for key in keys:
            self.throttle.reset(key)

        if auth_hash_needs_upgrade(user.auth_hash):
            await self.users.set_auth_hash(user, hash_auth_secret(data.auth_secret))

        return await self._issue_session(user)

    async def refresh(self, refresh_token: str) -> IssuedSession:
        stored = await self.tokens.get_active(hash_refresh_token(refresh_token))
        if stored is None:
            raise AuthenticationError(detail="Session expirée, reconnectez-vous.")

        user = await self.users.get_by_id(stored.user_id)
        if user is None:
            raise AuthenticationError(detail="Session expirée, reconnectez-vous.")

        # Rotation: the presented token dies here, so a stolen copy is usable
        # at most once, and only until the real device refreshes.
        await self.tokens.revoke(stored)
        return await self._issue_session(user)

    async def logout(self, refresh_token: str) -> None:
        """Silent when the token is already gone: signing out cannot fail."""
        stored = await self.tokens.get_active(hash_refresh_token(refresh_token))
        if stored is not None:
            await self.tokens.revoke(stored)

    async def change_password(self, user: User, data: ChangePasswordRequest) -> IssuedSession:
        if not verify_auth_secret(data.current_auth_secret, user.auth_hash):
            raise AuthenticationError(detail="Mot de passe actuel incorrect.")

        await self.users.replace_crypto_material(
            user,
            auth_hash=hash_auth_secret(data.new_auth_secret),
            kdf_salt=data.kdf_salt,
            kdf_iterations=data.kdf_iterations,
            wrapped_dek=data.wrapped_dek,
            dek_nonce=data.dek_nonce,
        )
        await self.tokens.revoke_all_for_user(user.id)
        return await self._issue_session(user)

    async def delete_account(self, user: User) -> None:
        await self.users.delete(user)

    async def setup_recovery(self, user: User, data: SetupRecoveryRequest) -> None:
        await self.users.set_recovery_material(
            user,
            recovery_auth_hash=hash_auth_secret(data.recovery_auth_secret),
            wrapped_dek_recovery=data.wrapped_dek_recovery,
            dek_nonce_recovery=data.dek_nonce_recovery,
        )

    async def start_recovery(
        self, data: StartRecoveryRequest, *, client_ip: str
    ) -> RecoveryMaterial:
        keys = self._throttle_keys(data.email, client_ip, action="recovery")
        for key in keys:
            self.throttle.check(key)

        user = await self._verify_recovery_secret(data.email, data.recovery_auth_secret, keys)
        # `_verify_recovery_secret` only returns once `recovery_auth_hash` is
        # set, and `set_recovery_material` always writes these three together.
        assert user.wrapped_dek_recovery is not None
        assert user.dek_nonce_recovery is not None
        return RecoveryMaterial(
            wrapped_dek_recovery=user.wrapped_dek_recovery,
            dek_nonce_recovery=user.dek_nonce_recovery,
        )

    async def complete_recovery(
        self, data: CompleteRecoveryRequest, *, client_ip: str
    ) -> IssuedSession:
        keys = self._throttle_keys(data.email, client_ip, action="recovery")
        for key in keys:
            self.throttle.check(key)

        # Re-verified rather than trusted from `start_recovery`: nothing ties
        # the two calls together, so each has to stand on its own proof.
        user = await self._verify_recovery_secret(data.email, data.recovery_auth_secret, keys)

        await self.users.replace_crypto_material(
            user,
            auth_hash=hash_auth_secret(data.new_auth_secret),
            kdf_salt=data.kdf_salt,
            kdf_iterations=data.kdf_iterations,
            wrapped_dek=data.wrapped_dek,
            dek_nonce=data.dek_nonce,
        )
        # The recovery key that was just spent must not still work afterwards.
        await self.users.set_recovery_material(
            user,
            recovery_auth_hash=hash_auth_secret(data.new_recovery_auth_secret),
            wrapped_dek_recovery=data.new_wrapped_dek_recovery,
            dek_nonce_recovery=data.new_dek_nonce_recovery,
        )
        await self.tokens.revoke_all_for_user(user.id)
        return await self._issue_session(user)

    async def _verify_recovery_secret(
        self, email: str, recovery_auth_secret: str, throttle_keys: tuple[str, str]
    ) -> User:
        """Common gate for both recovery steps.

        Checked against the decoy hash whenever there is nothing real to check
        against — unknown email or no recovery key configured — so neither
        shows up as a different failure from a wrong secret.
        """
        user = await self.users.get_by_email(email)
        stored_hash = _TIMING_DECOY_HASH
        if user is not None and user.recovery_auth_hash is not None:
            stored_hash = user.recovery_auth_hash
        secret_ok = verify_auth_secret(recovery_auth_secret, stored_hash)

        if user is None or user.recovery_auth_hash is None or not secret_ok:
            for key in throttle_keys:
                self.throttle.record_failure(key)
            raise AuthenticationError(detail="Adresse ou clé de récupération incorrecte.")

        for key in throttle_keys:
            self.throttle.reset(key)
        return user

    async def _issue_session(self, user: User) -> IssuedSession:
        refresh_token = generate_refresh_token()
        await self.tokens.create(
            user_id=user.id,
            token_hash=hash_refresh_token(refresh_token),
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_ttl_days),
        )
        return IssuedSession(
            user=user,
            access_token=create_access_token(user.id),
            refresh_token=refresh_token,
        )

    @staticmethod
    def _throttle_keys(email: str, client_ip: str, *, action: str = "login") -> tuple[str, str]:
        """Locks out per account and per source address.

        Neither alone is enough: keying only on the address lets an attacker
        rotate IPs, keying only on the account lets anyone lock a colleague out
        of their carnet for the window. Requiring both to stay under the limit
        makes guessing one account from many addresses the expensive path,
        while a targeted lockout still costs the attacker the same address.

        `action` namespaces the login and recovery counters apart: a teacher
        fumbling their recovery key must not burn down their own ability to
        log in with the password they still remember, or vice versa.
        """
        return (f"{action}:email:{email}", f"{action}:ip:{client_ip}")
