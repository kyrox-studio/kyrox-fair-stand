from collections.abc import Sequence
from uuid import UUID

import httpx
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.integrations.kyrox_core.audit import (
    AuditPort,
    HttpAuditAdapter,
    NoOpAuditAdapter,
    StandAuditRecorder,
)
from app.integrations.kyrox_core.auth import AuthContext
from app.integrations.kyrox_core.client import HttpAuthorizationAdapter, KyroxCoreHttpClient
from app.integrations.kyrox_core.dev_bypass import (
    AllowAllAuthorizationAdapter,
    dev_bypass_enabled,
    resolve_auth_context,
)
from app.integrations.kyrox_core.lifecycle import (
    OrganizationLifecycleGuard,
    OrganizationLifecycleUnavailableError,
    OrganizationWorkNotAllowedError,
)
from app.integrations.kyrox_core.ports import AuthorizationPort
from app.modules.fair_stand.application.admin_catalog import AdminCatalogService
from app.modules.fair_stand.application.admin_items import AdminItemsService
from app.modules.fair_stand.application.admin_settings import AdminSettingsService
from app.modules.fair_stand.application.admin_snap_catalog import AdminSnapCatalogService
from app.modules.fair_stand.application.admin_units import AdminUnitsService
from app.modules.fair_stand.application.get_catalog_bootstrap import GetCatalogBootstrapUseCase
from app.modules.fair_stand.application.get_item import GetItemUseCase
from app.modules.fair_stand.application.cost_items import CostItemService
from app.modules.fair_stand.application.group_templates import GroupTemplateService
from app.modules.fair_stand.application.projects import ProjectService
from app.modules.fair_stand.infrastructure.catalog_repository import SqlAlchemyFairStandCatalogRepository

bearer_scheme = HTTPBearer(auto_error=False)

PERMISSION_CATALOG_READ = "fair_crm.admin.fair_stand.catalog.read"
PERMISSION_CATALOG_CREATE = "fair_crm.admin.fair_stand.catalog.create"
PERMISSION_CATALOG_UPDATE = "fair_crm.admin.fair_stand.catalog.update"
PERMISSION_CATALOG_ARCHIVE = "fair_crm.admin.fair_stand.catalog.archive"
PERMISSION_SETTINGS_READ = "fair_crm.admin.fair_stand.settings.read"
PERMISSION_SETTINGS_UPDATE = "fair_crm.admin.fair_stand.settings.update"
PERMISSION_ITEMS_READ = "fair_crm.admin.fair_stand.items.read"
PERMISSION_ITEMS_CREATE = "fair_crm.admin.fair_stand.items.create"
PERMISSION_ITEMS_UPDATE = "fair_crm.admin.fair_stand.items.update"
PERMISSION_ITEMS_ARCHIVE = "fair_crm.admin.fair_stand.items.archive"
PERMISSION_PROJECTS_READ = "fair_crm.fair_stand.projects.read"
PERMISSION_PROJECTS_CREATE = "fair_crm.fair_stand.projects.create"
PERMISSION_PROJECTS_UPDATE = "fair_crm.fair_stand.projects.update"
PERMISSION_PROJECTS_DELETE = "fair_crm.fair_stand.projects.delete"
PERMISSION_PROJECTS_EXECUTE = "fair_crm.fair_stand.projects.execute"
PERMISSION_COST_ITEMS_READ = "fair_crm.fair_stand.cost_items.read"
PERMISSION_COST_ITEMS_CREATE = "fair_crm.fair_stand.cost_items.create"
PERMISSION_COST_ITEMS_UPDATE = "fair_crm.fair_stand.cost_items.update"
PERMISSION_COST_ITEMS_DELETE = "fair_crm.fair_stand.cost_items.delete"


def get_catalog_repository(db: Session = Depends(get_db)) -> SqlAlchemyFairStandCatalogRepository:
    return SqlAlchemyFairStandCatalogRepository(db)


def get_catalog_bootstrap_use_case(
    repository: SqlAlchemyFairStandCatalogRepository = Depends(get_catalog_repository),
) -> GetCatalogBootstrapUseCase:
    return GetCatalogBootstrapUseCase(repository)


def get_item_use_case(
    repository: SqlAlchemyFairStandCatalogRepository = Depends(get_catalog_repository),
) -> GetItemUseCase:
    return GetItemUseCase(repository)


def get_admin_catalog_service(
    db: Session = Depends(get_db),
    repository: SqlAlchemyFairStandCatalogRepository = Depends(get_catalog_repository),
) -> AdminCatalogService:
    return AdminCatalogService(session=db, repository=repository)


def get_admin_settings_service(db: Session = Depends(get_db)) -> AdminSettingsService:
    return AdminSettingsService(db)


