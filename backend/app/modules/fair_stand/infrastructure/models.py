from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import false as sa_false
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Table,
    Text as sa_text,
    UniqueConstraint,
    Uuid,
    false as sa_false,
    text,
    true as sa_true,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

# JSONB on Postgres; plain JSON for SQLite unit tests.
PayloadJSON = JSON().with_variant(JSONB(astext_type=sa_text()), "postgresql")

from app.db.base import Base

CASCADE = {"ondelete": "CASCADE", "onupdate": "CASCADE"}
# Live DB SoT (0038): assembly child pose — leaf silinmesin diye RESTRICT.
RESTRICT_UPDATE = {"ondelete": "RESTRICT", "onupdate": "CASCADE"}
# Live DB: snap rule FKs SET NULL; onupdate NO ACTION (explicit CASCADE yok).
SET_NULL_NO_ACTION = {"ondelete": "SET NULL", "onupdate": "NO ACTION"}

fair_stand_rule_item_type = Table(
    "fair_stand_rule_item_type",
    Base.metadata,
    Column("rule_id", Integer, ForeignKey("fair_stand_rule.id", ondelete="CASCADE", onupdate="CASCADE"), primary_key=True),
    Column(
        "item_type_id",
        Integer,
        ForeignKey("fair_stand_item_type.id", ondelete="CASCADE", onupdate="CASCADE"),
        primary_key=True,
    ),
    Index("ix_fair_stand_rule_item_type_item_type_id", "item_type_id"),
)

# Tip A, tip B ile çarpışmada üst üste binebilir (M:N, FK).
fair_stand_item_type_overlap = Table(
    "fair_stand_item_type_overlap",
    Base.metadata,
    Column(
        "item_type_id",
        Integer,
        ForeignKey("fair_stand_item_type.id", ondelete="CASCADE", onupdate="CASCADE"),
        primary_key=True,
    ),
    Column(
        "overlap_item_type_id",
        Integer,
        ForeignKey("fair_stand_item_type.id", ondelete="CASCADE", onupdate="CASCADE"),
        primary_key=True,
    ),
    CheckConstraint(
        "item_type_id <> overlap_item_type_id",
        name="ck_fair_stand_item_type_overlap_not_self",
    ),
    Index("ix_fair_stand_item_type_overlap_target", "overlap_item_type_id"),
)


