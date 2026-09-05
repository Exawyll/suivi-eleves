import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserRepository:
    """Every read and write of `users`. No HTTP, no business rules."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def create(
        self,
        *,
        email: str,
        first_name: str,
        last_name: str,
        auth_hash: str,
        kdf_salt: bytes,
        kdf_iterations: int,
        wrapped_dek: bytes,
        dek_nonce: bytes,
    ) -> User:
        user = User(
            email=email,
            first_name=first_name,
            last_name=last_name,
            auth_hash=auth_hash,
            kdf_salt=kdf_salt,
            kdf_iterations=kdf_iterations,
            wrapped_dek=wrapped_dek,
            dek_nonce=dek_nonce,
        )
        self.db.add(user)
        await self.db.flush()
        return user

    async def set_auth_hash(self, user: User, auth_hash: str) -> None:
        user.auth_hash = auth_hash
        await self.db.flush()

    async def replace_crypto_material(
        self,
        user: User,
        *,
        auth_hash: str,
        kdf_salt: bytes,
        kdf_iterations: int,
        wrapped_dek: bytes,
        dek_nonce: bytes,
    ) -> None:
        user.auth_hash = auth_hash
        user.kdf_salt = kdf_salt
        user.kdf_iterations = kdf_iterations
        user.wrapped_dek = wrapped_dek
        user.dek_nonce = dek_nonce
        await self.db.flush()

    async def set_recovery_material(
        self,
        user: User,
        *,
        recovery_auth_hash: str,
        wrapped_dek_recovery: bytes,
        dek_nonce_recovery: bytes,
    ) -> None:
        user.recovery_auth_hash = recovery_auth_hash
        user.wrapped_dek_recovery = wrapped_dek_recovery
        user.dek_nonce_recovery = dek_nonce_recovery
        await self.db.flush()

    async def delete(self, user: User) -> None:
        """Removes the account; the refresh tokens and, once it exists, every
        synchronised record follow through their ON DELETE CASCADE."""
        await self.db.delete(user)
        await self.db.flush()
