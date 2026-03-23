# CLAUDE.md — AI Assistant Guide for 大海撈Ｂ (Find My Kid)

## Project Overview

**大海撈Ｂ** is an offline, privacy-first Windows desktop application that uses AI face recognition to identify photos of a specific child from large photo collections. All processing is local — no photos or embeddings are ever uploaded to the cloud.

- **App Name**: 大海撈Ｂ (da-hai-lao-b)
- **Version**: 0.2.25
- **Type**: Electron desktop app (Windows primary, macOS/Linux supported)
- **Primary UI Language**: Traditional Chinese
- **Stack**: React 18 + TypeScript + Electron + InsightFace ONNX (SCRFD + ArcFace) + SQLite

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 31.5.0 |
| UI | React 18.3.1 + TypeScript 5.6.3 |
| Build | Vite 5.4.10 + tsup |
| AI/ML | InsightFace SCRFD det_500m + ArcFace w600k_mbf (onnxruntime-node 1.20.1) |
| Image Processing | Sharp 0.33.5 |
| Database | better-sqlite3 11.7.0 (local SQLite) |
| Testing | Vitest 2.1.4 + Playwright 1.48.2 |
| Packaging | electron-builder 25.1.8 + electron-updater 6.8.3 |
| Virtual Scrolling | react-window 2.2.7 |

---

## Essential Commands

### Development
```bash
npm run dev           # Start full dev environment (main + preload + renderer)
npm run dev:renderer  # Renderer only (Vite dev server on :5173)
npm run dev:main      # Watch mode for main process
npm run typecheck     # TypeScript type checking
```

### Testing
```bash
npm test              # Run unit tests (Vitest)
npm run test:watch    # Watch mode
npm run test:e2e      # E2E tests (Playwright)
npm run test:coverage # Coverage report
```

### Linting & Formatting
```bash
npm run lint          # ESLint with auto-fix
npm run lint:check    # ESLint check only (no fix)
npm run format        # Prettier format all files
npm run format:check  # Prettier check only
```

### Building & Packaging
```bash
npm run build            # Full build via scripts/build.mjs (main + preload + renderer)
npm run clean            # Remove dist/ and out/
npm run dist:win         # Windows installer (.exe)
npm run dist:mac         # macOS (.dmg)
npm run dist:linux       # Linux (AppImage + deb)
npm run release:win      # Production Windows release (unsigned)
npm run release:win:with-sign  # Production Windows release (code-signed)
npm run release:check    # Pre-release validation
```

---

## Directory Structure

