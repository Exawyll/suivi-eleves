from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError
from app.core.security import decode_access_token
from app.database import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository

# auto_error=False so a missing header raises our own AuthenticationError,
# with the French message and the shape every other error uses.
bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    """The only way an endpoint learns who is calling.

    The identity comes from the signed token and nothing else — never from a
    field in the request body. This is what keeps one teacher's carnet out of
    another's reach, so no endpoint may take a user id as a parameter.
    """
    if credentials is None:
        raise AuthenticationError

    user = await UserRepository(db).get_by_id(decode_access_token(credentials.credentials))
    if user is None:
        # A valid token for an account that has since been deleted.
        raise AuthenticationError
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def client_ip(request: Request) -> str:
    """Best-effort source address for throttling.

    Railway terminates TLS in front of the app, so the socket peer is its
    proxy; the forwarded header is what distinguishes callers. It is
    client-supplied and therefore spoofable — which is exactly why the login
    throttle also keys on the account, and never on the address alone.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


ClientIp = Annotated[str, Depends(client_ip)]
