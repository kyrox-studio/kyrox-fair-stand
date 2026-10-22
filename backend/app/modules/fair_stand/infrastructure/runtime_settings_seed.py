from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.modules.fair_stand.infrastructure.models import FairStandSettingsModel

STAND_SETTINGS_ID = 1
MAX_IMAGE_UPLOAD_MB = 5
EXPORT_BUTTON_VISIBLE = True
IMPORT_BUTTON_VISIBLE = True
SAVE_AS_BUTTON_VISIBLE = True


def ensure_runtime_settings(session: Session) -> FairStandSettingsModel:
    row = session.get(FairStandSettingsModel, STAND_SETTINGS_ID)
    now = datetime.now(tz=UTC)
    if row is None:
        row = FairStandSettingsModel(
            id=STAND_SETTINGS_ID,
            max_image_upload_mb=MAX_IMAGE_UPLOAD_MB,
            export_button_visible=EXPORT_BUTTON_VISIBLE,
            import_button_visible=IMPORT_BUTTON_VISIBLE,
            save_as_button_visible=SAVE_AS_BUTTON_VISIBLE,
            created_at=now,
            updated_at=now,
        )
        session.add(row)
        session.flush()
    return row