```
/ (project root)
├── src/                     # Source code
├── tests/                   # Test files (unit + e2e)
├── electron/                # Alternate Electron entry point (preload/main)
├── models/insightface/      # ONNX model files (det_500m.onnx, w600k_mbf.onnx)
├── public/                  # Static assets
├── resources/               # App resources (icons, logos)
├── scripts/                 # Build scripts (*.mjs)
├── docs/                    # Extended documentation
├── .github/workflows/       # CI/CD (ci.yml, release-win.yml)
├── index.html               # Renderer SPA entry
├── vite.config.ts           # Vite config (dev server, :5173)
├── vite.renderer.config.ts  # Vite renderer production build config
├── vitest.config.ts         # Vitest configuration
├── playwright.config.ts     # Playwright E2E configuration
├── tsconfig.json            # TypeScript configuration
├── eslint.config.js         # ESLint flat config
│   # Legacy Python files (not active):
├── main.py, build_exe.py, requirements.txt, run_ref_test.py, etc.

src/
├── core/                    # AI and image processing logic
│   ├── detector.ts          # Face detection orchestration (SCRFD → align → ArcFace)
│   ├── scrfd.ts             # SCRFD det_500m ONNX detector (bbox + 5-point kps)
│   ├── align.ts             # Umeyama 5-point similarity transform → 112×112 alignment
│   ├── arcface.ts           # ArcFace w600k_mbf ONNX recognition (512-dim embedding)
│   ├── embeddings.ts        # Embedding extraction + deterministic fallback
│   ├── similarity.ts        # Cosine similarity matching
│   ├── db.ts                # SQLite cache for embeddings and thumbnails
│   ├── thumbs.ts            # Thumbnail generation (Sharp)
│   ├── childQualityAssessment.ts  # Photo quality evaluation
│   ├── photoEnhancer.ts     # Photo enhancement
│   ├── performance.ts       # Batch processing + concurrency management
│   ├── detector.test.ts     # Unit tests (co-located)
│   ├── embeddings.test.ts   # Unit tests (co-located)
│   └── similarity.test.ts   # Unit tests (co-located)
│
├── main/                    # Electron main process
│   ├── index.ts             # IPC handlers and app lifecycle (~1,450 lines)
│   ├── scanController.ts    # Scan state management (pause/resume/cancel)
│   ├── growthRecordManager.ts  # Growth records and session tracking
│   └── secureStore.ts       # Secure local storage
│
├── preload/
│   └── index.ts             # IPC bridge (context isolation)
│
├── renderer/                # React UI (Vite app)
│   ├── App.tsx              # Root component
│   ├── main.tsx             # React entry point
│   ├── components/          # 27 React components (PascalCase filenames)
│   ├── hooks/               # Custom hooks
│   │   ├── useScanState.ts      # Scan progress + results state
│   │   ├── useReviewState.ts    # Manual review decisions
│   │   ├── useFavorites.ts      # Favorite photo tracking
│   │   ├── useExportState.ts    # Export workflow state
│   │   └── useKeyboardShortcuts.ts  # Keyboard navigation
│   └── styles/theme.ts      # Glassmorphism theme + animations
│
├── types/                   # TypeScript interfaces
│   ├── api.ts               # IPC API types (core interfaces, ~294 lines)
│   ├── preload.d.ts         # Preload type declarations
│   ├── window.ts            # Window augmentation
│   ├── global.d.ts          # Global type declarations
│   └── externals.d.ts       # External module declarations
│
├── utils/
│   ├── logger.ts            # Centralized logging
│   ├── error-handler.ts     # AppError class
│   ├── path-validator.ts    # Path traversal prevention
│   ├── safe-storage.ts      # Safe localStorage wrapper (silently degrades on QuotaExceededError)
│   └── accessibility.ts     # Accessibility utilities
│
└── gui/                     # Legacy GUI directory (not active)

tests/
├── unit/                    # Vitest unit tests
│   ├── renderer/            # Component tests (MatchResultCard, OnboardingWizard, useScanState)
│   ├── main/                # Main process tests (growthRecordManager)
│   ├── core/                # Core logic tests (similarity, db)
│   └── utils/               # Utility tests (errorHandler)
└── e2e/                     # Playwright E2E tests (flow.e2e.test.ts, ui.spec.ts)
```

---

## Architecture Overview

### Process Communication (IPC)
All renderer ↔ main communication goes through Electron IPC. The preload script (`src/preload/index.ts`) exposes a typed `window.api` bridge with context isolation enabled.

IPC handlers return a consistent shape:
```typescript
{ ok: boolean; data?: T; error?: string }
```

### AI Pipeline
1. **Load reference photos** → `embed:references` → extract 512-dim ArcFace embeddings
2. **Scan target folder** → `embed:batch` → extract embeddings for all photos (cached in SQLite)
3. **Run matching** → `match:run` → cosine similarity, return top-N results sorted by score

**InsightFace detection pipeline** (per photo):
```
sharp 預處理 → SCRFD det_500m（bbox + 5 kps）→ Umeyama 對齊（112×112）→ ArcFace w600k_mbf（512-dim）
```
This mirrors Python `insightface.app.FaceAnalysis.get()` exactly.

### Deterministic Fallback
When face detection fails, the app falls back to a SHA-256 hash-based embedding. This allows the scan to continue but:
- Results are penalized by **0.12** in similarity scoring
- User is warned via the `deterministicFallback` flag
- Embedding source is tracked as `'face'` | `'deterministic'` | `'unknown'`
- Embedding dimensions: **512** (ArcFace) — deterministic fallback also generates 512-dim vectors
- Never treat deterministic embeddings as true face matches

### Caching Strategy
- SQLite DB at `%APPDATA%/find-my-kid-offline/` (Windows)
- Embeddings keyed by file path + mtime — stale entries auto-invalidated
- Legacy embeddings (missing `source` column) are auto-invalidated on upgrade
- In-memory LRU cache capped at **50,000** entries (~200MB)
- Thumbnails cached in `thumbs/` subdirectory

### Batch Processing
- Default: 50 photos/batch, 4 concurrent tasks
- Eco mode: 20 photos/batch, 2 concurrent tasks
- Scans support **pause/resume/cancel** via Promise-based signaling
- Memory threshold: 1GB — GC triggered if exceeded

