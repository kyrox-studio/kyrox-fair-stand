"""Canonical Fair Stand tenant-isolation evidence registry.

Fair Stand has one bounded context (``app/modules/fair_stand``), so the scoped unit
is a production source file, not a top-level module. Every file under
``app/modules`` that carries ``organization_id`` must be represented here or
explicitly excluded with an architectural reason. The system governance test
discovers scoped files from production code and fails CI when a new one is not
registered.

Keys are paths relative to ``app/modules``. Evidence paths are relative to
``backend/tests`` and may point to a test file or a test directory. They must
contain executable ABC/XYZ-style negative evidence (foreign/cross-organization
denial), not only happy-path tests.

Standard: kyrox-platform/standards/quality/TENANT_ISOLATION_SYSTEM_TEST_STANDARD.md
"""

from __future__ import annotations

_PROJECTS = "modules/fair_stand/test_project_tenant_isolation.py"
_COST_ITEMS = "modules/fair_stand/test_cost_items_api.py"
_GROUP_TEMPLATES = "modules/fair_stand/test_group_templates_api.py"

TENANT_ISOLATION_EVIDENCE: dict[str, tuple[str, ...]] = {
    "fair_stand/api/project_routes.py": (_PROJECTS, "modules/fair_stand/test_project_revisions.py"),
    "fair_stand/application/projects.py": (_PROJECTS, "modules/fair_stand/test_project_customer.py"),
    # Asset bytes are stored under ``{organization_id}/{project_id}/``; the project
    # isolation suite proves a foreign organization cannot read, replace or delete them.
    "fair_stand/application/image_optimize.py": (_PROJECTS,),
    "fair_stand/infrastructure/asset_storage.py": (_PROJECTS,),
    "fair_stand/api/cost_item_routes.py": (_COST_ITEMS,),
    "fair_stand/application/cost_items.py": (_COST_ITEMS,),
    "fair_stand/api/group_template_routes.py": (_GROUP_TEMPLATES,),
    "fair_stand/application/group_templates.py": (_GROUP_TEMPLATES,),
}


# Exclusions are intentionally rare. A file may be excluded only when it references
# organization context but does not own/read/mutate organization-scoped product
# data by itself. Every exclusion needs a durable architectural reason.
TENANT_SCOPE_EXCLUSIONS: dict[str, str] = {
    "fair_stand/api/dependencies.py": (
        "Resolves the trusted organization context (X-Organization-Id + Core JWT, "
        "Core access/verify) for every route; it owns no Fair Stand product rows."
    ),
    "fair_stand/infrastructure/models.py": (
        "ORM schema only: declares organization_id columns. Every query over these "
        "rows lives in a registered application file with its own evidence."
    ),
}
