"""Tests for services/permissions.py"""
import pytest
from services.permissions import _resolve_read_scope


class TestResolveReadScope:
    def test_empty_perms_returns_all(self):
        assert _resolve_read_scope({}, "deal") == "all"

    def test_none_perms_returns_all(self):
        assert _resolve_read_scope(None, "deal") == "all"

    # ── v2 format ─────────────────────────────────────────────────────────────

    def test_v2_deal_all(self):
        perms = {"_format": "v2", "entities": {"deal": {"read": "all"}}}
        assert _resolve_read_scope(perms, "deal") == "all"

    def test_v2_deal_own(self):
        perms = {"_format": "v2", "entities": {"deal": {"read": "own"}}}
        assert _resolve_read_scope(perms, "deal") == "own"

    def test_v2_deal_deny(self):
        perms = {"_format": "v2", "entities": {"deal": {"read": "deny"}}}
        assert _resolve_read_scope(perms, "deal") == "deny"

    def test_v2_lead_own(self):
        perms = {"_format": "v2", "entities": {"lead": {"read": "own"}}}
        assert _resolve_read_scope(perms, "lead") == "own"

    def test_v2_missing_entity_defaults_to_all(self):
        perms = {"_format": "v2", "entities": {}}
        assert _resolve_read_scope(perms, "deal") == "all"

    def test_v2_missing_read_key_defaults_to_all(self):
        perms = {"_format": "v2", "entities": {"deal": {"edit": "own"}}}
        assert _resolve_read_scope(perms, "deal") == "all"

    def test_v2_contact_not_restricted(self):
        # contacts don't support "own" scope in v2 either — returns whatever is set
        perms = {"_format": "v2", "entities": {"contact": {"read": "all"}}}
        assert _resolve_read_scope(perms, "contact") == "all"

    # ── v1 legacy format ──────────────────────────────────────────────────────

    def test_v1_view_scope_all_for_deal(self):
        perms = {"_format": "v1", "view_scope": "all"}
        assert _resolve_read_scope(perms, "deal") == "all"

    def test_v1_view_scope_own_for_deal(self):
        perms = {"_format": "v1", "view_scope": "own"}
        assert _resolve_read_scope(perms, "deal") == "own"

    def test_v1_view_scope_own_for_lead(self):
        perms = {"_format": "v1", "view_scope": "own"}
        assert _resolve_read_scope(perms, "lead") == "own"

    def test_v1_contact_always_all(self):
        # v1 doesn't restrict contacts
        perms = {"_format": "v1", "view_scope": "own"}
        assert _resolve_read_scope(perms, "contact") == "all"

    def test_v1_invalid_scope_defaults_to_all(self):
        perms = {"_format": "v1", "view_scope": "invalid_value"}
        assert _resolve_read_scope(perms, "deal") == "all"

    def test_v1_missing_view_scope_defaults_to_all(self):
        perms = {"_format": "v1"}
        assert _resolve_read_scope(perms, "deal") == "all"