### Multi-Reference Similarity Strategies
When multiple reference photos are provided, results are fused via:
- `'best'` — max similarity across all references (default)
- `'average'` — mean similarity
- `'weighted'` — face-detected refs weighted 2× vs 1×

---

## Key IPC Channels

### Core / App
| Channel | Description |
|---------|-------------|
| `ping` | Health check → `'pong'` |
| `app:about` | App info (name, version, changelog) |
| `model:status` | Check if SCRFD + ArcFace models are loaded |
| `scan:folder` | Set the target scan directory |

### File Dialogs
| Channel | Description |
|---------|-------------|
| `dialog:open-files` | Native multi-file picker |
| `dialog:open-folder` | Native folder picker |
| `folder:open` | Open a folder in the OS file explorer |
| `shell:open-external` | Open URL in browser (HTTPS only) |

### AI & Embeddings
| Channel | Description |
|---------|-------------|
| `embed:references` | Extract embeddings from reference photos |
| `embed:batch` | Scan folder + extract all embeddings (cached) |
| `match:run` | Cosine similarity matching with threshold/topN/strategy options |
| `assess:photo-quality` | Evaluate reference photo quality → `QualityMetrics` |
| `enhance:photo` | Photo enhancement pipeline |

### Scan Control
| Channel | Description |
|---------|-------------|
| `scan:pause` / `scan:resume` / `scan:cancel` | Scan flow control |
| `scan:performance-mode` | Set `'default'` or `'eco'` batch mode |
| `scan:clear-cache` | Clear SQLite embeddings cache |

### Export
| Channel | Description |
|---------|-------------|
| `export:copy` | Copy matched photos to output folder |

### App Updates
| Channel | Description |
|---------|-------------|
| `update:check` | Check for available app updates |
| `update:download` | Download pending update |
| `update:install` | Install downloaded update |

### Growth Records
| Channel | Description |
|---------|-------------|
| `growth:save-record` | Save a growth record → `{id}` |
| `growth:get-records` | Retrieve all growth records |
| `growth:get-record` | Retrieve a single growth record by ID |
| `growth:delete-record` | Delete a growth record |
| `growth:add-event` | Add an event to an existing growth record |
| `growth:save-session` | Save a scan session → `{id}` |
| `growth:get-sessions` | Retrieve all scan sessions |

### Reminders
| Channel | Description |
|---------|-------------|
| `growth:get-reminders` | Get all pending reminders |
| `growth:mark-reminder-read` | Mark a reminder as read |
| `growth:dismiss-reminder` | Dismiss a reminder |
| `growth:check-reminders` | Check for new reminders to generate |

### Family & Sharing
| Channel | Description |
|---------|-------------|
| `growth:get-family-members` | Retrieve family members list |
| `growth:add-family-member` | Add a new family member |
| `growth:get-shared-albums` | Retrieve shared albums |
| `growth:create-shared-album` | Create a new shared album |

### Privacy & Data
| Channel | Description |
|---------|-------------|
| `data:export-all` | GDPR data export → writes file, returns `{filePath}` |
| `privacy:clear-old-sessions` | Delete scan sessions older than N days |

### Diagnostics
| Channel | Description |
|---------|-------------|
| `diagnostics:get-info` | Model status, log paths, platform info |
| `diagnostics:get-log-tail` | Last N lines of the app log file |

### IPC Events (renderer ← main)
| Event | Description |
|-------|-------------|
| `scan:progress` | Emitted during scan with `ScanProgress` payload |
| `update:status` | Emitted during update check/download with `UpdateStatus` |

---

## TypeScript Conventions

### Path Aliases (tsconfig.json)
```typescript
@renderer/*   // src/renderer/
@main/*       // src/main/
@preload/*    // src/preload/
@core/*       // src/core/
```

### Coding Style
- **Strict mode** enabled — no implicit any
- `as any` casts are acceptable at IPC boundaries (ESLint warns, not errors)
- `@ts-comment` directives are warnings, not errors
- Prefer `const` over `let`; never `var`
- ESM module format (`"type": "module"` in package.json)

