"""Fail CI when organization-scoped Fair Stand code lacks isolation evidence.

This is a repository/system governance test, not a domain unit test. The backend
pytest step of the canonical CI runs it on every pull request.

Contract (TENANT_ISOLATION_SYSTEM_TEST_STANDARD, permanent system-regression gate):
- production source files under ``app/modules`` are discovered by ``organization_id``;
- every discovered file must have registered ABC/XYZ isolation evidence or a
  narrow architectural exclusion with a reason;
- registered evidence must resolve to executable pytest code;
- a file cannot be both covered and excluded, and registry entries must exist.

The evidence tests remain responsible for the applicable adversarial cases
(own-org success, foreign direct IDs, cross-linked IDs, exports and downloads).
"""

from __future__ import annotations

from pathlib import Path

from tests.system.tenant_isolation_registry import (
    TENANT_ISOLATION_EVIDENCE,
    TENANT_SCOPE_EXCLUSIONS,
)

BACKEND_ROOT = Path(__file__).resolve().parents[2]
APP_MODULES_ROOT = BACKEND_ROOT / "app" / "modules"
TESTS_ROOT = BACKEND_ROOT / "tests"

NEGATIVE_BOUNDARY_MARKERS = (
    "foreign",
    "cross_org",
    "cross-organization",
    "cross_organization",
    "other_org",
    "other_organization",
)


def _discovered_organization_scoped_files() -> set[str]:
    discovered: set[str] = set()
    for source_file in APP_MODULES_ROOT.rglob("*.py"):
        if "__pycache__" in source_file.parts:
            continue
        try:
            source = source_file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        if "organization_id" in source:
            discovered.add(source_file.relative_to(APP_MODULES_ROOT).as_posix())
    return discovered


def _evidence_python_files(relative_path: str) -> list[Path]:
    evidence_path = TESTS_ROOT / relative_path
    if evidence_path.is_file():
        return [evidence_path] if evidence_path.suffix == ".py" else []
    if evidence_path.is_dir():
        return sorted(evidence_path.rglob("test_*.py"))
    return []


def test_every_organization_scoped_file_has_registered_isolation_contract() -> None:
    discovered = _discovered_organization_scoped_files()
    registered = set(TENANT_ISOLATION_EVIDENCE)
    excluded = set(TENANT_SCOPE_EXCLUSIONS)

    overlap = registered & excluded
    assert not overlap, (
        "Tenant-isolation registry error: files cannot be both covered and "
        f"excluded: {sorted(overlap)}"
    )

    missing = discovered - registered - excluded
    assert not missing, (
        "New organization-scoped Fair Stand file(s) have no tenant-isolation "
        f"contract: {sorted(missing)}. Register ABC/XYZ adversarial test evidence "
        "in tests/system/tenant_isolation_registry.py. Do not add an exclusion "
        "unless the file truly owns no organization-scoped product data."
    )


def test_registry_entries_point_to_existing_scoped_files() -> None:
    discovered = _discovered_organization_scoped_files()
    stale = sorted((set(TENANT_ISOLATION_EVIDENCE) | set(TENANT_SCOPE_EXCLUSIONS)) - discovered)
    assert not stale, (
        "Tenant-isolation registry lists files that no longer exist or no longer "
        f"carry organization_id: {stale}. Remove or rename the entries."
    )


def test_registered_isolation_evidence_resolves_to_executable_pytest() -> None:
    errors: list[str] = []

    for scoped_file, evidence_paths in sorted(TENANT_ISOLATION_EVIDENCE.items()):
        if not evidence_paths:
            errors.append(f"{scoped_file}: no evidence paths registered")
            continue

        executable_evidence = False
        for relative_path in evidence_paths:
            python_files = _evidence_python_files(relative_path)
            if not python_files:
                errors.append(f"{scoped_file}: missing pytest evidence at {relative_path}")
                continue
            for python_file in python_files:
                source = python_file.read_text(encoding="utf-8").lower()
                if "def test_" not in source:
                    continue
                has_org_context = "organization_id" in source or "x-organization-id" in source
                has_negative_boundary = any(marker in source for marker in NEGATIVE_BOUNDARY_MARKERS)
                if has_org_context and has_negative_boundary:
                    executable_evidence = True
                    break

        if not executable_evidence:
            errors.append(
                f"{scoped_file}: evidence exists but no executable ABC/XYZ-style "
                "negative organization-boundary test was detected"
            )

    assert not errors, "Tenant-isolation evidence errors:\n - " + "\n - ".join(errors)


def test_tenant_scope_exclusions_have_durable_reasons() -> None:
    invalid = {
        scoped_file: reason
        for scoped_file, reason in TENANT_SCOPE_EXCLUSIONS.items()
        if len(reason.strip()) < 30
    }
    assert not invalid, (
        "Tenant-scope exclusions require a durable architectural reason; invalid "
        f"entries: {sorted(invalid)}"
    )
