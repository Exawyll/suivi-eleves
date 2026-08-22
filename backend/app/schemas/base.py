import base64
from typing import Annotated

from pydantic import BaseModel, ConfigDict, PlainSerializer
from pydantic.alias_generators import to_camel


def _to_base64(value: bytes) -> str:
    return base64.b64encode(value).decode()


# For bytes read back out of the database. `Base64Bytes` cannot be reused here:
# it *decodes* on validation, so feeding it a column that already holds raw
# bytes would decode them a second time — silently, whenever those bytes happen
# to be valid base64.
Base64Out = Annotated[bytes, PlainSerializer(_to_base64, return_type=str)]


class CarnetSchema(BaseModel):
    """Base for every request/response schema.

    The API speaks camelCase because its only client is the TypeScript
    frontend; Python keeps snake_case. `populate_by_name` lets tests and
    internal callers build a model with the Python names.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