class FairStandCategoryModel(Base):
    __tablename__ = "fair_stand_categories"
    __table_args__ = (
        UniqueConstraint("catalog_index", name="uq_fair_stand_categories_catalog_index"),
        CheckConstraint("catalog_index > 0", name="ck_fair_stand_categories_catalog_index"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    catalog_name: Mapped[str] = mapped_column(String(128), nullable=False)
    catalog_index: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    items: Mapped[list["FairStandItemModel"]] = relationship(back_populates="category")


class FairStandCatalogPreviewKindModel(Base):
    __tablename__ = "fair_stand_catalog_preview_kinds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    markup: Mapped[str] = mapped_column(sa_text(), nullable=False)
    css_code: Mapped[str] = mapped_column(sa_text(), nullable=False)
    sort_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FairStandUnitModel(Base):
    """Global ölçü birimi kataloğu. Item.unit bu tablonun unit_key değerine gider."""

    __tablename__ = "fair_stand_units"
    __table_args__ = (UniqueConstraint("unit_key", name="uq_fair_stand_units_unit_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    unit_key: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=sa_true())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FairStandItemTypeModel(Base):
    """Item type classification. Scene behavior is an optional 1:1 child row."""

    __tablename__ = "fair_stand_item_type"
    __table_args__ = (UniqueConstraint("key", name="uq_fair_stand_item_type_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(64), nullable=False)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    items: Mapped[list["FairStandItemModel"]] = relationship(back_populates="item_type_row")
    rules: Mapped[list["FairStandRuleModel"]] = relationship(
        secondary=fair_stand_rule_item_type,
        back_populates="item_types",
    )
    overlap_types: Mapped[list["FairStandItemTypeModel"]] = relationship(
        "FairStandItemTypeModel",
        secondary=fair_stand_item_type_overlap,
        primaryjoin="FairStandItemTypeModel.id == fair_stand_item_type_overlap.c.item_type_id",
        secondaryjoin="FairStandItemTypeModel.id == fair_stand_item_type_overlap.c.overlap_item_type_id",
        lazy="selectin",
    )
    scene_behavior: Mapped["FairStandItemTypeSceneBehaviorModel | None"] = relationship(
        back_populates="item_type",
        cascade="all, delete-orphan",
        uselist=False,
        lazy="selectin",
    )


class FairStandItemTypeSceneBehaviorModel(Base):
    """Optional scene behavior. Row absence means the type is non-scene."""

    __tablename__ = "fair_stand_item_type_scene_behavior"
    __table_args__ = (
        CheckConstraint(
            "placement IN ('wall', 'free', 'wall-overlay', 'top')",
            name="ck_fair_stand_item_type_scene_behavior_placement",
        ),
        CheckConstraint(
            "collision IN ('segment', 'footprint', 'none')",
            name="ck_fair_stand_item_type_scene_behavior_collision",
        ),
        CheckConstraint(
            "move_snap_cm > 0",
            name="ck_fair_stand_item_type_scene_behavior_move_snap_cm",
        ),
        CheckConstraint(
            "magnetic_snap IN ('standard', 'none', 'short-up-joint')",
            name="ck_fair_stand_item_type_scene_behavior_magnetic_snap",
        ),
        CheckConstraint(
            "wall_capacity IN ('include', 'exclude')",
            name="ck_fair_stand_item_type_scene_behavior_wall_capacity",
        ),
        CheckConstraint(
            "connection_endpoint IN ('segment', 'logical-fixture')",
            name="ck_fair_stand_item_type_scene_behavior_connection_endpoint",
        ),
        CheckConstraint(
            "collision_depth IN ('physical', 'wall-backbone')",
            name="ck_fair_stand_item_type_scene_behavior_collision_depth",
        ),
        CheckConstraint(
            "endpoint_contact IN ('standard', 'thin-wall-endpoint')",
            name="ck_fair_stand_item_type_scene_behavior_endpoint_contact",
        ),
        CheckConstraint(
            "boundary_snap IN ('stand-edge', 'wall-inner-face')",
            name="ck_fair_stand_item_type_scene_behavior_boundary_snap",
        ),
        CheckConstraint(
            "collision_height IN ('full')",
            name="ck_fair_stand_item_type_scene_behavior_collision_height",
        ),
        CheckConstraint(
            "ghost_opacity >= 0 AND ghost_opacity <= 1",
            name="ck_fair_stand_item_type_scene_behavior_ghost_opacity",
        ),
    )

    item_type_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "fair_stand_item_type.id",
            name="fk_fair_stand_item_type_scene_behavior_item_type_id",
            **CASCADE,
        ),
        primary_key=True,
    )
    placement: Mapped[str] = mapped_column(String(32), nullable=False)
    collision: Mapped[str] = mapped_column(String(32), nullable=False)
    move_snap_cm: Mapped[int] = mapped_column(Integer, nullable=False)
    magnetic_snap: Mapped[str] = mapped_column(String(32), nullable=False)
    allow_side_insert: Mapped[bool] = mapped_column(Boolean, nullable=False)
    supports_wall_overlay_mount: Mapped[bool] = mapped_column(Boolean, nullable=False)
    wall_capacity: Mapped[str] = mapped_column(String(16), nullable=False)
    connection_endpoint: Mapped[str] = mapped_column(String(32), nullable=False)
    collision_depth: Mapped[str] = mapped_column(String(32), nullable=False)
    endpoint_contact: Mapped[str] = mapped_column(String(32), nullable=False)
    boundary_snap: Mapped[str] = mapped_column(String(32), nullable=False)
    collision_height: Mapped[str] = mapped_column(String(16), nullable=False)
    ghost_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    ghost_renderer: Mapped[str] = mapped_column(String(64), nullable=False)
    ghost_opacity: Mapped[Decimal] = mapped_column(Numeric(4, 3), nullable=False)
    item_type: Mapped[FairStandItemTypeModel] = relationship(back_populates="scene_behavior")


class FairStandRuleTypeModel(Base):
    __tablename__ = "fair_stand_rule_type"
    __table_args__ = (UniqueConstraint("key", name="uq_fair_stand_rule_type_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(64), nullable=False)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    rules: Mapped[list["FairStandRuleModel"]] = relationship(back_populates="rule_type")


class FairStandRuleModel(Base):
    __tablename__ = "fair_stand_rule"
    __table_args__ = (
        UniqueConstraint("rule_type_id", "key", name="uq_fair_stand_rule_type_id_key"),
        CheckConstraint(
            "face IS NULL OR face IN ('front', 'back', 'top', 'bottom', 'left', 'right')",
            name="ck_fair_stand_rule_face",
        ),
        CheckConstraint(
            "edge IS NULL OR edge IN ('top', 'bottom', 'left', 'right')",
            name="ck_fair_stand_rule_edge",
        ),
        CheckConstraint(
            "(face IS NULL) = (edge IS NULL)",
            name="ck_fair_stand_rule_face_edge_pair",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rule_type_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("fair_stand_rule_type.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )
    key: Mapped[str] = mapped_column(String(64), nullable=False)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    face: Mapped[str | None] = mapped_column(String(16), nullable=True)
    edge: Mapped[str | None] = mapped_column(String(16), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    rule_type: Mapped[FairStandRuleTypeModel] = relationship(back_populates="rules")
    item_types: Mapped[list[FairStandItemTypeModel]] = relationship(
        secondary=fair_stand_rule_item_type,
        back_populates="rules",
    )


class FairStandItemModel(Base):
    __tablename__ = "fair_stand_items"
    __table_args__ = (
        CheckConstraint(
            "eye_count IS NULL OR eye_count IN (2, 3)",
            name="ck_fair_stand_items_eye_count",
        ),
        CheckConstraint(
            "composition_mode IS NULL OR composition_mode IN ('recipe')",
            name="ck_fair_stand_items_composition_mode",
        ),
        CheckConstraint(
            "NOT catalog_visible OR (category_id IS NOT NULL AND catalog_item_index IS NOT NULL AND preview_id IS NOT NULL)",
            name="ck_fair_stand_items_catalog_visible",
        ),
        CheckConstraint(
            "side_insert_rotation IS NULL OR side_insert_rotation IN ('inherit', 'default')",
            name="ck_fair_stand_items_side_insert_rotation",
        ),
        CheckConstraint(
            "(rotation_step_deg IS NULL) = (default_rotation_deg IS NULL) "
            "AND (rotation_step_deg IS NULL) = (side_insert_rotation IS NULL)",
            name="ck_fair_stand_items_rotation_trio",
        ),
        CheckConstraint(
            "is_render OR ("
            "NOT accepts_color AND NOT accepts_image AND NOT accepts_lightbox "
            "AND NOT accepts_glass AND NOT accepts_mesh)",
            name="ck_fair_stand_items_render_surface",
        ),
        CheckConstraint(
            "default_opacity >= 0 AND default_opacity <= 1",
            name="ck_fair_stand_items_default_opacity",
        ),
        CheckConstraint(
            "(snap_target_item_type IS NULL) = (snap_anchor IS NULL)",
            name="ck_fair_stand_items_snap_pair",
        ),
        CheckConstraint(
            "snap_anchor IS NULL OR snap_anchor IN ('top', 'bottom', 'left', 'right')",
            name="ck_fair_stand_items_snap_anchor",
        ),
        CheckConstraint(
            "snap_requires_rule_id IS NULL OR snap_provides_rule_id IS NULL",
            name="ck_fair_stand_items_snap_rule_xor",
        ),
        CheckConstraint(
            "z_reference IN ('floor', 'wall-top')",
            name="ck_fair_stand_items_z_reference",
        ),
        Index("ix_fair_stand_items_item_type", "item_type"),
        Index("ix_fair_stand_items_category_id", "category_id"),
        Index("ix_fair_stand_items_preview_id", "preview_id"),
        Index("ix_fair_stand_items_snap_requires_rule_id", "snap_requires_rule_id"),
        Index("ix_fair_stand_items_snap_provides_rule_id", "snap_provides_rule_id"),
        Index("ix_fair_stand_items_is_active", "is_active"),
        Index(
            "uq_fair_stand_items_catalog_order",
            "category_id",
            "catalog_item_index",
            unique=True,
            postgresql_where=text("catalog_visible IS TRUE"),
            sqlite_where=text("catalog_visible IS TRUE"),
        ),
    )

    item_key: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    item_type: Mapped[str] = mapped_column(
        String(64),
        ForeignKey(
            "fair_stand_item_type.key",
            name="fk_fair_stand_items_item_type_key",
            ondelete="RESTRICT",
            onupdate="CASCADE",
        ),
        nullable=False,
    )
    unit: Mapped[str | None] = mapped_column(
        String(64),
        ForeignKey(
            "fair_stand_units.unit_key",
            name="fk_fair_stand_items_unit_key",
            ondelete="RESTRICT",
            onupdate="CASCADE",
        ),
        nullable=True,
    )
    catalog_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    category_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("fair_stand_categories.id", **CASCADE),
        nullable=True,
    )
    catalog_item_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    preview_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("fair_stand_catalog_preview_kinds.id", **CASCADE),
        nullable=True,
    )
    material: Mapped[str | None] = mapped_column(String(64), nullable=True)
    default_color: Mapped[int | None] = mapped_column(Integer, nullable=True)
    default_opacity: Mapped[Decimal] = mapped_column(
        Numeric(4, 3),
        nullable=False,
        default=Decimal("1"),
        server_default="1",
    )
    preserve_model_scale: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    model_rotation_y_deg: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    visual_rotation_y_deg: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    rotation_step_deg: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    default_rotation_deg: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    side_insert_rotation: Mapped[str | None] = mapped_column(String(16), nullable=True)
    composition_mode: Mapped[str | None] = mapped_column(String(16), nullable=True)
    paintable: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    shape: Mapped[str | None] = mapped_column(String(16), nullable=True)
    variant: Mapped[str | None] = mapped_column(String(64), nullable=True)
    eye_count: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    default_z_cm: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False, default=Decimal("0"), server_default="0")
    # default_z_cm neye göre: zemin ya da katalog duvar tepesi (350); wall-top seçili duvar yüksekliği farkı kadar kayar.
    z_reference: Mapped[str] = mapped_column(String(16), nullable=False, default="floor", server_default="floor")
    # Sahnede ↑/↓ ile dikey taşınır; seçiliyken/taşırken zemin ve tavan uzaklığı gösterilir.
    vertical_move: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=sa_false())
    snap_target_item_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    snap_anchor: Mapped[str | None] = mapped_column(String(16), nullable=True)
    snap_requires_rule_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("fair_stand_rule.id", **SET_NULL_NO_ACTION),
        nullable=True,
    )
    snap_provides_rule_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("fair_stand_rule.id", **SET_NULL_NO_ACTION),
        nullable=True,
    )
    is_render: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=sa_false())
    accepts_color: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=sa_false())
    accepts_image: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=sa_false())
    accepts_lightbox: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=sa_false())
    accepts_glass: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=sa_false())
    accepts_mesh: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=sa_false())
    is_cost_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=sa_false())
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    category: Mapped[FairStandCategoryModel | None] = relationship(back_populates="items")
    item_type_row: Mapped[FairStandItemTypeModel] = relationship(
        back_populates="items",
        foreign_keys=[item_type],
    )
    snap_requires_rule: Mapped[FairStandRuleModel | None] = relationship(
        foreign_keys=[snap_requires_rule_id],
    )
    snap_provides_rule: Mapped[FairStandRuleModel | None] = relationship(
        foreign_keys=[snap_provides_rule_id],
    )
    dimensions: Mapped["FairStandItemDimensionsModel | None"] = relationship(
        back_populates="item", cascade="all, delete-orphan"
    )
    scene_dimensions: Mapped["FairStandItemSceneDimensionsModel | None"] = relationship(
        back_populates="item", cascade="all, delete-orphan"
    )
    strip_occupancy: Mapped["FairStandItemStripOccupancyModel | None"] = relationship(
        back_populates="item", cascade="all, delete-orphan"
    )
    assets: Mapped[list["FairStandItemAssetModel"]] = relationship(
        back_populates="item", cascade="all, delete-orphan"
    )
    components: Mapped[list["FairStandItemComponentModel"]] = relationship(
        back_populates="parent",
        foreign_keys="FairStandItemComponentModel.parent_item_key",
        cascade="all, delete-orphan",
    )
    video_wall: Mapped["FairStandItemVideoWallModel | None"] = relationship(
        back_populates="parent",
        cascade="all, delete-orphan",
        foreign_keys="FairStandItemVideoWallModel.parent_item_key",
    )
    body_parts: Mapped[list["FairStandItemBodyPartModel"]] = relationship(
        back_populates="parent",
        cascade="all, delete-orphan",
        foreign_keys="FairStandItemBodyPartModel.parent_item_key",
    )
    assembly_parts: Mapped[list["FairStandItemAssemblyPartModel"]] = relationship(
        back_populates="parent",
        cascade="all, delete-orphan",
        foreign_keys="FairStandItemAssemblyPartModel.parent_item_key",
    )
    width_variants: Mapped[list["FairStandItemWidthVariantModel"]] = relationship(
        back_populates="family",
        cascade="all, delete-orphan",
        foreign_keys="FairStandItemWidthVariantModel.family_item_key",
    )
    length_parts: Mapped[list["FairStandItemLengthPartModel"]] = relationship(
        back_populates="item",
        cascade="all, delete-orphan",
        foreign_keys="FairStandItemLengthPartModel.item_key",
        order_by="FairStandItemLengthPartModel.position",
    )


