# CLAUDE.md — AI Assistant Guide for 大海撈Ｂ (Find My Kid)

## Project Overview

**大海撈Ｂ** is an offline, privacy-first Windows desktop application that uses AI face recognition to identify photos of a specific child from large photo collections. All processing is local — no photos or embeddings are ever uploaded to the cloud.

- **App Name**: 大海撈Ｂ (da-hai-lao-b)
- **Version**: 0.2.8
- **Type**: Electron desktop app (Windows primary, macOS/Linux supported)
- **Primary UI Language**: Traditional Chinese
- **Stack**: React 18 + TypeScript + Electron + TensorFlow.js (WASM) + SQLite

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 31.5.0 |
| UI | React 18.3.1 + TypeScript 5.6.3 |
| Build | Vite 5.4.10 + tsup |
| AI/ML | @vladmandic/human 2.10.0 + TensorFlow.js 4.22.0 (WASM backend) |
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
npm run build            # Full build (main + preload + renderer)
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
src/
├── core/                    # AI and image processing logic
│   ├── detector.ts          # Face detection (@vladmandic/human)
│   ├── embeddings.ts        # Embedding extraction + deterministic fallback
│   ├── similarity.ts        # Cosine similarity matching
│   ├── db.ts                # SQLite cache for embeddings and thumbnails
│   ├── thumbs.ts            # Thumbnail generation (Sharp)
│   ├── childQualityAssessment.ts  # Photo quality evaluation
│   ├── photoEnhancer.ts     # Photo enhancement
│   ├── performance.ts       # Batch processing + concurrency management
│   ├── detector.test.ts     # Unit tests (co-located)
│   └── embeddings.test.ts   # Unit tests (co-located)
│
├── main/                    # Electron main process
│   ├── index.ts             # IPC handlers and app lifecycle (600+ lines)
│   ├── growthRecordManager.ts  # Growth records and session tracking
│   └── secureStore.ts       # Secure local storage
│
├── preload/
│   └── index.ts             # IPC bridge (context isolation)
│
├── renderer/                # React UI (Vite app)
│   ├── App.tsx              # Root component
│   ├── main.tsx             # React entry point
│   ├── components/          # 30+ React components (PascalCase filenames)
│   ├── hooks/               # Custom hooks
│   │   ├── useScanState.ts      # Scan progress + results state
│   │   ├── useReviewState.ts    # Manual review decisions
│   │   ├── useFavorites.ts      # Favorite photo tracking
│   │   ├── useExportState.ts    # Export workflow state
│   │   └── useKeyboardShortcuts.ts  # Keyboard navigation
│   └── styles/theme.ts      # Glassmorphism theme + animations
│
├── types/                   # TypeScript interfaces
│   ├── api.ts               # IPC API types (core interfaces)
│   ├── preload.d.ts         # Preload type declarations
│   ├── window.ts            # Window augmentation
│   ├── global.d.ts          # Global type declarations
│   └── externals.d.ts       # External module declarations
│
├── utils/
│   ├── logger.ts            # Centralized logging
│   ├── error-handler.ts     # AppError class
│   └── accessibility.ts     # Accessibility utilities
│
├── components/              # Legacy shared components (EnhancedPreview, SetupWizard)
└── gui/                     # Legacy GUI directory

tests/
├── unit/                    # Vitest unit tests
│   ├── renderer/            # Component tests (MatchResultCard, OnboardingWizard, useScanState)
│   ├── main/                # Main process tests (growthRecordManager)
│   ├── core/                # Core logic tests (similarity, db)
│   └── utils/               # Utility tests (errorHandler)
└── e2e/                     # Playwright E2E tests (flow, UI specs)
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
1. **Load reference photos** → `embed:references` → extract 1024-dim face embeddings
2. **Scan target folder** → `embed:batch` → extract embeddings for all photos (cached in SQLite)
3. **Run matching** → `match:run` → cosine similarity, return top-N results sorted by score

### Deterministic Fallback
When face detection fails, the app falls back to a SHA-256 hash-based embedding. This allows the scan to continue but:
- Results are penalized by **0.12** in similarity scoring
- User is warned via the `deterministicFallback` flag
- Embedding source is tracked as `'face'` | `'deterministic'` | `'unknown'`
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

