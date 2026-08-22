from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.services.auth_service import AuthService

router = APIRouter(prefix="/account", tags=["account"])


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(user: CurrentUser, db: DbSession) -> None:
    """Erases the account and everything attached to it, irreversibly.

    The refresh tokens and the synchronised records go with it through their
    ON DELETE CASCADE — there is nothing left to decrypt afterwards.
    """
    await AuthService(db).delete_account(user)