class FairStandItemDimensionsModel(Base):
    __tablename__ = "fair_stand_item_dimensions"
    __table_args__ = (
        CheckConstraint(
            "width_cm IS NOT NULL OR depth_cm IS NOT NULL OR height_cm IS NOT NULL "
            "OR mount_height_cm IS NOT NULL OR wall_gap_cm IS NOT NULL",
            name="ck_fair_stand_item_dimensions_present",
        ),
    )

    item_key: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("fair_stand_items.item_key", **CASCADE),
        primary_key=True,
    )
    width_cm: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    depth_cm: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    height_cm: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    mount_height_cm: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    wall_gap_cm: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    item: Mapped[FairStandItemModel] = relationship(back_populates="dimensions")


class FairStandItemSceneDimensionsModel(Base):
    __tablename__ = "fair_stand_item_scene_dimensions"
    __table_args__ = (
        CheckConstraint(
            "width_cm IS NOT NULL OR depth_cm IS NOT NULL OR height_cm IS NOT NULL",
            name="ck_fair_stand_item_scene_dimensions_present",
        ),
    )

    item_key: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("fair_stand_items.item_key", **CASCADE),
        primary_key=True,
    )
    width_cm: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    depth_cm: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    height_cm: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    item: Mapped[FairStandItemModel] = relationship(back_populates="scene_dimensions")


