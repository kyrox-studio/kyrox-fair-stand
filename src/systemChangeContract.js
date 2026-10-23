export const CHANGE_CONTRACT_SCHEMA_VERSION = 2;

export const SYSTEM_CHANGE_KINDS = Object.freeze([
  'module',
  'feature',
  'ui-control',
  'state-change',
  'renderer-change',
  'persistence-change',
  'bom-change',
  'architecture',
  'tooling',
  'bugfix',
  'refactor',
]);

export const SYSTEM_IMPACT_DOMAINS = Object.freeze([
  'catalog',
  'behavior',
  'state',
  'placement',
  'renderer',
  'persistence',
  'bom',
  'ui',
  'composition',
  'assets',
  'storage',
  'importExport',
  'performance',
  'accessibility',
  'architecture',
  'security',
  'tests',
]);

export const SYSTEM_BROWSER_E2E_DOMAINS = Object.freeze([
  'catalog',
  'behavior',
  'state',
  'placement',
  'renderer',
  'persistence',
  'bom',
  'ui',
  'composition',
  'assets',
  'storage',
  'importExport',
  'accessibility',
]);

export const SYSTEM_IMPACT_DECISIONS = Object.freeze([
  'affected',
  'not-applicable',
]);

const KIND_REQUIRED_DOMAINS = Object.freeze({
  'ui-control': Object.freeze(['ui']),
  'state-change': Object.freeze(['state']),
  'renderer-change': Object.freeze(['renderer']),
  'persistence-change': Object.freeze(['persistence']),
  'bom-change': Object.freeze(['bom']),
  architecture: Object.freeze(['architecture']),
  tooling: Object.freeze(['architecture']),
});

function frozenDomains(...domains) {
  return Object.freeze(domains);
}