### Prettier Config
```json
{
  "semi": true,
  "singleQuote": true,
  "printWidth": 100,
  "trailingComma": "es5",
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

### ESLint Rules (flat config in `eslint.config.js`)
- React hooks rules enforced (`rules-of-hooks` error, `exhaustive-deps` warn)
- `no-console` warns — use `logger.ts` instead (allows `warn`/`error`)
- `no-explicit-any`, `ban-ts-comment`, and `no-non-null-assertion` are **warn**, not **error**
- `no-require-imports` is **off**
- `prefer-const` and `no-var` are **error**
- Unused vars matching `^_` pattern are ignored

---

## React Patterns

### State Management
- Custom hooks only — no Redux or Zustand
- Key hooks: `useScanState`, `useReviewState`, `useExportState`, `useFavorites`, `useKeyboardShortcuts`
- Settings persisted to `localStorage`
- Real-time scan progress via IPC events

### Component Structure
- PascalCase filenames for components (e.g., `MatchResultCard.tsx`)
- Glassmorphism styling via inline CSS and `theme.ts`
- Virtual scrolling for results list via `react-window`
- Keyboard shortcuts: Ctrl+S, Ctrl+R, Ctrl+E, Ctrl+C, F1, Esc

### Key Components
All components live in `src/renderer/components/` with PascalCase filenames.

**Onboarding & Setup**
- `OnboardingWizard` — Initial setup wizard for new users
- `WelcomeState` — Empty-state welcome screen

**Scan & Input**
- `DragDropZone` — Reference photo drag-and-drop
- `ScanControls` — Scan start/pause/resume/cancel buttons
- `ScanWarningsPanel` — Warnings surfaced during scan (e.g. low-quality refs)
- `ModernProgress` — Animated progress bar with ETA display
- `ProgressBar` — Simple progress bar primitive

**Reference Photo Quality**
- `ReferencePhotoQualityCard` — Per-photo quality score card
- `RefPhotoFeedback` — Inline feedback on reference photo issues
- `TaskReadinessCard` — Readiness summary before starting a scan

**Results & Review**
- `MatchResultCard` — Individual match result display with similarity score
- `ResultsSection` — Results list container with virtual scrolling
- `NoMatchesSection` — Empty-state when no matches found
- `SwipeReview` — Swipe-based photo review interface

**Export**
- `ExportPreviewModal` — Export preview and confirmation
- `ExportSuccessModal` — Success confirmation after export

**AI & Analysis**
- `AIAnalysisPanel` — AI face analysis display
- `ImagePreview` — Full-size image preview modal

**Settings & Privacy**
- `PrivacySettingsPanel` — Privacy and data-retention settings

**Updates & Info**
- `UpdateBanner` — Auto-update notification
- `HelpModal` — In-app help and FAQ

**Layout & Primitives**
- `ModernLayout` — App shell layout wrapper
- `ModernButton` — Styled button primitive
- `GlassCard` — Glassmorphism card container
- `StatusBadge` — Status indicator chip
- `LoadingSpinner` — Loading indicator
- `ErrorBoundary` — React error boundary for crash isolation

### Logging
Always use `logger.ts`, not `console.*`:
```typescript
import { logger } from '../utils/logger';
logger.info('Starting scan...');
logger.error('Face detection failed', error);
```

---

## Core Module Reference

### `src/core/scrfd.ts`
- `loadSCRFD()` — Load `det_500m.onnx` via onnxruntime-node
- `detectFacesSCRFD(imagePath, options)` — SCRFD inference → bbox `[x1,y1,x2,y2]` + 5 keypoints
- `getSCRFDStatus()` — Check if SCRFD session is loaded
- `resetSCRFD()` — Reset session for retry
- Input: BGR, `(px-127.5)/128.0`, 640×640; outputs: 9 tensors (score/bbox/kps × stride 8/16/32)
- Applies sigmoid to raw scores + IoU NMS (threshold 0.4)
- Anchor centers use cell center `(col+0.5)*stride` per InsightFace convention — do NOT use `col*stride` (top-left), which causes 4–16px keypoint offsets
- **EXIF rotation**: uses `.rotate()` (auto-rotate by EXIF) before inference — images are always processed upright. `effectiveW/H` accounts for dimension swap on orientation 5–8.
- Default `maxSize=2048` — pre-shrinks image before 640×640 SCRFD input; returned coordinates are in `effectiveW×effectiveH` space (post-rotation, post-maxSize)

### `src/core/align.ts`
- `alignFace(imageBuffer, imageWidth, imageHeight, kps, outputSize?, exifOrientation?)` — Umeyama → 112×112 aligned raw RGB buffer
- `umeyama2D(src, dst)` — Least-squares 2×3 affine similarity transform (6-parameter)
- `ARCFACE_DST_5PT` — Standard ArcFace 112×112 template coordinates
- Uses **pure-JS inverse bilinear warp** (NOT Sharp `.affine()`): for each 112×112 output pixel, compute source position via inverse Umeyama matrix, then bilinear interpolate. This guarantees exactly 112×112 output regardless of face scale.
- Auto-crops face region (KPS bbox + 50% padding) when input exceeds 4MP to avoid Sharp affine pixel limit
- `exifOrientation` is always passed as `1` by `detector.ts` (EXIF rotation already applied via Sharp `.rotate()`); `transformKpsForOrientation()` is defensive code for future use

### `src/core/arcface.ts`
- `loadArcFace()` — Load `w600k_mbf.onnx` via onnxruntime-node
- `extractArcFaceEmbeddingFromAligned(alignedRawRgb)` — Primary entry; accepts 112×112 raw RGB buffer
- `extractArcFaceEmbedding(imageBuffer, bbox, w, h)` — Legacy bbox-based entry (deprecated)
- `getArcFaceStatus()` — Check if ArcFace session is loaded
- Input: BGR NCHW `[1,3,112,112]`, `(px-127.5)/127.5`; output: 512-dim L2-normalized

### `src/core/detector.ts`
- `preloadModel()` — Load SCRFD + ArcFace in parallel
- `detectFaces(filePath, options)` — Full pipeline: SCRFD → Umeyama → ArcFace → `FaceDetection[]`
- `getModelStatus()` — Returns combined SCRFD + ArcFace load state
- 30-second timeout per detection; pure ONNX, no TF.js or Canvas required
- **`effectiveMaxSize`** — defaults to `options.maxSize ?? 2048`, applied to **both** SCRFD detection and the raw buffer read. Must be identical or SCRFD keypoints will point to wrong pixels in the buffer.
- **Adaptive confidence filter** — after SCRFD detection, if the top face scores ≥ 0.55, all candidates below 0.55 are discarded. Eliminates false-positive face clusters (score ~0.50–0.52) that produce random ArcFace embeddings.

### `src/core/embeddings.ts`
- `fileToEmbeddingWithSource(filePath, options)` — Returns `{ embedding, source }`
  - `options.referenceEmbeddings?: number[][]` — When provided and multiple faces detected, selects the face most similar to the reference centroid instead of the highest-confidence face. Used by `embed:batch` for group photo face selection.
- `selectReferenceEmbeddings(files, options)` — **Bootstrapped Centroid** reference photo face selection
  - Phase 1: extract all faces from all reference photos
  - Phase 2: single-face refs (guaranteed to be target child) → compute `initialCentroid`
  - Phase 3: multi-face refs → pick face most similar to `initialCentroid` (not highest-confidence, which is often a parent)
  - Fallback: if no single-face refs exist, falls back to highest-confidence selection
  - Used by `embed:references` IPC handler; fixes centroid contamination from parent/sibling faces
- `fileToEmbedding(filePath)` — Legacy backward-compatible wrapper
- `fileToDeterministicEmbedding(filePath, dims)` — SHA-256 hash fallback
- Constants: `EMBEDDING_DIMS = 512`, `DETERMINISTIC_SCORE_PENALTY = 0.12`

### `src/core/similarity.ts`
- `cosineSimilarity(a, b)` — Standard cosine similarity with dimension tolerance
- `multiReferenceSimilarity(target, refs, strategy)` — Multi-reference fusion (`best` | `average` | `weighted` | `centroid`)
- `computeCentroid(embeddings)` — Average N embeddings element-wise then L2-normalize → single prototype vector. Use this instead of `best` when you have multiple ref photos of the same child; eliminates the statistical inflation from N independent max comparisons.
- `euclideanDistance(a, b)` — L2 distance
- `normalizeVector(vec)` — L2 normalization

### `src/core/db.ts`
- SQLite singleton with WAL mode; schema migrates automatically
- `upsertFace(path, embedding, source)` — Store embedding with source tracking
- `getFacesByPath(path)` — Retrieve cached embeddings
- `withTransaction(fn)` — Wrap operations in a DB transaction
- `upsertPhotoAndFace(path, embedding, source)` — Combined photo+face upsert
- Auto-invalidates legacy cache entries missing the `source` column
- All DB operations validate paths via `path-validator.ts`

### `src/core/thumbs.ts`
- `generateThumbnail(filePath, outputPath, size?)` — Generate JPEG thumbnail via Sharp
- Thumbnails cached in `thumbs/` subdirectory of the SQLite data directory
- Default output size: 200×200 px (cover fit)

### `src/core/performance.ts`
- `processBatch<T, R>(items, fn, opts)` — Process with concurrency + progress callback
- `checkMemoryUsage()` — Triggers GC if heap > 1GB
- `getMetrics()` — Returns performance telemetry

### Co-located Tests in `src/core/`
- `detector.test.ts` — SCRFD + ArcFace pipeline tests
- `embeddings.test.ts` — Embedding extraction + fallback tests
- `similarity.test.ts` — Cosine similarity + multi-reference fusion tests

### `src/main/growthRecordManager.ts`
- CRUD operations for growth records (child photo milestones)
- Session tracking for scan sessions
- Reminder generation for growth checkpoints

### `src/main/scanController.ts`
- Scan state machine: idle → scanning → paused → cancelled
- Prevents race conditions in scan lifecycle

### `src/utils/path-validator.ts`
- `validatePath(p)` — Rejects path traversal (`..`, null bytes, etc.)
- Used by DB operations and IPC handlers

---

## Security & Privacy Rules

1. **Never add cloud uploads** — all processing must stay local
2. **Only allow HTTPS** in `shell:open-external` IPC handler
3. **Validate file paths** with `existsSync` before reading; use `path-validator.ts` for traversal prevention
4. **Context isolation** must remain enabled in preload
5. **No telemetry** — the app intentionally has zero analytics
6. **GDPR support** — `data:export-all` IPC enables full user data export; `privacy:clear-old-sessions` removes old scan data

---

## Testing Guidelines

### Unit Tests (Vitest)
- Test files: `*.test.ts` / `*.test.tsx`
- Located in `src/core/` (co-located: `detector.test.ts`, `embeddings.test.ts`, `similarity.test.ts`) and `tests/unit/`
- Run with `npm test`
- `globals: true` in vitest config — `describe`, `it`, `expect` available without imports
- Uses node environment; sharp and better-sqlite3 are inlined for test runs
- Single test: `npx vitest run src/core/similarity.test.ts`

### E2E Tests (Playwright)
- Located in `tests/e2e/` (`*.spec.ts` files)
- Tests full scan → match → export workflows
- Run with `npm run test:e2e`
- 60s timeout per test, headless mode, baseURL `http://localhost:5173`