class FairStandItemStripOccupancyModel(Base):
    __tablename__ = "fair_stand_item_strip_occupancy"
    __table_args__ = (
        CheckConstraint("strip_count > 0", name="ck_fair_stand_item_strip_count"),
        CheckConstraint("align IN ('top')", name="ck_fair_stand_item_strip_align"),
    )

    item_key: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("fair_stand_items.item_key", **CASCADE),
        primary_key=True,
    )
    align: Mapped[str] = mapped_column(String(16), nullable=False)
    strip_count: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    item: Mapped[FairStandItemModel] = relationship(back_populates="strip_occupancy")


class FairStandItemAssetModel(Base):
    __tablename__ = "fair_stand_item_assets"
    __table_args__ = (
        UniqueConstraint("item_key", "asset_role", name="uq_fair_stand_item_assets_role"),
        CheckConstraint(
            "asset_role IN ('model', 'default_screen', 'catalog_image', 'thumbnail', 'texture')",
            name="ck_fair_stand_item_assets_role",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    item_key: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("fair_stand_items.item_key", **CASCADE),
        nullable=False,
        index=True,
    )
    asset_role: Mapped[str] = mapped_column(String(32), nullable=False)
    relative_path: Mapped[str] = mapped_column(String(512), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    item: Mapped[FairStandItemModel] = relationship(back_populates="assets")


class FairStandItemComponentModel(Base):
    __tablename__ = "fair_stand_item_components"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_fair_stand_item_components_quantity"),
        CheckConstraint("parent_item_key <> child_item_key", name="ck_fair_stand_item_components_self"),
        Index("ix_fair_stand_item_components_child", "child_item_key"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    parent_item_key: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("fair_stand_items.item_key", **CASCADE),
        nullable=False,
    )
    child_item_key: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("fair_stand_items.item_key", **CASCADE),
        nullable=False,
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    # Duvar yüksekliği kuralı: quantity üst ürünün kendi yüksekliğindeki adettir (ör. 350 cm = 7 bant).
    # per_band, her ek/eksik 50 cm bant için adet farkıdır (panel 1, tekli aparat 2).
    # height_matched: bu satırın parçası (dikme) seçilen duvar yüksekliğine göre değişir.
    per_band: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), nullable=False, default=Decimal("0"), server_default="0"
    )
    height_matched: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=sa_false()
    )
    parent: Mapped[FairStandItemModel] = relationship(
        back_populates="components",
        foreign_keys=[parent_item_key],
    )