// Mevcut her kaynak dosya için sahiplikten türetilmiş açık harita. Yeni bir src dosyasının
// kasıtlı yedek yolu yoktur: regresyon paketi CI geçmeden önce onu sınıflandırmalıdır.
export const SOURCE_FILE_REQUIRED_DOMAINS = Object.freeze({
  'src/assetStore.js': frozenDomains('persistence', 'storage'),
  'src/autoDepot.js': frozenDomains('composition', 'placement'),
  'src/autoFascia.js': frozenDomains('composition', 'placement'),
  'src/automaticWall.js': frozenDomains('composition', 'placement'),
  'src/autosaveController.js': frozenDomains('persistence'),
  'src/autosaveSettings.js': frozenDomains('persistence', 'ui'),
  'src/baseRunBom.js': frozenDomains('bom'),
  'src/catalog.js': frozenDomains('catalog'),
  'src/catalogBootstrap.js': frozenDomains('catalog', 'architecture'),
  'src/catalogPreviewRenderer.js': frozenDomains('catalog', 'ui', 'architecture'),
  'src/colorEditor.css': frozenDomains('ui'),
  'src/colorEditorController.js': frozenDomains('ui'),
  'src/colorEditorInputs.js': frozenDomains('ui'),
  'src/colorUtils.js': frozenDomains('ui'),
  'src/configuratorDb.js': frozenDomains('persistence', 'storage'),
  'src/configuratorMarkup.js': frozenDomains('ui'),
  'src/configuratorStyles.js': frozenDomains('ui'),
  'src/designHistory.js': frozenDomains('state', 'ui'),
  'src/designState.js': frozenDomains('state', 'persistence'),
  'src/featureContracts.js': frozenDomains('architecture', 'composition'),
  'src/floorArea.js': frozenDomains('state', 'bom', 'placement'),
  'src/groundLayout.js': frozenDomains('renderer', 'placement'),
  'src/helpGuide.css': frozenDomains('ui'),
  'src/helpGuide.js': frozenDomains('ui', 'accessibility'),
  'src/horizontalImageLayout.js': frozenDomains('renderer', 'state'),
  'src/hostDocument.js': frozenDomains('architecture', 'ui'),
  'src/imageActions.css': frozenDomains('ui'),
  'src/imageAssetReferences.js': frozenDomains('persistence', 'storage'),
  'src/imageFit.js': frozenDomains('renderer'),
  'src/imageOptimize.js': frozenDomains('persistence', 'storage', 'assets', 'security'),
  'src/itemBom.js': frozenDomains('architecture', 'bom'),
  'src/itemAdminAssemblyLock.js': frozenDomains('ui', 'state', 'placement'),
  'src/itemAdminCornerSnap.js': frozenDomains('ui', 'placement'),
  'src/itemAdminPreview.js': frozenDomains('ui', 'renderer', 'state', 'placement'),
  'src/itemAssembly.js': frozenDomains('composition', 'persistence', 'bom'),
  'src/itemCapabilities.js': frozenDomains('architecture', 'behavior'),
  'src/itemSnap.js': frozenDomains('architecture', 'placement', 'behavior'),
  'src/items.js': frozenDomains('architecture', 'catalog', 'bom'),
  'src/liveTabShare.js': frozenDomains('ui', 'security', 'architecture'),
  'src/main.js': frozenDomains(
    'architecture',
    'catalog',
    'behavior',
    'state',
    'placement',
    'renderer',
    'persistence',
    'ui',
    'composition',
    'assets',
    'storage',
    'importExport',
    'bom',
  ),
  'src/moduleBehavior.js': frozenDomains('behavior'),
  'src/moduleContextMenu.js': frozenDomains('ui', 'catalog', 'behavior'),
  'src/moduleContracts.js': frozenDomains('architecture', 'catalog', 'behavior', 'bom'),
  'src/moduleDragSidebar.js': frozenDomains('ui', 'catalog'),
  'src/selectionToolbar.js': frozenDomains('ui', 'behavior'),
  'src/newProjectWizard.js': frozenDomains('ui', 'behavior'),
  'src/onboardingTips.js': frozenDomains('ui', 'storage'),
  'src/moduleLock.js': frozenDomains('behavior', 'placement', 'state'),
  'src/moduleGroups.js': frozenDomains('behavior', 'placement', 'state', 'persistence', 'importExport'),
  'src/moduleGroupPanel.js': frozenDomains('ui', 'state'),
  'src/groupTemplates.js': frozenDomains('composition', 'state', 'placement', 'persistence'),
  'src/groupTemplateRemote.js': frozenDomains('persistence', 'security'),
  'src/groupTemplatePanel.js': frozenDomains('ui', 'state'),
  'src/moduleMove.js': frozenDomains('behavior', 'placement'),
  'src/modulePlacement.js': frozenDomains('behavior', 'placement'),
  'src/moduleRecipes.js': frozenDomains('bom'),
  'src/mountFairStand.js': frozenDomains('architecture', 'ui', 'renderer'),
  'src/placementFeedback.js': frozenDomains('ui', 'placement'),
  'src/bomLineGroups.js': frozenDomains('bom', 'ui'),
  'src/panelGlassBom.js': frozenDomains('architecture', 'bom'),
  'src/projectBom.js': frozenDomains('architecture', 'bom'),
  'src/relationshipBom.js': frozenDomains('architecture', 'bom'),
  'src/printAreaBom.js': frozenDomains('bom'),
  'src/productionBomPanel.js': frozenDomains('bom', 'ui'),
  'src/productionBomPanel.css': frozenDomains('ui'),
  'src/projectActionSaveGuard.js': frozenDomains('ui', 'persistence', 'storage', 'importExport'),
  'src/projectNaming.js': frozenDomains('ui'),
  'src/projectOpenTiming.js': frozenDomains('performance'),
  'src/projectSaveAs.js': frozenDomains('persistence', 'storage', 'importExport', 'state', 'ui'),
  'src/projectImportValidation.js': frozenDomains('importExport', 'persistence', 'state'),
  'src/projectRemote.js': frozenDomains('persistence', 'storage', 'assets', 'importExport', 'security'),
  'src/projectRevisionSession.js': frozenDomains('persistence', 'state'),
  'src/projectStore.js': frozenDomains('persistence', 'storage'),
  'src/projectSwitch.js': frozenDomains('ui', 'persistence'),
  'src/projectUi.js': frozenDomains('ui'),
  'src/rectImageLayout.js': frozenDomains('renderer', 'state'),
  'src/runtimeSettings.js': frozenDomains('architecture', 'catalog', 'assets', 'security', 'ui', 'importExport'),
  'src/rectSelection.js': frozenDomains('ui'),
  'src/sceneAssetLoading.js': frozenDomains('performance', 'ui'),
  'src/scene3d.js': frozenDomains('renderer', 'state', 'placement', 'behavior', 'performance'),
  'src/sceneDimensions.js': frozenDomains('architecture', 'renderer', 'placement', 'composition'),
  'src/selectionFeedback.js': frozenDomains('ui'),
  'src/sidebarController.js': frozenDomains('ui'),
  'src/stageFeedback.js': frozenDomains('ui'),
  'src/standDimensions.js': frozenDomains('architecture', 'placement', 'renderer'),
  'src/standSetup.js': frozenDomains('placement', 'composition', 'renderer'),
  'src/standStandardsCopy.js': frozenDomains('ui', 'catalog'),
  'src/stripOccupancy.js': frozenDomains('architecture', 'behavior', 'placement', 'renderer'),
  'src/surfaceStateBinding.js': frozenDomains('state', 'renderer', 'persistence'),
  'src/toastNotifications.css': frozenDomains('ui'),
  'src/toastNotifications.js': frozenDomains('ui', 'accessibility'),
  'src/uprightHeight.js': frozenDomains('ui', 'catalog', 'state'),
  'src/profileLength.js': frozenDomains('ui', 'catalog', 'state'),
  'src/itemSizeDialog.js': frozenDomains('ui', 'catalog', 'accessibility'),
  'src/wallShortWidth.js': frozenDomains('ui', 'catalog', 'state'),
  'src/style.css': frozenDomains('ui'),
  'src/systemChangeContract.js': frozenDomains('architecture'),
  'src/theme.js': frozenDomains('ui', 'renderer'),
  'src/uiFeedback.js': frozenDomains('ui', 'accessibility'),
  'src/viewCube.js': frozenDomains('renderer', 'ui'),
  'src/viewKeyboardShortcuts.js': frozenDomains('behavior', 'ui', 'accessibility'),
  'src/viewportToolbarController.js': frozenDomains('ui'),
  'src/wall.js': frozenDomains('composition', 'placement'),
  'src/wallPanelBand.js': frozenDomains('architecture', 'placement', 'renderer', 'behavior'),
  'src/profileGeometry.js': frozenDomains('renderer', 'performance'),
  'src/wallReflow.js': frozenDomains('behavior', 'placement'),
});

