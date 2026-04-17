# Shared UI primitives: landing site components too context-coupled for cross-app re-export

**Source:** 2026-04-17 S10 — phase 59 task 59-02 scope pivot

Phase 59 task 59-02 PLAN suggested option (b): direct imports from vendor/get-anything-done/site/components/site/ with a re-export barrel. Reality check during implementation — the landing primitives have hard context deps:

  SiteSection   -> DevIdProvider, DevIdBandProvider, BandDevPanel, BandDevPanelGate, usePathname
  SiteSectionHeading -> @/lib/utils (cn), lucide icons
  SectionEpigraph    -> @/lib/utils, @/lib/epigraphs (landing data)
  MarketingShell     -> deeper context tree still

A re-export barrel would pull in the entire devid infrastructure, router hooks, and landing-specific data modules. Not tractable for a lean secondary app.

Pivot taken: planning-app authored its own minimal local primitives under apps/planning-app/components/ (AppShell, SectionHeading) + lib/cn.ts (clsx+tailwind-merge). Good for phase 59; duplication is tolerable at two consumers.

Proper extraction (a packages/ui-shared/ workspace package) is worth doing when:
  - a third consumer lands (a new app, or the planning-app's need outgrows local primitives), OR
  - a landing change forces planning-app UI to drift visibly out of sync

Likely trigger: phase 60-07 project-editor BYOK tab OR phase 50 apps/portfolio-v2 integration. File the package-extraction phase when one of those lands.