def get_admin_items_service(db: Session = Depends(get_db)) -> AdminItemsService:
    return AdminItemsService(db)


def get_admin_snap_catalog_service(db: Session = Depends(get_db)) -> AdminSnapCatalogService:
    return AdminSnapCatalogService(db)


def get_admin_units_service(db: Session = Depends(get_db)) -> AdminUnitsService:
    return AdminUnitsService(db)


def get_cost_item_service(db: Session = Depends(get_db)) -> CostItemService:
    return CostItemService(db)


def get_group_template_service(db: Session = Depends(get_db)) -> GroupTemplateService:
    return GroupTemplateService(db)


def get_project_service(db: Session = Depends(get_db)) -> ProjectService:
    return ProjectService(db, asset_root=get_settings().project_asset_root)


def get_core_http_client() -> KyroxCoreHttpClient:
    return KyroxCoreHttpClient()


def get_auth_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    organization_id: UUID = Header(..., alias="X-Organization-Id"),
    dev_user_id: UUID | None = Header(default=None, alias="X-Dev-User-Id"),
) -> AuthContext:
    try:
        return resolve_auth_context(credentials, organization_id, dev_user_id=dev_user_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated") from exc


def require_fair_stand_catalog_access(
    auth: AuthContext = Depends(get_auth_context),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    core_http: KyroxCoreHttpClient = Depends(get_core_http_client),
) -> AuthContext:
    if dev_bypass_enabled():
        return auth
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        response = core_http.request(
            "GET",
            f"/api/v1/organizations/{auth.organization_id}/access/verify",
            access_token=credentials.credentials,
            organization_id=auth.organization_id,
        )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Organization access service unavailable",
        ) from exc
    if response.status_code == status.HTTP_401_UNAUTHORIZED:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    if response.status_code == status.HTTP_403_FORBIDDEN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization access denied")
    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Organization access check failed",
        )
    return auth


def get_authorization_adapter() -> AuthorizationPort:
    if dev_bypass_enabled():
        return AllowAllAuthorizationAdapter()
    return HttpAuthorizationAdapter()


def _require_any_permission(permission_codes: Sequence[str]):
    def dependency(
        auth: AuthContext = Depends(get_auth_context),
        authorization: AuthorizationPort = Depends(get_authorization_adapter),
        credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    ) -> AuthContext:
        if dev_bypass_enabled():
            return auth
        if credentials is None or not credentials.credentials:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        if not any(
            authorization.check_permission(
                organization_id=auth.organization_id,
                user_id=auth.user_id,
                permission_code=permission_code,
                access_token=credentials.credentials,
            )
            for permission_code in permission_codes
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
        return auth

    return dependency


def require_permission(permission_code: str):
    return _require_any_permission((permission_code,))


def require_any_permission(*permission_codes: str):
    if not permission_codes:
        raise ValueError("At least one permission code is required")
    return _require_any_permission(permission_codes)


def get_audit_adapter() -> AuditPort:
    if dev_bypass_enabled():
        return NoOpAuditAdapter()
    return HttpAuditAdapter()


def get_stand_audit(
    auth: AuthContext = Depends(get_auth_context),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    adapter: AuditPort = Depends(get_audit_adapter),
    db: Session = Depends(get_db),
) -> StandAuditRecorder:
    """Request-bound Core audit recorder (D-18); events are sent after the DB commit."""
    token = credentials.credentials if credentials and credentials.credentials else ""
    if not token:
        adapter = NoOpAuditAdapter()
    return StandAuditRecorder(
        session=db,
        adapter=adapter,
        organization_id=auth.organization_id,
        access_token=token,
    )


def get_lifecycle_guard() -> OrganizationLifecycleGuard:
    return OrganizationLifecycleGuard()


def enforce_organization_work_allowed(guard: OrganizationLifecycleGuard, organization_id: UUID) -> None:
    """Fail closed unless Core reports the organization as active and not deleted (D-12)."""
    if dev_bypass_enabled():
        return
    try:
        guard.require_work_allowed(organization_id)
    except OrganizationWorkNotAllowedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization lifecycle does not allow product work",
        ) from exc
    except OrganizationLifecycleUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Organization lifecycle authority unavailable",
        ) from exc


def require_work_permission(*permission_codes: str):
    """Permission check first, then the Core lifecycle gate for organization-owned writes."""
    if not permission_codes:
        raise ValueError("At least one permission code is required")
    permission_dependency = _require_any_permission(permission_codes)

    def dependency(
        auth: AuthContext = Depends(permission_dependency),
        guard: OrganizationLifecycleGuard = Depends(get_lifecycle_guard),
    ) -> AuthContext:
        enforce_organization_work_allowed(guard, auth.organization_id)
        return auth

    return dependency