class FairStandItemWidthVariantModel(Base):
    """Katalog kartı (aile) → takıldığı duvar genişliğine göre çözülen ürün (0072).

    Ör. "2 sıralı raf" kartı → shelf_row_2_100 / _150 / _200. Genişlik varyant Item'ın
    dimensions.width_cm değeridir; eşleme kodda anahtar deseniyle değil bu tabloyla yapılır.
    """

    __tablename__ = "fair_stand_item_width_variants"
    __table_args__ = (
        CheckConstraint("family_item_key <> item_key", name="ck_fair_stand_item_width_variants_self"),
        Index("ix_fair_stand_item_width_variants_item", "item_key"),
    )

    family_item_key: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("fair_stand_items.item_key", **CASCADE),
        primary_key=True,
    )
    item_key: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("fair_stand_items.item_key", **CASCADE),
        primary_key=True,
    )
    family: Mapped[FairStandItemModel] = relationship(
        back_populates="width_variants",
        foreign_keys=[family_item_key],
    )


class FairStandItemLengthPartModel(Base):
    """Uzun profil/dikmenin parça bölünüşü (0079); yalnız BOM etiketi içindir.

    Ör. upright_495 → upright_346_5, profile_8, profile_140_5 ("346,5 + 8 + 140,5").
    BOM miktarı ve reçete değişmez; alt Item (components) değildir.
    """

    __tablename__ = "fair_stand_item_length_parts"
    __table_args__ = (
        CheckConstraint("position >= 1", name="ck_fair_stand_item_length_parts_position"),
        CheckConstraint("item_key <> part_item_key", name="ck_fair_stand_item_length_parts_self"),
        Index("ix_fair_stand_item_length_parts_part", "part_item_key"),
    )

    item_key: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("fair_stand_items.item_key", **CASCADE),
        primary_key=True,
    )
    position: Mapped[int] = mapped_column(Integer, primary_key=True)
    part_item_key: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("fair_stand_items.item_key", **CASCADE),
        nullable=False,
    )
    item: Mapped[FairStandItemModel] = relationship(
        back_populates="length_parts",
        foreign_keys=[item_key],
    )