### Before Committing
Always run:
```bash
npm run typecheck
npm run lint:check
npm test
```

---

## Build Outputs

| Directory | Contents |
|-----------|---------|
| `dist/` | Built main process (`main/index.cjs`), preload, renderer HTML |
| `dist-electron/` | Packaged installers |
| `out/` | Alternative output directory |

**Main entry** (after build): `dist/main/index.cjs`
**Renderer build**: `dist/renderer/index.html`

---

## Common Pitfalls

1. **Both ONNX models required** — `det_500m.onnx` (SCRFD) and `w600k_mbf.onnx` (ArcFace) must both be present in `models/insightface/`. Run `npm run download-models` if either is missing. Both are committed to the repo.

2. **Model must load before scanning** — Scans are blocked if SCRFD or ArcFace fails to load. Check `model:status` before allowing `embed:batch`. Both models load in parallel via `preloadModel()`.

3. **Dimension mismatch in embeddings** — All embeddings are **512-dim** (ArcFace). Deterministic fallback also produces 512-dim. Old cached embeddings from pre-v0.2.8 (1024-dim `@vladmandic/human`) are automatically invalidated by the SQLite schema migration.

4. **SCRFD score pre-sigmoid** — The `det_500m.onnx` from buffalo_sc outputs raw logits (NOT pre-sigmoided). `scrfd.ts` applies `1 / (1 + exp(-x))` before thresholding. Do not remove this step.

