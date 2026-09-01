# Process Log - Podcast Summary Project

This file tracks all major modifications, updates, and feature additions to the project.

## Format
- **Date**: YYYY-MM-DD HH:MM
- **Type**: Feature, Fix, Enhancement, Refactor, Documentation
- **Component**: Where the change was made (Backend/Frontend/Both)
- **Description**: What was changed and why

---

## Log Entries

### 2026-09-01 — v1.1

Food review module, editable AI image cards, and provider resilience.

- **Type**: Feature
- **Component**: Both
- **Description**: Food reviews as a first-class summary type
  - New `food_reviews` table (migration `0003_food_reviews.sql`) with its own
    columns: `resto_name`, `description`, `date_visit`, `location`,
    `url_web_resto`, plus the shared `content` / `summary_generator_text` /
    `image_data_uri` used by the generate + export pipeline
  - Chosen over extending `summaries` so neither record type carries columns
    that are always NULL for the other
  - `backend/src/db/foodReviews.ts` + `routes/foodReviews.ts` — CRUD at
    `/api/food-reviews`; PATCH is partial, PUT is a full replace that still
    preserves a generated summary and photo unless explicitly sent
  - `date_visit` is a Postgres `date` (a visit is a calendar day, not an
    instant) and round-trips as plain `YYYY-MM-DD` with no timezone shift
  - Five views: FoodListView / New / Edit / Detail / Generate, mirroring the
    podcast flow, with a sortable + filterable table over the new columns
  - Registered migration `0002_food_summary.sql` in `meta/_journal.json`, which
    it had never been added to — `db:migrate` was silently skipping it. Both it
    and `0003` are idempotent so they apply either way.

- **Type**: Feature
- **Component**: Frontend
- **Description**: Tab navigation between Podcasts and Food reviews
  - Rebuilt `NavigationBar.vue` in the slate palette the app now uses
  - Active tab derives from the route, so deep links and refreshes land right

- **Type**: Feature
- **Component**: Both
- **Description**: Image export for food reviews — three styles, editable words
  - `lib/foodCard.ts`: sketchy / editorial / search layouts at 1080x1350,
    **4 arrangements each** (12 designs). "Regenerate layout" steps through
    them locally — no model call, because the free provider is rate-limited too
    often for design exploration to cost a request
  - Layouts are composed in code from text slots rather than model-written
    HTML. A model asked to place callouts over a photo it cannot see produced a
    different layout every run
  - `/api/ai/food-card` returns those slots as JSON, parsed defensively
    (code fences, leading prose and missing fields all fall back)
  - Words are fully editable in the preview, with live re-composition, and can
    come from **AI** or from **the review's own description and notes**
    (`cardFromReview`) with no model call at all
  - A variant only ever rearranges — it never hides a slot the user typed
  - Title size steps down with length, so a long raw description used as a
    title cannot collide with the tagline
  - All artwork is inline-SVG `<img>`; no gradients, filters or
    `background-image`, none of which html2canvas rasterises

- **Type**: Feature
- **Component**: Frontend
- **Description**: Image upload inside the rich text editor (both summary types)
  - `lib/image.ts` — shared downscale, file picker, and `firstImageInHtml`
  - Quill's stock image handler inserts at full resolution; ours downscales to
    1200px first (photo field: 1600px)
  - When no photo field is set, the export uses the first image embedded in the
    notes — that is where people actually put it. `data:` URIs only, since a
    remote URL has to survive html2canvas's CORS fetch at capture time
  - Raised `express.json` to 12mb: a base64 photo is ~33% larger than the file,
    and 1mb rejected any real phone photo

- **Type**: Fix
- **Component**: Both
- **Description**: AI provider no longer dies on one rate-limited model
  - `generateText` walks a fallback chain on 429/502/503/529. Free OpenRouter
    models share an upstream pool and 429 unpredictably, so any single choice
    fails part of the time
  - Only engages for OpenRouter `:free` models — a paid endpoint fails loudly
    rather than quietly answering as a different model
  - `TruncatedError` never falls back: that is the model's own ceiling
  - Configurable via `OPENAI_FALLBACK_MODELS` (empty disables it)
  - Provider errors are now readable prose instead of raw nested JSON
  - Raised the food-card token cap to 2500; several free fallbacks are
    reasoning models that spend output tokens before emitting any JSON

- **Type**: Fix
- **Component**: Frontend
- **Description**: Restored and repaired the AI generator entry points
  - `/summaries/:id/generate` had nothing linking to it — the row action was
    lost in an earlier revert. Restored, plus a button on the detail view
  - Converted `SummaryGenerateView`, `ExportModal` and `RichEditor` to slate:
    they referenced `.btn` / `.field` / `.label` / ink-paper tokens that had
    been deleted from `styles.css`, so the export modal rendered invisible
  - Export dialog is capped to `92vh` with only its body scrolling, and the
    image preview fits both axes — it was ~750px tall and pushed the download
    button off screen
  - Explicit z-order on the search and editorial layouts; a full-bleed photo
    variant was painting over its own search bar
  - Removed a duplicate "New" button (nav bar and list page both had one)