class FairStandItemAssemblyPartModel(Base):
    """Parent lokal child pose. BOM quantity `fair_stand_item_components` içindedir."""

    __tablename__ = "fair_stand_item_assembly_parts"
    __table_args__ = (
        CheckConstraint("instance_index >= 0", name="ck_fair_stand_item_assembly_index"),
        CheckConstraint(
            "lock_group_id IS NULL OR lock_group_id >= 1",
            name="ck_fair_stand_item_assembly_lock_group",
        ),
        UniqueConstraint(
            "parent_item_key",
            "child_item_key",
            "instance_index",
            name="uq_fair_stand_item_assembly_instance",
        ),
        Index("ix_fair_stand_item_assembly_parent", "parent_item_key"),
        Index("ix_fair_stand_item_assembly_child", "child_item_key"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    parent_item_key: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("fair_stand_items.item_key", **CASCADE),
        nullable=False,
    )
    child_item_key: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("fair_stand_items.item_key", **RESTRICT_UPDATE),
        nullable=False,
    )
    instance_index: Mapped[int] = mapped_column(Integer, nullable=False)
    x_cm: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False, default=Decimal("0"))
    y_cm: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False, default=Decimal("0"))
    z_cm: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False, default=Decimal("0"))
    rotation_x_deg: Mapped[Decimal] = mapped_column(
        Numeric(8, 3), nullable=False, default=Decimal("0")
    )
    rotation_y_deg: Mapped[Decimal] = mapped_column(
        Numeric(8, 3), nullable=False, default=Decimal("0")
    )
    rotation_z_deg: Mapped[Decimal] = mapped_column(
        Numeric(8, 3), nullable=False, default=Decimal("0")
    )
    lock_group_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    parent: Mapped[FairStandItemModel] = relationship(
        back_populates="assembly_parts",
        foreign_keys=[parent_item_key],
    )