5. **Alignment is critical for ArcFace accuracy** — ArcFace was trained on Umeyama-aligned 112×112 faces. Skipping alignment (passing raw bbox crops) significantly degrades embedding quality, especially for tilted or side-facing photos.

6. **SQLite WAL mode** — The database uses WAL mode for performance. Do not switch to journal mode without benchmarking.

7. **Electron version compatibility** — Native modules (`better-sqlite3`, `sharp`, `onnxruntime-node`) must be rebuilt for the exact Electron version. Use `electron-rebuild` after changing Electron version.

8. **TypeScript strict mode** — Type assertions via `as any` are used sparingly at IPC boundaries. Avoid introducing them in core logic.

9. **Legacy embedding cache invalidation** — Starting v0.2.5, the SQLite schema was bumped and old cache entries without a `source` column are automatically invalidated on first run. v0.2.8 further invalidates pre-existing 1024-dim embeddings (incompatible with the new 512-dim ArcFace model).

10. **`perFileResults` type assertion** — In `src/main/index.ts`, `perFileResults` uses `as any` cast to avoid TS2339. This is intentional to handle IPC boundary types safely.

11. **asar unpacking for native modules** — `onnxruntime-node` depends on `onnxruntime-common`. Both must be in `asarUnpack` in `package.json`. If `onnxruntime-common` stays inside `app.asar`, `require('onnxruntime-common')` from the unpacked `onnxruntime-node` will fail with `Cannot find module 'onnxruntime-common'`. This only manifests in installed builds (not dev mode).