| Channel | Description |
|---------|-------------|
| `embed:references` | Extract embeddings from reference photos |
| `embed:batch` | Scan folder + extract all embeddings |
| `match:run` | Similarity matching with threshold/topN options |
| `scan:pause` / `scan:resume` / `scan:cancel` | Scan flow control |
| `scan:performance-mode` | Set `'default'` or `'eco'` batch mode |
| `scan:clear-cache` | Clear SQLite embeddings cache |
| `export:copy` | Copy matched photos to output folder |
| `dialog:open-files` | Native file picker |
| `dialog:open-folder` | Native folder picker |
| `model:status` | Check if AI model is loaded |
| `assess:photo-quality` | Evaluate reference photo quality |
| `enhance:photo` | Photo enhancement pipeline |
| `growth:save` | Save a growth record |
| `growth:get-all` | Retrieve all growth records |
| `growth:delete` | Delete a growth record |
| `growth:export-data` | GDPR data export |
| `update:check` | Check for app updates |
| `update:download` | Download pending update |
| `update:install` | Install downloaded update |

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
  "trailingComma": "es5"
}
```

### ESLint Rules
- React hooks rules enforced (`rules-of-hooks` error, `exhaustive-deps` warn)
- `no-console` warns — use `logger.ts` instead (allows `warn`/`error`)
- `no-explicit-any` and `ban-ts-comment` are **warn**, not **error**
- `prefer-const` and `no-var` are **error**

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
- Keyboard shortcuts: Ctrl+S, Ctrl+R, Ctrl+E, Ctrl+C, F1

### Key Components
- `OnboardingWizard` — Initial setup wizard for new users
- `SwipeReview` — Swipe-based photo review interface
- `AIAnalysisPanel` — AI face analysis display
- `UpdateBanner` — Auto-update notification
- `DragDropZone` — Reference photo drag-and-drop
- `MatchResultCard` — Individual match result display
- `ExportPreviewModal` — Export preview and confirmation

### Logging
Always use `logger.ts`, not `console.*`:
```typescript
import { logger } from '../utils/logger';
logger.info('Starting scan...');
logger.error('Face detection failed', error);
```

---

## Core Module Reference

### `src/core/detector.ts`
- `preloadModel()` — Load AI model asynchronously
- `detectFaces(filePath, options)` — Extract face detections + 1024-dim embeddings
- `getModelStatus()` — Check if model is loaded
- Uses FaceRes model; falls back at confidence 0.05 if 0.3 threshold fails
- 30-second timeout per detection; WASM backend (no TF-node or Canvas required in worker)

### `src/core/embeddings.ts`
- `fileToEmbeddingWithSource(filePath, options)` — Returns `{ embedding, source }`
- `fileToEmbedding(filePath)` — Legacy backward-compatible wrapper
- `fileToDeterministicEmbedding(filePath, dims)` — SHA-256 hash fallback
- Constants: `EMBEDDING_DIMS = 1024`, `DETERMINISTIC_SCORE_PENALTY = 0.12`

### `src/core/similarity.ts`
- `cosineSimilarity(a, b)` — Standard cosine similarity with dimension tolerance
- `multiReferenceSimilarity(target, refs, strategy)` — Multi-reference fusion
- `euclideanDistance(a, b)` — L2 distance
- `normalizeVector(vec)` — L2 normalization

### `src/core/db.ts`
- SQLite singleton with WAL mode; schema migrates from v1→v3 automatically
- `upsertFace(path, embedding, source)` — Store embedding with source tracking
- `getFacesByPath(path)` — Retrieve cached embeddings
- Auto-invalidates legacy cache entries missing the `source` column

### `src/core/performance.ts`
- `processBatch<T, R>(items, fn, opts)` — Process with concurrency + progress callback
- `checkMemoryUsage()` — Triggers GC if heap > 1GB
- `getMetrics()` — Returns performance telemetry

### `src/main/growthRecordManager.ts`
- CRUD operations for growth records (child photo milestones)
- Session tracking for scan sessions
- Reminder generation for growth checkpoints

---

## Security & Privacy Rules

1. **Never add cloud uploads** — all processing must stay local
2. **Only allow HTTPS** in `shell:open-external` IPC handler
3. **Validate file paths** with `existsSync` before reading
4. **Context isolation** must remain enabled in preload
5. **No telemetry** — the app intentionally has zero analytics
6. **GDPR support** — `growth:export-data` IPC enables user data export

---

## Testing Guidelines

### Unit Tests (Vitest)
- Test files: `*.test.ts` / `*.test.tsx`
- Located in `src/core/` (co-located) and `tests/unit/`
- Run with `npm test`
- Uses node environment; sharp and better-sqlite3 are inlined for test runs

### E2E Tests (Playwright)
- Located in `tests/e2e/`
- Tests full scan → match → export workflows
- Run with `npm run test:e2e`

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

1. **Canvas in main process** — `@vladmandic/human` requires Canvas. If face detection silently fails, check that the `canvas` npm package is available in the main process context. This was a past bug (fixed in PR #16).

2. **Model must load before scanning** — Scans are blocked if the AI model fails to load. Check `model:status` before allowing `embed:batch`.

3. **Dimension mismatch in embeddings** — `similarity.ts` handles mismatched vector lengths. Reference embeddings and photo embeddings must both be 1024-dim for accurate results.

4. **SQLite WAL mode** — The database uses WAL mode for performance. Do not switch to journal mode without benchmarking.

5. **Electron version compatibility** — Native modules (`better-sqlite3`, `sharp`, `canvas`) must be rebuilt for the exact Electron version. Use `electron-rebuild` after changing Electron version.

6. **TypeScript strict mode** — Type assertions via `as any` are used sparingly at IPC boundaries. Avoid introducing them in core logic.

7. **Legacy embedding cache invalidation** — Starting v0.2.5, the SQLite schema was bumped and old cache entries without a `source` column are automatically invalidated on first run. Do not rely on previously cached embeddings across this version boundary.

8. **`perFileResults` type assertion** — In `src/main/index.ts`, `perFileResults` uses `as any` cast to avoid TS2339. This is intentional to handle IPC boundary types safely.

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
| `docs/用戶指南.md` | Traditional Chinese user guide |
| `docs/optimization-acceptance-spec.md` | Optimization acceptance criteria |
| `docs/product-optimization-mvp.md` | MVP optimization plan |

---

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Run `npm run release:check` (pre-release validation)
4. Run `npm run release:win` (unsigned) or `npm run release:win:with-sign` (code-signed)
5. Installer output: `dist-electron/大海撈Ｂ-{version}-Setup.exe`
6. GitHub Releases are handled via `electron-builder` with the GitHub provider
7. CI/CD: GitHub Actions workflow handles Windows builds automatically on push

**Code signing** requires env vars: `CSC_LINK` and `CSC_KEY_PASSWORD`

---

## System Requirements (Development)

- **Node.js**: 22+
- **OS**: Windows 10/11 64-bit (primary), macOS, Linux
- **RAM**: 4GB minimum, 8GB recommended for large scans
- **Python**: 3.8+ (legacy test scripts only)