// İnsan/AI yönetim yüzeyleri de mimari sözleşmenin parçasıdır.
// Aynı açık değişiklik bildirimi olmadan zayıflatılamaz veya sapamaz.
export const GOVERNANCE_DOCUMENT_REQUIRED_DOMAINS = Object.freeze({
  'AGENTS.md': frozenDomains('architecture'),
  'ITEM_CONTRACT.md': frozenDomains('architecture'),
  'README.md': frozenDomains('architecture'),
  'PROJECT_RULES.md': frozenDomains('architecture'),
  'ARCHITECTURE_RULES.md': frozenDomains('architecture'),
  'SYSTEM_DEVELOPMENT_CONTRACT.md': frozenDomains('architecture'),
  'SYSTEM_CHANGE_GATE.md': frozenDomains('architecture'),
  'SYSTEM_IMPACT_SWEEP.md': frozenDomains('architecture'),
  'MODULE_BEHAVIOR_STANDARD.md': frozenDomains('architecture'),
  'SYSTEM_AUDIT_CHECKLIST.md': frozenDomains('architecture'),
});

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isNonEmptyStringArray(value) {
  return isStringArray(value) && value.length > 0;
}

function hasDuplicates(value) {
  return Array.isArray(value) && new Set(value).size !== value.length;
}

function validatePathArray(errors, value, fieldName) {
  if (!isStringArray(value)) {
    errors.push(`${fieldName} must be an array of non-empty paths.`);
    return;
  }
  if (hasDuplicates(value)) errors.push(`${fieldName} must not contain duplicates.`);
}

function validateFindingArray(errors, value, fieldName) {
  if (!isStringArray(value)) {
    errors.push(`${fieldName} must be an array.`);
    return;
  }
  if (hasDuplicates(value)) errors.push(`${fieldName} must not contain duplicates.`);
  for (const finding of value) {
    if (!/^F-\d{3}$/.test(finding)) errors.push(`${fieldName} contains invalid finding id: ${finding}.`);
  }
}

export function requiresBrowserE2E(impact) {
  if (!impact || typeof impact !== 'object' || Array.isArray(impact)) return false;
  return SYSTEM_BROWSER_E2E_DOMAINS.some((domain) => impact[domain] === 'affected');
}