12. **Reference embedding timeout** — `embed:references` has a per-file timeout of 300s (line ~500 in `src/main/index.ts`). High-quality photos (e.g., 96% JPG) with 5 retry attempts can take significant time. The inner `detectFacesWithTimeout` has 120s per attempt.

13. **Sharp affine pixel limit** — Sharp's `.affine()` has an internal pixel limit (~4MP tested). Phone cameras producing 6000×4000 (24MP) images will trigger `Input image exceeds pixel limit`. `align.ts` handles this by auto-cropping the face region (keypoints bbox + 50% padding) before applying the affine transform. The constant `AFFINE_MAX_PIXELS = 4_000_000` controls the threshold.

14. **Sharp affine output canvas + `.extract()` required** — Sharp `.affine()` auto-sizes its output canvas based on the full transformed image. Do NOT use `.resize(112,112)` after `.affine()` — it squishes the whole canvas (e.g. 640×480) down to 112×112, reducing the face to ~20×20px. Instead compute the libvips auto-shift by forward-transforming the four input corners with the Umeyama M matrix, then use `.extract({ left: shiftX, top: shiftY, width: 112, height: 112 })` to retrieve the correct face region.

15. **SCRFD anchor centers must use cell center** — SCRFD anchor generation must use `(col + 0.5) * stride` for center coordinates per InsightFace convention. Using `col * stride` (cell top-left) shifts all keypoints by 4–16px, degrading Umeyama alignment and ArcFace accuracy.

16. **localStorage writes can throw** — Renderer-side `localStorage.setItem()` throws `QuotaExceededError` on storage-full or private-browsing contexts. Always use `src/utils/safe-storage.ts` (`safeSetItem` / `safeGetItem`) instead of `localStorage` directly to silently degrade rather than crash.

17. **DB cache version** — `CURRENT_CACHE_VERSION` in `src/core/db.ts` is currently **6**. Bump this when introducing pipeline changes that make cached embeddings invalid (e.g. EXIF rotation fix, coordinate space changes), so existing users' caches are automatically cleared on upgrade.

18. **SCRFD and detector must use the same `maxSize`** — SCRFD returns keypoints in `effectiveW×effectiveH` coordinate space (after rotation + maxSize resize). The `detector.ts` raw buffer read **must** use the exact same `maxSize` (default: 2048). If they differ, the keypoints point to the wrong pixels, alignment produces a background crop instead of a face, and ArcFace embeddings are garbage. Never pass `maxSize` to SCRFD without passing the same value to the raw buffer resize.

19. **EXIF rotation must be applied before SCRFD** — SCRFD was trained on upright faces. Phone portrait photos (EXIF orientation 6/8) have sideways pixels in the raw file. Always use Sharp `.rotate()` (no arguments = auto-rotate by EXIF) before feeding to SCRFD. Do NOT use `.withMetadata({ orientation: undefined })` for the SCRFD input — that disables auto-rotation and SCRFD will fail to detect faces in rotated photos.

20. **Multi-ref matching: use `centroid` not `best`** — With N reference photos, the `best` (max) strategy gives every scan face N chances to match, inflating scores for all faces uniformly (~60–80%). Use `computeCentroid(refEmbeddings)` to average all refs into one prototype vector first, then do a single cosine similarity. This produces a ~19% score gap between the matching child and others.

21. **Group photos: reference-guided face selection** — `fileToEmbeddingWithSource` stores only one face embedding per photo. By default it picks the highest-confidence face, but when `referenceEmbeddings` is provided (during batch scan), it computes the reference centroid and picks the face most similar to the target child instead. This is configured automatically in `embed:batch` — the handler extracts face-source reference embeddings and passes them as `referenceEmbeddings`. The SQLite schema still enforces `UNIQUE(photoPath)` (one face per path), but it's now the RIGHT face for the search target.