### 2026-08-23 14:55
- **Type**: Documentation
- **Component**: Both
- **Description**: Added comprehensive project documentation
  - Created FEATURES.md - User guide for all features
  - Created SETUP_GUIDE.md - Developer setup and configuration
  - Documented OCR capabilities and usage
  - Added troubleshooting guides and quick-start examples

### 2026-08-23 14:52
- **Type**: Enhancement
- **Component**: Frontend
- **Description**: Integrated SummaryForm with ImageScanner
  - Added write/scan mode toggle in SummaryForm.vue
  - Connected OCR scanner output to notes editor
  - Auto-append extracted text to existing content
  - Added preview of current notes while scanning
  - Improved UX with clear separation of input methods

### 2026-08-23 14:50
- **Type**: Feature
- **Component**: Frontend
- **Description**: Created navigation system for multiple summary types
  - Added NavigationBar.vue component with tab switching
  - Support for Podcast Notes (🎙️) and Food Reviews (🍽️)
  - Context-aware "New" button that creates correct type
  - Sticky navigation bar for easy access
  - Extensible design for adding more summary types

### 2026-08-23 14:50
- **Type**: Feature
- **Component**: Frontend
- **Description**: Implemented OCR (Optical Character Recognition) with Tesseract.js
  - Added ImageScanner.vue component for image-to-text extraction
  - Supports drag-and-drop file uploads
  - Real-time progress tracking during OCR
  - Supports: PNG, JPG, JPEG, GIF, WebP formats
  - Copy-to-clipboard functionality for extracted text
  - Browser-based processing (no server required)
  - Installed tesseract.js npm package

### 2026-08-23 14:50
- **Type**: Feature
- **Component**: Both
- **Description**: Created automated process logging system
  - Added .claude/hooks/process-log-hook.ts for change tracking
  - Automatic documentation of modifications
  - Categorizes changes by type and component
  - Git integration ready (pre-commit hook support)
  - Created PROCESS_LOG.md as main tracking file
  - Updated .claude/settings.local.json with hook permissions

### 2026-08-23 14:50
- **Type**: Enhancement
- **Component**: Both
- **Description**: Project initialization with full feature set
  - Backend: Express + Drizzle ORM + PostgreSQL
  - Frontend: Vue 3 + Vite + Tailwind CSS
  - Rich text editor with export capabilities
  - User identification system
  - API integration layer

---

## Upcoming Features

### Next up (v1.2)

- [ ] **Unit testing — the priority before further features.** The project has
      no test suite at all; everything so far has been verified by hand. Worth
      covering first, in rough order of payoff:
  - `backend/src/routes/foodReviews.ts` — `parseDateVisit` (valid / malformed /
    empty), the PATCH-vs-PUT contract, and per-user isolation
  - `backend/src/routes/ai.ts` — `parseCard` against fenced JSON, leading
    prose, partial objects and junk
  - `backend/src/ai/provider.ts` — the fallback chain: transient vs terminal
    status codes, `TruncatedError` not falling back, paid endpoints not
    falling back, the aggregate error message
  - `frontend/src/lib/foodCard.ts` — `cardFromReview` slot mapping,
    `titleSize` thresholds, and that every variant renders all four callouts
  - `frontend/src/lib/image.ts` — `firstImageInHtml` (data URI vs remote vs
    none vs malformed), and `downscaleImage` bounds
  - Suggested stack: Vitest for both sides, plus Supertest for the Express
    routes against a throwaway schema
- [ ] **Verify the PNG / PDF download end to end.** Never confirmed: html2canvas
      would not run in the verification browser, so only the previews are
      known good. Worth an explicit test or a manual pass.
- [ ] Reconcile the stale v1.0 docs — `IMPLEMENTATION_SUMMARY.md`,
      `FEATURES.md`, `ARCHITECTURE.md` and `SETUP_GUIDE.md` describe an OCR
      scanner wired into `SummaryForm` that was later reverted, and claim a
      test suite that does not exist
- [ ] Re-attach or remove `ImageScanner.vue` — the OCR component and its
      `tesseract.js` dependency are still in the tree but nothing imports them
- [ ] Convert `ConfirmDialog.vue` off the deleted ink-paper tokens before
      wiring it up anywhere

### Later

- [ ] Advanced image processing options
- [ ] Multi-language OCR support
- [ ] Batch image processing
- [ ] Cloud storage integration
- [ ] Real-time collaboration

---

## Notes
- All changes are tracked in git commits
- Major architectural decisions are documented in individual component files
- Test coverage to be added in future releases