export function validateSystemChangeContract(contract) {
  const errors = [];

  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    return ['Contract must be an object.'];
  }

  if (contract.schemaVersion !== CHANGE_CONTRACT_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${CHANGE_CONTRACT_SCHEMA_VERSION}.`);
  }

  if (!isNonEmptyString(contract.id)) errors.push('id is required.');
  if (!SYSTEM_CHANGE_KINDS.includes(contract.kind)) errors.push(`Unknown kind: ${contract.kind ?? '<missing>'}.`);
  if (!isNonEmptyString(contract.summary)) errors.push('summary is required.');
  if (!isNonEmptyStringArray(contract.owners)) errors.push('owners must contain at least one canonical owner.');
  if (!isNonEmptyStringArray(contract.sourceOfTruth)) errors.push('sourceOfTruth must contain at least one canonical source.');

  if (!contract.impact || typeof contract.impact !== 'object' || Array.isArray(contract.impact)) {
    errors.push('impact map is required.');
  } else {
    const declaredDomains = Object.keys(contract.impact);
    const missingDomains = SYSTEM_IMPACT_DOMAINS.filter((domain) => !Object.hasOwn(contract.impact, domain));
    const unknownDomains = declaredDomains.filter((domain) => !SYSTEM_IMPACT_DOMAINS.includes(domain));

    if (missingDomains.length) errors.push(`Missing impact decisions: ${missingDomains.join(', ')}.`);
    if (unknownDomains.length) errors.push(`Unknown impact domains: ${unknownDomains.join(', ')}.`);

    for (const domain of SYSTEM_IMPACT_DOMAINS) {
      if (!Object.hasOwn(contract.impact, domain)) continue;
      if (!SYSTEM_IMPACT_DECISIONS.includes(contract.impact[domain])) {
        errors.push(`${domain} must be affected or not-applicable.`);
      }
    }

    const affectedCount = SYSTEM_IMPACT_DOMAINS.filter((domain) => contract.impact[domain] === 'affected').length;
    if (affectedCount === 0) errors.push('At least one impact domain must be affected.');

    if (contract.impact.tests !== 'affected') {
      errors.push('All changes must mark tests as affected.');
    }

    for (const requiredDomain of KIND_REQUIRED_DOMAINS[contract.kind] ?? []) {
      if (contract.impact[requiredDomain] !== 'affected') {
        errors.push(`${contract.kind} changes must mark ${requiredDomain} as affected.`);
      }
    }

    if (contract.kind === 'module') {
      const moduleDomains = ['catalog', 'behavior', 'state', 'renderer'];
      if (!moduleDomains.some((domain) => contract.impact[domain] === 'affected')) {
        errors.push('module changes must affect at least one of catalog, behavior, state, or renderer.');
      }
    }

    if (contract.kind === 'feature') {
      const featureDomains = ['composition', 'behavior', 'ui', 'state'];
      if (!featureDomains.some((domain) => contract.impact[domain] === 'affected')) {
        errors.push('feature changes must affect at least one of composition, behavior, ui, or state.');
      }
    }
  }

  if (!contract.impactAnalysis || typeof contract.impactAnalysis !== 'object' || Array.isArray(contract.impactAnalysis)) {
    errors.push('impactAnalysis is required for every change.');
  } else {
    if (contract.impactAnalysis.mode !== 'full-system') {
      errors.push('impactAnalysis.mode must be full-system.');
    }
    validatePathArray(errors, contract.impactAnalysis.affectedFiles, 'impactAnalysis.affectedFiles');
    validatePathArray(errors, contract.impactAnalysis.affectedTests, 'impactAnalysis.affectedTests');
    validatePathArray(errors, contract.impactAnalysis.affectedDocs, 'impactAnalysis.affectedDocs');

    const related = contract.impactAnalysis.relatedFindings;
    if (!related || typeof related !== 'object' || Array.isArray(related)) {
      errors.push('impactAnalysis.relatedFindings is required.');
    } else {
      validateFindingArray(errors, related.affected, 'impactAnalysis.relatedFindings.affected');
      validateFindingArray(errors, related.reviewedNotAffected, 'impactAnalysis.relatedFindings.reviewedNotAffected');
      const overlap = (related.affected ?? []).filter((finding) => (related.reviewedNotAffected ?? []).includes(finding));
      if (overlap.length) errors.push(`Findings cannot be both affected and reviewedNotAffected: ${overlap.join(', ')}.`);
    }

    if (!isNonEmptyString(contract.impactAnalysis.notes)) {
      errors.push('impactAnalysis.notes is required.');
    }
  }

  if (!contract.tests || typeof contract.tests !== 'object' || Array.isArray(contract.tests)) {
    errors.push('tests policy is required.');
  } else {
    if (!isNonEmptyStringArray(contract.tests.targeted)) {
      errors.push('tests.targeted must contain at least one targeted regression test.');
    }
    if (contract.tests.fullSuite !== true) errors.push('tests.fullSuite must be true.');
    if (contract.tests.build !== true) errors.push('tests.build must be true.');

    if (isStringArray(contract.tests.targeted) && isStringArray(contract.impactAnalysis?.affectedTests)) {
      const missingFromReview = contract.tests.targeted.filter((testPath) => !contract.impactAnalysis.affectedTests.includes(testPath));
      if (missingFromReview.length) {
        errors.push(`Targeted tests must also appear in impactAnalysis.affectedTests: ${missingFromReview.join(', ')}.`);
      }
    }

    const e2e = contract.tests.e2e;
    if (!e2e || typeof e2e !== 'object' || Array.isArray(e2e)) {
      errors.push('tests.e2e declaration is required for every change.');
    } else {
      if (typeof e2e.required !== 'boolean') errors.push('tests.e2e.required must be boolean.');
      validatePathArray(errors, e2e.targeted, 'tests.e2e.targeted');
      if (!isNonEmptyString(e2e.reason)) errors.push('tests.e2e.reason is required.');

      const browserImpact = requiresBrowserE2E(contract.impact);
      if (browserImpact && e2e.required !== true) {
        errors.push(`Browser-impacting changes must require E2E coverage. Trigger domains: ${SYSTEM_BROWSER_E2E_DOMAINS.filter((domain) => contract.impact?.[domain] === 'affected').join(', ')}.`);
      }

      if (e2e.required === true) {
        if (!isNonEmptyStringArray(e2e.targeted)) {
          errors.push('tests.e2e.targeted must contain at least one E2E test when E2E is required.');
        } else {
          const invalidE2EPaths = e2e.targeted.filter((testPath) => !testPath.startsWith('e2e/'));
          if (invalidE2EPaths.length) {
            errors.push(`E2E targeted tests must live under e2e/: ${invalidE2EPaths.join(', ')}.`);
          }
          if (isStringArray(contract.impactAnalysis?.affectedTests)) {
            const missingE2EReview = e2e.targeted.filter((testPath) => !contract.impactAnalysis.affectedTests.includes(testPath));
            if (missingE2EReview.length) {
              errors.push(`E2E targeted tests must also appear in impactAnalysis.affectedTests: ${missingE2EReview.join(', ')}.`);
            }
          }
        }
      } else if (isStringArray(e2e.targeted) && e2e.targeted.length > 0) {
        errors.push('tests.e2e.targeted must be empty when tests.e2e.required is false.');
      }
    }
  }

  if (!contract.risk || typeof contract.risk !== 'object' || Array.isArray(contract.risk)) {
    errors.push('risk declaration is required.');
  } else {
    if (!['low', 'medium', 'high'].includes(contract.risk.level)) errors.push('risk.level must be low, medium, or high.');
    if (!isNonEmptyString(contract.risk.notes)) errors.push('risk.notes is required.');
  }

  if (!contract.migration || typeof contract.migration !== 'object' || Array.isArray(contract.migration)) {
    errors.push('migration declaration is required.');
  } else {
    if (typeof contract.migration.required !== 'boolean') errors.push('migration.required must be boolean.');
    if (!isNonEmptyString(contract.migration.notes)) errors.push('migration.notes is required.');
  }

  if (!isNonEmptyString(contract.rollback)) errors.push('rollback plan is required.');

  return errors;
}

export function isGuardedChangeFile(path) {
  return path === 'index.html'
    || path === 'package.json'
    || path === 'package-lock.json'
    || Object.hasOwn(GOVERNANCE_DOCUMENT_REQUIRED_DOMAINS, path)
    || path.startsWith('src/')
    || path.startsWith('public/')
    || path.startsWith('scripts/')
    || path.startsWith('test/')
    || path.startsWith('tests/')
    || path.startsWith('e2e/')
    || path.startsWith('.github/workflows/')
    || path.startsWith('vite.config')
    || path.startsWith('playwright.config')
    || path.startsWith('backend/');
}

export function requiredDomainsForFile(path) {
  const required = new Set([
    ...(SOURCE_FILE_REQUIRED_DOMAINS[path] ?? []),
    ...(GOVERNANCE_DOCUMENT_REQUIRED_DOMAINS[path] ?? []),
  ]);

  if (path === 'index.html') required.add('ui');
  if (path.startsWith('public/')) required.add('assets');
  if (path.startsWith('test/') || path.startsWith('tests/') || path.startsWith('e2e/') || path.startsWith('backend/tests/')) {
    required.add('tests');
  }

  if (
    path === 'package.json'
    || path === 'package-lock.json'
    || path.startsWith('scripts/')
    || path.startsWith('.github/workflows/')
    || path.startsWith('vite.config')
    || path.startsWith('playwright.config')
    || path.startsWith('backend/')
  ) {
    required.add('architecture');
  }

  if (path.startsWith('backend/') && !path.startsWith('backend/tests/')) {
    required.add('security');
    required.add('tests');
  }

  if (path.startsWith('playwright.config')) required.add('tests');

  return [...required];
}
