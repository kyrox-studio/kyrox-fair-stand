from app.modules.fair_stand.infrastructure.seed_catalog import seed_fair_stand_catalog


def test_bootstrap_requires_auth(client):
    response = client.get("/api/v1/fair-stand/catalog/bootstrap")
    assert response.status_code in {401, 422}


def test_bootstrap_returns_canonical_aggregates(client, db_session, auth_headers):
    seed_fair_stand_catalog(db_session)
    db_session.flush()

    response = client.get("/api/v1/fair-stand/catalog/bootstrap", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["revision"]
    units = {row["unitKey"]: row["name"] for row in body["units"]}
    assert units["adet"] == "Adet"
    assert units["metre_kare"] == "Metre Kare"
    shelf_unit = next(item for item in body["items"] if item["itemKey"] == "shelf_100")
    assert "unitName" not in shelf_unit
    assert len(body["categories"]) == 6
    assert len(body["items"]) == 136  # 0081: profile_346_5; 0079: profile_8; 0078: profil 239,5 + 289 + 388 + 487; 0075: bar masası; 0068: 5 yükseklik dikmesi; 0072: 3 raf tahtası + 3 kart + 6 sıralı raf; 0074: vitrin + broşürlük
    visible = [item for item in body["items"] if item["catalogVisible"] is True]
    hidden = [item for item in body["items"] if item["catalogVisible"] is not True]
    assert len(visible) == 43  # 0084: Işıklı Strafor kartı; 0083: 6 banko/baza ölçüsü gizlendi, Banko/Köşe Banko/Baza için birer kart; 0082: 3 panel + 3 separatör gizlendi, Panel/Separatör için birer kart; 0079: 6 kısa panel gizlendi, Tek/Çift Sıra için birer kart; 0078: 4 profil gizlendi, profile_289 kartı
    assert len(hidden) == 93  # 0084: Işıklı Strafor görünür; 0083: 6 banko/baza ölçüsü gizli; 0082: 3 panel + 3 separatör gizli; 0081: profile_346_5 gizli; 0080: profile_8 gizli; 0079: 6 kısa panel genişliği gizli; 0078: 4 profil gizlendi + 239,5 / 388 / 487; 0068: 5 gizli dikme; 0072: 3 tekli raf gizlenir, 3 tahta + 6 sıralı raf gizli
    shelf = next(item for item in body["items"] if item["itemKey"] == "shelf_100")
    assert shelf["categoryId"] == 3
    assert "catalogCategory" not in shelf
    assert all("catalogKey" not in category for category in body["categories"])
    assert all(isinstance(category["id"], int) for category in body["categories"])
    assert shelf["previewId"] == 20
    # 0072: tekli raf katalogdan çıkar, kartın varyantıdır; reçetesi tahta + ayak.
    assert shelf["catalogVisible"] is False
    assert shelf["composition"] == {
        "mode": "recipe",
        "items": [{"itemKey": "shelf_100_self", "quantity": 1}, {"itemKey": "shelf_leg", "quantity": 2}],
    }
    cards = {item["itemKey"]: item for item in body["items"] if item["itemKey"].startswith("shelf_row_") and item.get("widthVariants")}
    assert {key: (card["name"], card["catalogVisible"], card["widthVariants"]) for key, card in cards.items()} == {
        "shelf_row_1": ("Tekli raf", True, ["shelf_100", "shelf_150", "shelf_200"]),
        "shelf_row_2": ("2 sıralı raf", True, ["shelf_row_2_100", "shelf_row_2_150", "shelf_row_2_200"]),
        "shelf_row_3": ("3 sıralı raf", True, ["shelf_row_3_100", "shelf_row_3_150", "shelf_row_3_200"]),
    }
    two_row_150 = next(item for item in body["items"] if item["itemKey"] == "shelf_row_2_150")
    assert two_row_150["catalogVisible"] is False
    assert two_row_150["composition"] == {"mode": "recipe", "items": [{"itemKey": "shelf_150", "quantity": 2}]}
    assert two_row_150["dimensions"]["widthCm"] == 150
    assert two_row_150["sceneDimensions"]["heightCm"] == 51.8
    assert "catalogPreview" not in shelf
    chair = next(item for item in body["items"] if item["itemKey"] == "chair_eames")
    assert chair["modelFile"] == "eames_chair.glb"
    plant = next(item for item in body["items"] if item["itemKey"] == "extra_indoor_plant_1")
    assert plant["modelFile"] == "indoor_plants.glb"
    metal = next(item for item in body["items"] if item["itemKey"] == "metal_separator")
    assert metal["catalogVisible"] is False
    assert metal["unit"] == "metre_kare"
    assert metal["isCostEnabled"] is True
    tulle = next(item for item in body["items"] if item["itemKey"] == "tulle_fabric")
    assert tulle["name"] == "Tül"
    assert tulle["type"] == "tulle-fabric"
    assert tulle["catalogVisible"] is True
    assert tulle["unit"] == "metre_kare"
    assert tulle["isCostEnabled"] is True
    assert tulle["isRender"] is True
    assert float(tulle["defaultZCm"]) == 350
    assert float(tulle["dimensions"]["depthCm"]) == 0.4
    behavior = next(row for row in body["itemTypes"] if row["key"] == "tulle-fabric")
    assert behavior["placement"] == "free"
    assert behavior["collision"] == "none"
    assert behavior["moveSnapCm"] == 10
    sofa = next(item for item in body["items"] if item["itemKey"] == "furniture_sofa_single_classic")
    assert sofa["modelFile"] == "bej_koltuk_1_ciftli_2_tekli.glb"
    tv = next(item for item in body["items"] if item["type"] == "tv")
    door = next(item for item in body["items"] if item["itemKey"] == "wall_door_100_350")
    assert door["composition"]["mode"] == "recipe"
    assert len(door["composition"]["items"]) == 6
    assert "options" not in door["composition"]
    kit = next(item for item in body["items"] if item["itemKey"] == "furniture_sofa_set_classic")
    assert "mode" not in kit["composition"]
    assert len(kit["composition"]["items"]) == 3
    vw = next(item for item in body["items"] if item["itemKey"] == "video_wall_2x2")
    assert vw["videoWall"]["panelItemKey"] == "video_wall_panel"
    showcase = next(item for item in body["items"] if item["itemKey"] == "wall_showcase_100_2_350")
    assert showcase["bodyItems"]["glassShelfItemKey"] == "glass_shelf"
    wall_200 = next(item for item in body["items"] if item["itemKey"] == "wall_200_350")
    assert wall_200["rotationStepDeg"] == 90
    assert wall_200["defaultRotationDeg"] == 0
    assert wall_200["sideInsertRotation"] == "inherit"
    assert wall_200["isRender"] is True
    assert wall_200["acceptsColor"] is True
    assert wall_200["acceptsImage"] is True
    assert wall_200["acceptsGlass"] is True
    assert wall_200["acceptsLightbox"] is True
    assert wall_200["acceptsMesh"] is True
    assert wall_200["defaultZCm"] == 0
    banko = next(item for item in body["items"] if item["itemKey"] == "desk_banko_150")
    assert banko["rotationStepDeg"] == 45
    stool = next(item for item in body["items"] if item["itemKey"] == "furniture_bar_stool_classic")
    assert stool["defaultRotationDeg"] == 270
    assert stool["sideInsertRotation"] == "default"
    l_banko = next(item for item in body["items"] if item["itemKey"] == "desk_banko_100_l")
    assert l_banko["defaultRotationDeg"] == 270
    assert l_banko["rotationStepDeg"] == 90
    assert "innerCorner" not in wall_200.get("composition", {})
    assert "nominalModuleWidthCm" not in wall_200
    corner = next(item for item in body["items"] if item["itemKey"] == "panel_corner_192")
    assert corner["type"] == "panel"
    assert "nominalModuleWidthCm" not in corner
    assert all("nominalModuleWidthCm" not in item for item in body["items"])
    assert all("innerCorner" not in item.get("composition", {}) for item in body["items"])
    assert "FairStandItemModel" not in body
    assert "SQLAlchemy" not in body
    assert len(body["previewKinds"]) == 30
    assert body["standDimensions"] == {
        "heightCm": 350.0,
        "depthCm": 10.0,
        "frameWidthCm": 5.5,
        "frameDepthCm": 10.0,
        "panelRailHeightCm": 0.4,
    }
    assert body["settings"] == {
        "maxImageUploadMb": 5,
        "exportButtonVisible": True,
        "importButtonVisible": True,
        "saveAsButtonVisible": True,
    }
    shelf_preview = next(kind for kind in body["previewKinds"] if kind["id"] == 20)
    assert "previewKey" not in shelf_preview
    assert all("previewKey" not in kind for kind in body["previewKinds"])
    assert all(isinstance(kind["id"], int) for kind in body["previewKinds"])
    assert "module-drag-shelf" in shelf_preview["markup"]
    assert shelf_preview["cssCode"]


def test_hidden_item_is_not_catalog_visible(client, db_session, auth_headers):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    response = client.get("/api/v1/fair-stand/catalog/bootstrap", headers=auth_headers)
    panel = next(item for item in response.json()["items"] if item["itemKey"] == "panel_48_5")
    assert panel["catalogVisible"] is False
    assert panel.get("previewId") is None
    assert "rotationStepDeg" not in panel
    assert "defaultRotationDeg" not in panel
    assert "sideInsertRotation" not in panel
    assert panel["isRender"] is True
    assert panel["acceptsColor"] is True
    assert panel["acceptsImage"] is True
    assert panel["acceptsGlass"] is True
    assert panel["acceptsLightbox"] is True
    assert panel["acceptsMesh"] is True
    assert "catalogPreview" not in panel


def test_unknown_item_is_404(client, db_session, auth_headers):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    response = client.get("/api/v1/fair-stand/items/not-a-real-item", headers=auth_headers)
    assert response.status_code == 404


def test_exact_item_lookup(client, db_session, auth_headers):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    response = client.get("/api/v1/fair-stand/items/shelf_100", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["itemKey"] == "shelf_100"
    assert response.json()["type"] == "shelf"


def test_corner_panel_item_lookup(client, db_session, auth_headers):
    seed_fair_stand_catalog(db_session)
    db_session.flush()
    response = client.get("/api/v1/fair-stand/items/panel_corner_192", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["itemKey"] == "panel_corner_192"
    assert body["type"] == "panel"
    assert "panelRole" not in body
    assert "nominalModuleWidthCm" not in body
    assert "innerCorner" not in body.get("composition", {})
