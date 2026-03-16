# CLAUDE.md — AI Assistant Guide for 大海撈Ｂ (Find My Kid)

## Project Overview

**大海撈Ｂ** is an offline, privacy-first Windows desktop application that uses AI face recognition to identify photos of a specific child from large photo collections. All processing is local — no photos or embeddings are ever uploaded to the cloud.

- **App Name**: 大海撈Ｂ (da-hai-lao-b)
- **Version**: 0.2.1
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
| Packaging | electron-builder 25.1.8 |

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
npm run build         # Full build (main + preload + renderer)
npm run clean         # Remove dist/ and out/
npm run dist:win      # Windows installer (.exe)
npm run dist:mac      # macOS (.dmg)
npm run dist:linux    # Linux (AppImage + deb)
npm run release:win   # Production Windows release
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
│   └── performance.ts       # Batch processing + concurrency management
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
│   ├── components/          # 30+ React components
│   ├── hooks/               # Custom hooks (useScanState, useReviewState, etc.)
│   └── styles/theme.ts      # Glassmorphism theme + animations
│
├── types/                   # TypeScript interfaces
│   ├── api.ts               # IPC API types
│   ├── preload.d.ts
│   └── window.ts
│
└── utils/
    ├── logger.ts            # Centralized logging
    ├── error-handler.ts     # AppError class
    └── accessibility.ts

tests/
├── unit/                    # Vitest unit tests
│   ├── renderer/            # Component tests
│   ├── main/                # Main process tests
│   └── utils/               # Utility tests
└── e2e/                     # Playwright E2E tests
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
- Never treat deterministic embeddings as true face matches

### Caching Strategy
- SQLite DB at `%APPDATA%/find-my-kid-offline/` (Windows)
- Embeddings keyed by file path + mtime — stale entries auto-invalidated
- In-memory LRU cache capped at **50,000** entries
- Thumbnails cached in `thumbs/` subdirectory

### Batch Processing
- Default: 50 photos/batch, 4 concurrent tasks
- Eco mode: 20 photos/batch, 2 concurrent tasks
- Scans support **pause/resume/cancel** via Promise-based signaling

---

## Key IPC Channels

| Channel | Description |
|---------|-------------|
| `embed:references` | Extract embeddings from reference photos |
| `embed:batch` | Scan folder + extract all embeddings |
| `match:run` | Similarity matching with threshold/topN options |
| `scan:pause` / `scan:resume` / `scan:cancel` | Scan flow control |
| `scan:performance-mode` | Set `'default'` or `'eco'` batch mode |
| `export:copy` | Copy matched photos to output folder |
| `scan:clear-cache` | Clear SQLite embeddings cache |
| `dialog:open-files` | Native file picker |
| `dialog:open-folder` | Native folder picker |
| `model:status` | Check if AI model is loaded |
| `assess:photo-quality` | Evaluate reference photo quality |
| `growth:*` | Growth record CRUD operations |

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
- `as any` casts are acceptable in IPC bridge types (ESLint warns, not errors)
- `@ts-comment` directives are warnings, not errors
- Prefer `const` over `let`; never `var`

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
- React hooks rules enforced
- `console.*` calls generate warnings (use `logger.ts` instead)
- `no-explicit-any` and `ban-ts-comment` are **warn**, not **error**

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

### Logging
Always use `logger.ts`, not `console.*`:
```typescript
import { logger } from '../utils/logger';
logger.info('Starting scan...');
logger.error('Face detection failed', error);
```

---

## Security & Privacy Rules

1. **Never add cloud uploads** — all processing must stay local
2. **Only allow HTTPS** in `shell:open-external` IPC handler
3. **Validate file paths** with `existsSync` before reading
4. **Context isolation** must remain enabled in preload
5. **No telemetry** — the app intentionally has zero analytics

---

## Testing Guidelines

### Unit Tests (Vitest)
- Test files: `*.test.ts` / `*.test.tsx`
- Located in `src/core/` (alongside source) and `tests/unit/`
- Run with `npm test`

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

---

## Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Technical documentation |
| `CHANGELOG.md` | Version history |
| `HELP.md` | User FAQ |
| `PLAN.md` | Product planning notes |
| `CODE_REVIEW.md` | Code review guidelines |
| `AGENTS.md` | AI agent instructions |
| `docs/用戶指南.md` | Traditional Chinese user guide |
| `docs/optimization-acceptance-spec.md` | Optimization acceptance criteria |

---

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Run `npm run release:check` (pre-release validation)
4. Run `npm run release:win` (unsigned) or `npm run release:win:with-sign` (code-signed)
5. Installer output: `dist-electron/大海撈Ｂ-{version}-Setup.exe`
6. GitHub Releases auto-upload is handled by `electron-builder` with the GitHub provider

**Code signing** requires env vars: `CSC_LINK` and `CSC_KEY_PASSWORD`

---

## System Requirements (Development)

- **Node.js**: 22+
- **OS**: Windows 10/11 64-bit (primary), macOS, Linux
- **RAM**: 4GB minimum, 8GB recommended for large scans
- **Python**: 3.8+ (legacy test scripts only)