22. **`align.ts` orientation transform is defensive code, always receives `exifOrientation=1`** — `detector.ts` applies Sharp `.rotate()` before reading the raw buffer, so KPS from SCRFD are already in visual (post-rotation) coordinate space and `exifOrientation=1` is hardcoded before calling `alignFace()`. The `transformKpsForOrientation()` function supports orientations 2–8 for future use but is never triggered by current code. Do NOT remove it or change the hardcoded `exifOrientation=1` without updating the full pipeline EXIF handling.

23. **Reference photo face selection: use `selectReferenceEmbeddings()`, not `fileToEmbeddingWithSource()` per file** — When extracting reference embeddings, calling `fileToEmbeddingWithSource()` one photo at a time picks the highest-confidence face, which is often a parent (larger/clearer face) in family photos. This contaminates the centroid and breaks all downstream matching. Use `selectReferenceEmbeddings()` instead — it implements a bootstrapped centroid: builds an initial centroid from single-face photos (guaranteed to be the target child), then uses that centroid to pick the correct child face from multi-face photos. The `embed:references` IPC handler already uses this function.

---

## Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Technical documentation and project overview |
| `CHANGELOG.md` | Version history (v0.2.2→current) |
| `HELP.md` | User FAQ and troubleshooting |
| `PLAN.md` | Product planning notes and roadmap |
| `CODE_REVIEW.md` | Code review guidelines |
| `AGENTS.md` | AI agent instructions |
| `QWEN.md` | Qwen model integration documentation |
| `docs/README.md` | Docs index |
| `docs/用戶指南.md` | Traditional Chinese user guide |
| `docs/optimization-acceptance-spec.md` | Optimization acceptance criteria |
| `docs/product-optimization-mvp.md` | MVP optimization plan |
| `docs/Verification_Report.md` | QA/verification report |
| `docs/notion-landing-page.md` | Product landing page copy |

---

## CI/CD Workflows

### `ci.yml` (automatic)
- **Triggers:** Push to `main` or `develop`, PR to `main`
- **Test job** (ubuntu-latest, Node 20.x **and** 22.x matrix):
  1. `npm ci`
  2. `npm run typecheck`
  3. `npm run lint:check`
  4. `npm test`
  5. `npm run build`
- **Build Windows job** (windows-latest, Node 22.x) — depends on test:
  - Runs `npm run dist:win`, uploads `.exe` + `.blockmap` artifact (90-day retention)
- **Release job** — depends on test + build-windows, runs only on push to `main`:
  - Downloads Windows installer artifact
  - Creates/updates GitHub Release with auto-generated release notes
  - Release body includes Traditional Chinese installation instructions

### `release-win.yml` (manual dispatch)
- **Trigger:** `workflow_dispatch` with inputs:
  - `publish_release` (boolean, default: `true`) — whether to create a GitHub Release
  - `prerelease` (boolean, default: `false`) — mark release as pre-release
- Runs on windows-latest, Node 22.x
- Builds installer, uploads artifact (30-day retention), optionally publishes release

---

## Release Process

**每次推送都必須更新版本號**：因為 `electron-updater` 靠版本號偵測更新，不 bump 版本就無法觸發自動更新。每次 push 前務必：
1. Bump `package.json` 的 `version`（patch +1）
2. 更新 `CHANGELOG.md` 加入新版本條目
3. 更新 `CLAUDE.md` 的 `Version` 欄位

### 手動發布流程
1. Run `npm run release:check` (pre-release validation)
2. Run `npm run release:win` (unsigned) or `npm run release:win:with-sign` (code-signed)
3. Installer output: `dist-electron/da-hai-lao-b-{version}-Setup.exe`
4. GitHub Releases are handled via `electron-builder` with the GitHub provider (`samulee003/child-picture-select`)
5. Automated releases trigger via `ci.yml` on push to `main`; manual releases via `release-win.yml` workflow dispatch.

**Code signing** requires env vars: `CSC_LINK` and `CSC_KEY_PASSWORD`

---

## System Requirements (Development)

- **Node.js**: 20+ (CI tests on 20.x and 22.x)
- **OS**: Windows 10/11 64-bit (primary), macOS, Linux
- **RAM**: 4GB minimum, 8GB recommended for large scans
- **Supported image formats**: JPG, JPEG, PNG, GIF, BMP, WEBP, HEIC, HEIF
- **Python**: 3.8+ (legacy test scripts only)