class FairStandItemVideoWallModel(Base):
    __tablename__ = "fair_stand_item_video_walls"
    __table_args__ = (
        CheckConstraint("rows > 0", name="ck_fair_stand_video_wall_rows"),
        CheckConstraint("cols > 0", name="ck_fair_stand_video_wall_cols"),
    )

    parent_item_key: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("fair_stand_items.item_key", **CASCADE),
        primary_key=True,
    )
    rows: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    cols: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    panel_item_key: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("fair_stand_items.item_key", **CASCADE),
        nullable=False,
    )
    parent: Mapped[FairStandItemModel] = relationship(
        back_populates="video_wall",
        foreign_keys=[parent_item_key],
    )


class FairStandItemBodyPartModel(Base):
    __tablename__ = "fair_stand_item_body_parts"
    __table_args__ = (
        UniqueConstraint("parent_item_key", "body_role", name="uq_fair_stand_item_body_parts_role"),
        CheckConstraint(
            "body_role IN ('side', 'horizontal', 'glass_shelf')",
            name="ck_fair_stand_body_role",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    parent_item_key: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("fair_stand_items.item_key", **CASCADE),
        nullable=False,
    )
    body_role: Mapped[str] = mapped_column(String(32), nullable=False)
    child_item_key: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("fair_stand_items.item_key", **CASCADE),
        nullable=False,
    )
    parent: Mapped[FairStandItemModel] = relationship(
        back_populates="body_parts",
        foreign_keys=[parent_item_key],
    )


