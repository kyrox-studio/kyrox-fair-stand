"""0095: varyant aileleri DB'de; CRM admin uçları, bootstrap ve Item.variant doğrulaması."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import inspect, text

from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog
from app.modules.fair_stand.infrastructure.variant_family_seed import VARIANT_FAMILY_ROWS

URL = "/api/v1/fair-stand/admin/variant-families"
ITEM_URL = "/api/v1/fair-stand/admin/item-records"

# Kodda 0095'ten önce duran 13 aile + profil ve dikme.
EXPECTED_KEYS = {
    "wall-panel", "wall-short-1", "wall-short-2", "wall-separator", "wall-separator-sarmasik",
    "desk-banko", "desk-banko-l", "base", "wall-showcase", "shelf-row", "tv", "video-wall",
    "long-planter", "profile", "upright",
}


def _migration():
    path = Path(__file__).resolve().parents[3] / "alembic/versions/0095_variant_families.py"
    spec = spec_from_file_location("variant_families_migration", path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _variants(connection, item_type):
    return {
        row[0]
        for row in connection.execute(
            text("SELECT variant FROM fair_stand_items WHERE item_type = :t"), {"t": item_type}
        )
    }


def test_seed_rows_cover_every_family_and_profile_upright_items(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    assert {row["family_key"] for row in VARIANT_FAMILY_ROWS} == EXPECTED_KEYS
    keys = {row[0] for row in connection.execute(text("SELECT family_key FROM fair_stand_variant_families"))}
    assert keys == EXPECTED_KEYS
    assert _variants(connection, "profile") == {"profile"}
    assert _variants(connection, "upright") == {"upright"}
    unknown = connection.execute(
        text(
            "SELECT count(*) FROM fair_stand_items i WHERE i.variant IS NOT NULL AND NOT EXISTS ("
            "SELECT 1 FROM fair_stand_variant_families f WHERE f.family_key = i.variant)"
        )
    ).scalar()
    assert unknown == 0


def test_downgrade_then_upgrade_restores_families_and_profile_variants(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    migration = _migration()
    with Operations.context(MigrationContext.configure(connection)):
        migration.downgrade()
        assert "fair_stand_variant_families" not in inspect(connection).get_table_names()
        assert _variants(connection, "profile") == {None}
        assert _variants(connection, "upright") == {None}
        # Diğer ailelerin değeri olduğu gibi kalır.
        assert _variants(connection, "separator") >= {"wall-separator", "wall-separator-sarmasik"}
        migration.upgrade()
    assert _variants(connection, "profile") == {"profile"}
    assert _variants(connection, "upright") == {"upright"}
    sarmasik = connection.execute(
        text("SELECT option_family_key, option_label FROM fair_stand_variant_families WHERE family_key = 'wall-separator'")
    ).one()
    assert tuple(sarmasik) == ("wall-separator-sarmasik", "Sarmaşıklı")


def test_bootstrap_sends_active_families(client, db_session, auth_headers):
    seed_fair_stand_catalog(db_session)
    db_session.commit()
    payload = client.get("/api/v1/fair-stand/catalog/bootstrap", headers=auth_headers).json()
    families = {row["key"]: row for row in payload["variantFamilies"]}
    assert set(families) == EXPECTED_KEYS
    assert families["profile"] == {
        "key": "profile", "title": "Profil boyu", "tabLabel": "Boy", "cardLabel": "Profil",
        "labelRule": "profile_length", "optionFamilyKey": None, "optionLabel": None, "sortIndex": 140,
    }
    assert families["wall-separator"]["optionFamilyKey"] == "wall-separator-sarmasik"
    by_key = {item["itemKey"]: item for item in payload["items"]}
    assert by_key["profile_190"]["variant"] == "profile"
    assert by_key["upright_99"]["variant"] == "upright"


def test_admin_lists_members_and_card(client, db_session, auth_headers):
    seed_fair_stand_catalog(db_session)
    db_session.commit()
    rows = {row["key"]: row for row in client.get(URL, headers=auth_headers).json()}
    profile = rows["profile"]
    assert profile["isSystem"] is True and profile["isActive"] is True
    members = {member["itemKey"]: member for member in profile["members"]}
    assert "profile_190" in members
    assert [key for key, member in members.items() if member["catalogVisible"]] == ["profile_289"]
    assert rows["tv"]["isSystem"] is False


def test_create_update_archive_restore_family(client, db_session, auth_headers, audit_adapter):
    seed_fair_stand_catalog(db_session)
    db_session.commit()
    created = client.post(
        URL,
        headers=auth_headers,
        json={"family_key": "Masa-Seti", "title": "Masa ölçüsü", "tab_label": "Ölçü", "label_rule": "width_cm"},
    )
    assert created.status_code == 201, created.text
    assert created.json()["key"] == "masa-seti"
    assert created.json()["members"] == []

    duplicate = client.post(
        URL, headers=auth_headers,
        json={"family_key": "masa-seti", "title": "X", "tab_label": "Y", "label_rule": "width_cm"},
    )
    assert duplicate.status_code == 409

    updated = client.patch(f"{URL}/masa-seti", headers=auth_headers, json={"card_label": "Masa", "label_rule": "name_suffix"})
    assert updated.status_code == 200
    assert updated.json()["cardLabel"] == "Masa"
    assert updated.json()["labelRule"] == "name_suffix"

    # Item formu aileyi seçer; seçenek listesi tablodan gelir.
    options = client.get(ITEM_URL, headers=auth_headers).json()["filterOptions"]["variants"]
    assert "masa-seti" in options and "profile" in options
    saved = client.put(f"{ITEM_URL}/glass_table", headers=auth_headers, json={"variant": "masa-seti"})
    assert saved.status_code == 200, saved.text
    members = {row["key"]: row for row in client.get(URL, headers=auth_headers).json()}["masa-seti"]["members"]
    assert [member["itemKey"] for member in members] == ["glass_table"]

    archived = client.post(f"{URL}/masa-seti/archive", headers=auth_headers)
    assert archived.json()["isActive"] is False
    payload = client.get("/api/v1/fair-stand/catalog/bootstrap", headers=auth_headers).json()
    assert "masa-seti" not in {row["key"] for row in payload["variantFamilies"]}
    # Arşivdeki aileye yeni bağ kurulmaz; mevcut bağ korunur.
    assert client.put(f"{ITEM_URL}/glass_table", headers=auth_headers, json={"name": "Cam Masa"}).status_code == 200
    other = client.put(f"{ITEM_URL}/glass_shelf", headers=auth_headers, json={"variant": "masa-seti"})
    assert other.status_code == 400
    assert client.post(f"{URL}/masa-seti/restore", headers=auth_headers).json()["isActive"] is True

    actions = [event["action"] for event in audit_adapter.events]
    for action in ("created", "updated", "archived", "restored"):
        assert f"fair_stand.variant_family.{action}" in actions


def test_validation_rules(client, db_session, auth_headers):
    seed_fair_stand_catalog(db_session)
    db_session.commit()
    bad_key = client.post(URL, headers=auth_headers, json={"family_key": "a b", "title": "T", "tab_label": "S", "label_rule": "width_cm"})
    assert bad_key.status_code == 400
    bad_rule = client.post(URL, headers=auth_headers, json={"family_key": "x", "title": "T", "tab_label": "S", "label_rule": "renk"})
    assert bad_rule.status_code == 400
    # Eş aile etiketsiz olmaz; zaten başka aileye bağlı eş aile ikinci kez bağlanmaz.
    no_label = client.post(URL, headers=auth_headers, json={
        "family_key": "x", "title": "T", "tab_label": "S", "label_rule": "width_cm",
        "option_family_key": "wall-panel",
    })
    assert no_label.status_code == 400
    taken = client.post(URL, headers=auth_headers, json={
        "family_key": "x", "title": "T", "tab_label": "S", "label_rule": "width_cm",
        "option_family_key": "wall-separator-sarmasik", "option_label": "Sarmaşıklı",
    })
    assert taken.status_code == 400
    # Sistem ailesi: arşivlenmez, kuralı değişmez; metni değişir.
    assert client.post(f"{URL}/profile/archive", headers=auth_headers).status_code == 409
    assert client.patch(f"{URL}/upright", headers=auth_headers, json={"label_rule": "width_cm"}).status_code == 400
    renamed = client.patch(f"{URL}/upright", headers=auth_headers, json={"title": "Dikme boyu"})
    assert renamed.json()["title"] == "Dikme boyu"
    # Eş ailesi bağlı aile, bağ kalkmadan arşivlenmez.
    assert client.post(f"{URL}/wall-separator-sarmasik/archive", headers=auth_headers).status_code == 409
    # Bilinmeyen aile Item'a yazılmaz.
    unknown = client.put(f"{ITEM_URL}/glass_table", headers=auth_headers, json={"variant": "yok-boyle"})
    assert unknown.status_code == 400


def test_frontend_fixture_mirrors_seed_rows():
    # Fair Stand birim/E2E katalog fixture'ı backend tohumuyla aynı aileleri taşır.
    import json

    fixture = Path(__file__).resolve().parents[4] / "test/fixtures/itemCatalogSeed.json"
    seed = json.loads(fixture.read_text(encoding="utf-8"))
    assert seed["variant_families"] == [dict(row) for row in VARIANT_FAMILY_ROWS]
    for item in seed["items"]:
        if item["item_type"] in ("profile", "upright"):
            assert item["variant"] == item["item_type"], item["item_key"]


class _DenyItems:
    """Item admin izinleri reddedilir; varyant aile uçları aynı izinleri kullanır (SEC-01)."""

    def __init__(self, denied: set[str]) -> None:
        self._denied = denied

    def check_permission(self, *, organization_id, user_id, permission_code, access_token) -> bool:
        _ = (organization_id, user_id, access_token)
        return permission_code not in self._denied


def test_variant_family_routes_require_item_permissions(client, db_session, auth_headers):
    from app.modules.fair_stand.api.dependencies import (
        PERMISSION_ITEMS_ARCHIVE,
        PERMISSION_ITEMS_CREATE,
        PERMISSION_ITEMS_READ,
        PERMISSION_ITEMS_UPDATE,
        get_authorization_adapter,
    )

    seed_fair_stand_catalog(db_session)
    db_session.commit()
    body = {"family_key": "x", "title": "T", "tab_label": "S", "label_rule": "width_cm"}
    client.app.dependency_overrides[get_authorization_adapter] = lambda: _DenyItems(
        {PERMISSION_ITEMS_READ, PERMISSION_ITEMS_CREATE, PERMISSION_ITEMS_UPDATE, PERMISSION_ITEMS_ARCHIVE}
    )
    assert client.get(URL, headers=auth_headers).status_code == 403
    assert client.post(URL, headers=auth_headers, json=body).status_code == 403
    assert client.patch(f"{URL}/tv", headers=auth_headers, json={"title": "X"}).status_code == 403
    assert client.post(f"{URL}/tv/archive", headers=auth_headers).status_code == 403
    assert client.post(f"{URL}/tv/restore", headers=auth_headers).status_code == 403
    # Yalnız okuma izni yazmaya yetmez.
    client.app.dependency_overrides[get_authorization_adapter] = lambda: _DenyItems(
        {PERMISSION_ITEMS_CREATE, PERMISSION_ITEMS_UPDATE, PERMISSION_ITEMS_ARCHIVE}
    )
    assert client.get(URL, headers=auth_headers).status_code == 200
    assert client.post(URL, headers=auth_headers, json=body).status_code == 403
    assert client.patch(f"{URL}/tv", headers=auth_headers, json={"title": "X"}).status_code == 403
    # Tanımsız alan reddedilir (extra=forbid).
    client.app.dependency_overrides[get_authorization_adapter] = lambda: _DenyItems(set())
    assert client.post(URL, headers=auth_headers, json={**body, "is_system": True}).status_code == 422


def test_family_members_are_set_in_bulk_from_the_family_screen(client, db_session, auth_headers, audit_adapter):
    # Üyeler aile ekranından toplu seçilir: listedekiler aileye geçer, çıkanlar ailesiz olur.
    seed_fair_stand_catalog(db_session)
    db_session.commit()
    candidates = client.get(f"{URL}/member-candidates", headers=auth_headers)
    assert candidates.status_code == 200
    by_key = {row["itemKey"]: row for row in candidates.json()}
    assert by_key["profile_190"]["variant"] == "profile"
    assert by_key["profile_190"]["type"] == "profile"
    assert by_key["glass_table"]["variant"] is None

    current = {row["key"]: row for row in client.get(URL, headers=auth_headers).json()}["profile"]["members"]
    keep = [member["itemKey"] for member in current if member["itemKey"] != "profile_388"]
    saved = client.put(f"{URL}/profile/members", headers=auth_headers, json={"item_keys": keep + ["glass_table"]})
    assert saved.status_code == 200, saved.text
    keys = {member["itemKey"] for member in saved.json()["members"]}
    assert "glass_table" in keys and "profile_388" not in keys
    after = {row["itemKey"]: row for row in client.get(f"{URL}/member-candidates", headers=auth_headers).json()}
    assert after["profile_388"]["variant"] is None
    assert after["glass_table"]["variant"] == "profile"

    # Başka ailedeki Item bu aileye taşınır.
    moved = client.put(f"{URL}/tv/members", headers=auth_headers, json={"item_keys": ["glass_table"]})
    assert moved.status_code == 200
    after = {row["itemKey"]: row for row in client.get(f"{URL}/member-candidates", headers=auth_headers).json()}
    assert after["glass_table"]["variant"] == "tv"
    assert after["tv_42"]["variant"] is None

    unknown = client.put(f"{URL}/profile/members", headers=auth_headers, json={"item_keys": ["yok_boyle"]})
    assert unknown.status_code == 400
    assert "fair_stand.variant_family.members_updated" in [event["action"] for event in audit_adapter.events]


def test_member_routes_require_item_permissions(client, db_session, auth_headers):
    from app.modules.fair_stand.api.dependencies import PERMISSION_ITEMS_READ, PERMISSION_ITEMS_UPDATE, get_authorization_adapter

    seed_fair_stand_catalog(db_session)
    db_session.commit()
    client.app.dependency_overrides[get_authorization_adapter] = lambda: _DenyItems({PERMISSION_ITEMS_UPDATE})
    assert client.get(f"{URL}/member-candidates", headers=auth_headers).status_code == 200
    assert client.put(f"{URL}/profile/members", headers=auth_headers, json={"item_keys": []}).status_code == 403
    client.app.dependency_overrides[get_authorization_adapter] = lambda: _DenyItems({PERMISSION_ITEMS_READ})
    assert client.get(f"{URL}/member-candidates", headers=auth_headers).status_code == 403
