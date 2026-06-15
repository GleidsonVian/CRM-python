from typing import Optional
import models
from services.auth import jwt_decode


def _get_user_permissions(authorization: Optional[str], db) -> dict:
    """Returns the permissions dict for the current user, or {} if not authenticated."""
    if not authorization or not authorization.startswith("Bearer "):
        return {}
    try:
        payload = jwt_decode(authorization.replace("Bearer ", ""))
        user = db.query(models.User).filter(models.User.id == payload["sub"]).first()
        if user and user.role_id:
            role = db.query(models.Role).filter(models.Role.id == user.role_id).first()
            if role:
                raw = role.permissions or {}
                if "entities" in raw:
                    return {"user_id": user.id, "_format": "v2", **raw}
                else:
                    return {"user_id": user.id, "_format": "v1", **raw}
    except Exception:
        pass
    return {}


def _resolve_read_scope(perms: dict, entity: str) -> str:
    """Returns 'own', 'all', or 'deny' for a given entity's read permission."""
    if not perms:
        return "all"
    fmt = perms.get("_format", "v1")
    if fmt == "v2":
        return perms.get("entities", {}).get(entity, {}).get("read", "all")
    else:
        vs = perms.get("view_scope", "all")
        if entity in ("deal", "lead"):
            return vs if vs in ("own", "all", "deny") else "all"
        return "all"