class FairStandDimensionsModel(Base):
    __tablename__ = "fair_stand_dimensions"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_fair_stand_dimensions_singleton"),
        CheckConstraint("height_cm > 0", name="ck_fair_stand_dimensions_height"),
        CheckConstraint("depth_cm > 0", name="ck_fair_stand_dimensions_depth"),
        CheckConstraint("frame_width_cm > 0", name="ck_fair_stand_dimensions_frame_width"),
        CheckConstraint("frame_depth_cm > 0", name="ck_fair_stand_dimensions_frame_depth"),
        CheckConstraint("panel_rail_height_cm > 0", name="ck_fair_stand_dimensions_panel_rail_height"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    height_cm: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    depth_cm: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    frame_width_cm: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    frame_depth_cm: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    panel_rail_height_cm: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FairStandSettingsModel(Base):
    __tablename__ = "fair_stand_settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_fair_stand_settings_singleton"),
        CheckConstraint("max_image_upload_mb > 0", name="ck_fair_stand_settings_max_image_upload_mb"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    max_image_upload_mb: Mapped[int] = mapped_column(Integer, nullable=False)
    export_button_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    import_button_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    save_as_button_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FairStandCostItemModel(Base):
    """Organization buy/sell amount for one Item or one manual cost line."""

    __tablename__ = "fair_stand_cost_items"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "item_key",
            name="uq_fair_stand_cost_items_organization_id_item_key",
        ),
        Index("ix_fair_stand_cost_items_organization_id", "organization_id"),
        CheckConstraint(
            "purchase_price >= 0",
            name="ck_fair_stand_cost_items_purchase_price",
        ),
        CheckConstraint(
            "sale_price >= 0",
            name="ck_fair_stand_cost_items_sale_price",
        ),
        CheckConstraint(
            "cost_item_type IN ('ITEM', 'MANUAL')",
            name="ck_fair_stand_cost_items_cost_item_type",
        ),
        CheckConstraint(
            "(cost_item_type = 'ITEM' AND item_key IS NOT NULL AND name IS NULL AND unit IS NULL) "
            "OR (cost_item_type = 'MANUAL' AND item_key IS NULL AND name IS NOT NULL "
            "AND trim(name) <> '' AND unit IS NOT NULL)",
            name="ck_fair_stand_cost_items_entry_shape",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    cost_item_type: Mapped[str] = mapped_column(String(16), nullable=False)
    item_key: Mapped[str | None] = mapped_column(
        String(128),
        ForeignKey(
            "fair_stand_items.item_key",
            name="fk_fair_stand_cost_items_item_key",
            ondelete="CASCADE",
            onupdate="CASCADE",
        ),
        nullable=True,
    )
    name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    unit: Mapped[str | None] = mapped_column(
        String(64),
        ForeignKey(
            "fair_stand_units.unit_key",
            name="fk_fair_stand_cost_items_unit_key",
            ondelete="CASCADE",
            onupdate="CASCADE",
        ),
        nullable=True,
    )
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    sale_price: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0"),
        server_default="0",
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FairStandProjectModel(Base):
    __tablename__ = "fair_stand_projects"
    __table_args__ = (
        Index("ix_fair_stand_projects_organization_id_updated_at", "organization_id", "updated_at"),
        Index("ix_fair_stand_projects_organization_id_customer_id", "organization_id", "customer_id"),
        CheckConstraint("version > 0", name="ck_fair_stand_projects_version"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    customer_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    payload: Mapped[dict] = mapped_column(PayloadJSON, nullable=False)
    created_by: Mapped[UUID | None] = mapped_column(Uuid, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    assets: Mapped[list["FairStandProjectAssetModel"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )
    revisions: Mapped[list["FairStandProjectRevisionModel"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )


class FairStandProjectRevisionModel(Base):
    __tablename__ = "fair_stand_project_revisions"
    __table_args__ = (
        Index("ix_fair_stand_project_revisions_project_id", "project_id"),
        UniqueConstraint(
            "project_id",
            "revision_number",
            name="uq_fair_stand_project_revisions_project_revision",
        ),
        CheckConstraint("revision_number > 0", name="ck_fair_stand_project_revisions_revision_number"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("fair_stand_projects.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    revision_number: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(PayloadJSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    project: Mapped[FairStandProjectModel] = relationship(back_populates="revisions")


class FairStandProjectAssetModel(Base):
    __tablename__ = "fair_stand_project_assets"
    __table_args__ = (
        Index("ix_fair_stand_project_assets_project_id", "project_id"),
        Index("ix_fair_stand_project_assets_organization_id", "organization_id"),
        UniqueConstraint("storage_key", name="uq_fair_stand_project_assets_storage_key"),
        CheckConstraint("byte_size >= 0", name="ck_fair_stand_project_assets_byte_size"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    project_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("fair_stand_projects.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False)
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    project: Mapped[FairStandProjectModel] = relationship(back_populates="assets")


class FairStandGroupTemplateModel(Base):
    """Organization group template: parts and their relative layout, not an Item.

    Payload holds the members' itemKey, size, relative placement, colour and panel
    features. Images are not stored (project assets are per project). Placing a
    template expands it into normal modules and a new group; BOM comes from the parts.
    """

    __tablename__ = "fair_stand_group_templates"
    __table_args__ = (
        Index("ix_fair_stand_group_templates_organization_id_updated_at", "organization_id", "updated_at"),
        CheckConstraint("length(trim(name)) > 0", name="ck_fair_stand_group_templates_name"),
        CheckConstraint("member_count > 0", name="ck_fair_stand_group_templates_member_count"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    member_count: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(PayloadJSON, nullable=False)
    created_by: Mapped[UUID | None] = mapped_column(Uuid, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
