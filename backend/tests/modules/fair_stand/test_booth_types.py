"""0091: stand tipleri, Item eşlemesi, bootstrap ve admin alanı."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import inspect, select

from app.integrations.kyrox_core.ports import AuthorizationPort
from app.modules.fair_stand.api.dependencies import PERMISSION_CATALOG_READ, get_authorization_adapter
from app.modules.fair_stand.infrastructure.models import (
    FairStandCategoryModel,
    FairStandItemBoothTypeModel,
    FairStandItemModel,
)
from app.modules.fair_stand.infrastructure.booth_type_seed import HIDDEN_MAXIMA_ITEM_KEYS
from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog


def _migration(name="0091_booth_types"):
    path = Path(__file__).resolve().parents[3] / f"alembic/versions/{name}.py"
    spec = spec_from_file_location(f"migration_{name}", path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _links(session):
    return set(session.scalars(select(FairStandItemBoothTypeModel.item_key)).all())


def _visible_by_category(session):
    rows = session.execute(
        select(FairStandItemModel.item_key, FairStandCategoryModel.catalog_name)
        .join(FairStandCategoryModel, FairStandItemModel.category_id == FairStandCategoryModel.id)
        .where(FairStandItemModel.catalog_visible.is_(True))
    ).all()
    return {key: name for key, name in rows}


def _hidden_maxima_keys(session):
    return set(session.scalars(
        select(FairStandItemModel.item_key).where(FairStandItemModel.item_key.in_(HIDDEN_MAXIMA_ITEM_KEYS))
    ).all())


def test_seed_tags_visible_and_listed_hidden_items_and_leaves_extra_electronics_null(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    visible = _visible_by_category(db_session)
    hidden_maxima = _hidden_maxima_keys(db_session)
    assert "wall_150_350" in hidden_maxima and "upright_297" in hidden_maxima
    expected = {key for key, name in visible.items() if name not in ("Extra", "Elektronik & Aydınlatma")}
    expected |= hidden_maxima
    assert expected
    assert any(name == "Extra" for name in visible.values())
    assert any(name == "Elektronik & Aydınlatma" for name in visible.values())
    assert _links(db_session) == expected


def test_downgrade_then_upgrade_matches_seed(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    seeded = _links(db_session)
    connection = db_session.connection()
    migration = _migration()
    with Operations.context(MigrationContext.configure(connection)):
        migration.downgrade()
        assert "fair_stand_item_booth_types" not in inspect(connection).get_table_names()
        migration.upgrade()
        _migration("0093_hidden_items_maxima").upgrade()
    db_session.expire_all()
    assert _links(db_session) == seeded


def test_bootstrap_lists_booth_types_and_item_keys(client, db_session, auth_headers):
    seed_fair_stand_catalog(db_session)
    db_session.commit()
    payload = client.get("/api/v1/fair-stand/catalog/bootstrap", headers=auth_headers).json()
    assert payload["boothTypes"] == [
        {"key": "maxima", "name": "Maksima Stand", "active": True},
        {"key": "custom", "name": "Özel Tasarım", "active": False},
        {"key": "package", "name": "Paket Stand", "active": False},
    ]
    by_key = {item["itemKey"]: item for item in payload["items"]}
    assert by_key["led_floodlight"]["boothTypeKeys"] is None
    # Katalogda görünmeyen profil boyu 0093 ile Maksima; listede olmayan zemin null kalır.
    assert by_key["profile_190"]["boothTypeKeys"] == ["maxima"]
    assert by_key["hali"]["boothTypeKeys"] is None
    assert any(item["boothTypeKeys"] == ["maxima"] for item in payload["items"])


def test_admin_item_multi_select_null_and_unknown(client, db_session, auth_headers):
    seed_fair_stand_catalog(db_session)
    db_session.commit()
    url = "/api/v1/fair-stand/admin/item-records/led_floodlight"
    assert client.get(url, headers=auth_headers).json()["boothTypeKeys"] is None

    saved = client.put(url, headers=auth_headers, json={"booth_type_keys": ["package", "maxima"]})
    assert saved.status_code == 200
    assert saved.json()["boothTypeKeys"] == ["maxima", "package"]

    cloned = client.post(f"{url}/clone", headers=auth_headers, json={"item_key": "led_floodlight_kopya", "name": "Kopya"})
    assert cloned.status_code == 201
    assert cloned.json()["boothTypeKeys"] == ["maxima", "package"]

    other_field = client.put(url, headers=auth_headers, json={"name": "Projektör"})
    assert other_field.json()["boothTypeKeys"] == ["maxima", "package"]

    assert client.put(url, headers=auth_headers, json={"booth_type_keys": ["ahsap"]}).status_code == 422

    cleared = client.put(url, headers=auth_headers, json={"booth_type_keys": []})
    assert cleared.json()["boothTypeKeys"] is None
    types = client.get("/api/v1/fair-stand/admin/booth-types", headers=auth_headers)
    assert [row["key"] for row in types.json()] == ["maxima", "custom", "package"]


def test_admin_booth_types_requires_catalog_read(client, db_session, auth_headers):
    class DenyCatalogRead(AuthorizationPort):
        def check_permission(self, *, organization_id, user_id, permission_code, access_token) -> bool:
            _ = (organization_id, user_id, access_token)
            return permission_code != PERMISSION_CATALOG_READ

    seed_fair_stand_catalog(db_session)
    db_session.commit()
    overrides = client.app.dependency_overrides
    previous = overrides.get(get_authorization_adapter)
    overrides[get_authorization_adapter] = lambda: DenyCatalogRead()
    try:
        response = client.get("/api/v1/fair-stand/admin/booth-types", headers=auth_headers)
    finally:
        if previous is None:
            overrides.pop(get_authorization_adapter, None)
        else:
            overrides[get_authorization_adapter] = previous
    assert response.status_code == 403

def test_0093_adds_missing_maxima_keeps_existing_and_downgrades_only_its_rows(db_session):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    connection = db_session.connection()
    migration = _migration("0093_hidden_items_maxima")
    with Operations.context(MigrationContext.configure(connection)):
        migration.downgrade()
    db_session.expire_all()
    assert "wall_150_350" not in _links(db_session)
    # Admin'den önce verilmiş başka tip korunur; 0093 o Item'a ikinci satır eklemez.
    db_session.add(FairStandItemBoothTypeModel(item_key="wall_150_350", booth_type_key="package"))
    db_session.flush()
    with Operations.context(MigrationContext.configure(connection)):
        migration.upgrade()
        migration.upgrade()
    db_session.expire_all()
    rows = set(db_session.execute(select(FairStandItemBoothTypeModel.item_key, FairStandItemBoothTypeModel.booth_type_key)).all())
    assert ("wall_150_350", "package") in rows
    assert ("wall_150_350", "maxima") not in rows
    assert ("upright_297", "maxima") in rows
    assert ("hali", "maxima") not in rows
    with Operations.context(MigrationContext.configure(connection)):
        migration.downgrade()
    db_session.expire_all()
    rows = set(db_session.execute(select(FairStandItemBoothTypeModel.item_key, FairStandItemBoothTypeModel.booth_type_key)).all())
    assert ("wall_150_350", "package") in rows
    assert ("upright_297", "maxima") not in rows
    assert ("wall_100_350", "maxima") in rows
