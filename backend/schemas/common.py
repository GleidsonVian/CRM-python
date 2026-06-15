import json as _json
from typing import Any, Optional
from pydantic import BaseModel


def coerce_json_str(v, expected_type):
    """Accept either a native list/dict or a JSON-encoded string."""
    if isinstance(v, str):
        try:
            return _json.loads(v)
        except Exception:
            return expected_type()
    return v if v is not None else expected_type()


class MessageResponse(BaseModel):
    message: str


class OkResponse(BaseModel):
    ok: bool = True
    message: Optional[str] = None
    entry_id: Optional[int] = None
    result: Optional[Any] = None


class HealthResponse(BaseModel):
    status: str
    db: str
