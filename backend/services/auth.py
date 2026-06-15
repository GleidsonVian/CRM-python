import json, time, hashlib, hmac, base64
from fastapi import HTTPException
import models
import config
from database import get_db

_JWT_SECRET = config.JWT_SECRET
_JWT_ALGO   = "HS256"


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def jwt_encode(payload: dict) -> str:
    header = _b64url(json.dumps({"alg": _JWT_ALGO, "typ": "JWT"}).encode())
    body   = _b64url(json.dumps(payload).encode())
    sig    = _b64url(hmac.new(_JWT_SECRET.encode(), msg=f"{header}.{body}".encode(), digestmod=hashlib.sha256).digest())
    return f"{header}.{body}.{sig}"


def jwt_decode(token: str) -> dict:
    try:
        header, body, sig = token.split(".")
        expected = _b64url(hmac.new(_JWT_SECRET.encode(), msg=f"{header}.{body}".encode(), digestmod=hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            raise ValueError("bad signature")
        payload = json.loads(base64.urlsafe_b64decode(body + "=="))
        if payload.get("exp", 0) < time.time():
            raise ValueError("expired")
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")


def hash_password(pw: str) -> str:
    salt = "nexus-salt"
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 100_000).hex()


def verify_password(pw: str, hashed: str) -> bool:
    return hash_password(pw) == hashed


def log_audit(db, action: str, entity_type: str, entity_id=None, entity_name=None,
              actor="Sistema", actor_email=None, details=None):
    try:
        entry = models.AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            actor=actor,
            actor_email=actor_email,
            details=details,
        )
        db.add(entry)
        db.commit()
    except Exception:
        pass  # audit log must never break normal flow
