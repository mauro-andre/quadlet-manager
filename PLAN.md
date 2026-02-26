# Quadlet Manager - Project Scaffold Plan

## Context

Quadlet Manager is a web interface for managing Podman containers via Quadlets. No existing tool covers this gap (Portainer doesn't support Quadlets, Cockpit doesn't manage them, Podman Desktop is desktop-only). The project uses VeloJS, a custom fullstack framework (Hono + Preact SSR) that lives in the repo at `./velojs/`.

This plan scaffolds the MVP (v0.1): list quadlets, view container status, start/stop/restart, view logs, edit quadlet files, install/remove quadlets.

**Decisions made:**
- Run directly on host (no containerization for MVP)
- Support both rootful and rootless Podman via env vars
- UI in English
- CSS with Vanilla Extract (type-safe, zero-runtime CSS-in-TS)
- Dark/Light theme with localStorage persistence + inline script in `client-root.tsx` to apply theme before hydration (prevents flash of wrong theme)

---

## File Structure

```
quadlet-manager/
├── package.json                # Root project config
├── vite.config.ts              # Vite + veloPlugin()
├── tsconfig.json               # TypeScript config
│
└── app/                        # VeloJS application
    ├── routes.tsx              # Route definitions
    ├── server.tsx              # Server init (empty for MVP)
    ├── client.tsx              # Client init (CSS import)
    ├── client-root.tsx         # Root HTML shell
    │
    ├── styles/
    │   ├── global.css          # CSS reset, base styles
    │   └── theme.css.ts        # Vanilla Extract theme (vars, tokens)
    │
    ├── components/
    │   ├── AppShell.tsx        # Sidebar nav + main content wrapper
    │   ├── AppShell.css.ts     # Vanilla Extract styles
    │   ├── StatusBadge.tsx     # Colored status indicator
    │   ├── StatusBadge.css.ts  # Vanilla Extract styles
    │   ├── ActionButton.tsx    # Button with loading state
    │   ├── ActionButton.css.ts # Vanilla Extract styles
    │   ├── CodeEditor.tsx      # Textarea-based quadlet editor
    │   └── CodeEditor.css.ts   # Vanilla Extract styles
    │
    ├── dashboard/
    │   └── Dashboard.tsx       # Overview: container/quadlet counts
    │
    ├── containers/
    │   ├── ContainerList.tsx   # Table of all containers
    │   └── ContainerDetail.tsx # Inspect + logs + start/stop/restart
    │
    ├── quadlets/
    │   ├── QuadletList.tsx     # List all quadlet files
    │   ├── QuadletEdit.tsx     # Edit existing quadlet
    │   └── QuadletNew.tsx      # Create new quadlet
    │
    └── modules/                # Server-only services
        ├── podman/
        │   ├── podman.client.ts    # Unix socket HTTP client
        │   └── podman.types.ts     # API response types
        ├── quadlet/
        │   ├── quadlet.service.ts  # Read/write quadlet files
        │   └── quadlet.types.ts    # Quadlet file types
        └── systemd/
            └── systemd.service.ts  # systemctl + journalctl
```

---

## Route Map

| Path | Module | Loader | Actions |
|------|--------|--------|---------|
| `/` | Dashboard | containers + quadlets summary | -- |
| `/containers` | ContainerList | list all containers | -- |
| `/containers/:id` | ContainerDetail | inspect + logs | `action_start`, `action_stop`, `action_restart` |
| `/quadlets` | QuadletList | list quadlet files | `action_delete` |
| `/quadlets/new` | QuadletNew | -- | `action_create` |
| `/quadlets/:name` | QuadletEdit | get file content | `action_save` |

All pages wrapped by `AppShell` component (sidebar nav) via the route tree.

---

## Architecture Decisions

**Container lifecycle via systemctl, not Podman API.** Quadlet containers are systemd units. `systemctl start/stop/restart` is the correct way to manage them. Podman API is used only for reading state (list, inspect).

**Logs via journalctl.** The Podman API log endpoint uses binary framing that's complex to parse. `journalctl -u servicename` is simpler and gives the same output. Good enough for MVP.

**Podman API via Unix socket.** Using `node:http` with `socketPath` option. No external HTTP library needed.

**systemctl via execFile.** Using `node:child_process.execFile` (not `exec`) to avoid shell injection.

**Quadlet dir auto-detection.** Check `QUADLET_DIR` env var first, then detect rootful (`/etc/containers/systemd/`) vs rootless (`~/.config/containers/systemd/`).

**CSS with Vanilla Extract.** Type-safe, zero-runtime CSS-in-TypeScript. Styles are written in `.css.ts` files, compiled at build time by Vite. Provides theme variables via `createTheme`/`createThemeContract`, scoped class names, and full TypeScript autocomplete. No runtime cost — outputs plain CSS.

**Dark/Light theme.** Two themes defined via Vanilla Extract `createTheme` (dark + light CSS classes). Theme preference persisted in `localStorage` key `theme` (`"dark"` | `"light"`). An inline `<script>` in `client-root.tsx` reads localStorage and sets the theme class on `<html>` **before** any rendering — this prevents the flash of wrong theme (FOWT). A toggle component switches between themes at runtime and updates both the class and localStorage.

---

## Implementation Steps

### Step 1: Project config files
Create `package.json`, `tsconfig.json`, `vite.config.ts`.

`vite.config.ts` — minimal, just two plugins:
```typescript
import { defineConfig } from "vite";
import { veloPlugin } from "velojs/vite";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";

export default defineConfig({
    plugins: [veloPlugin(), vanillaExtractPlugin({ identifiers: "debug" })],
});
```

`package.json` scripts:
```json
{
    "dev": "velojs dev --host",
    "build": "velojs build",
    "start": "NODE_ENV=production velojs start",
    "typecheck": "tsc --noEmit"
}
```

`package.json` dependencies:
- `velojs` as `file:./velojs` (local)
- All VeloJS peer deps: `hono`, `preact`, `@preact/signals`, `wouter-preact`, `vite`, `@preact/preset-vite`, `@hono/vite-dev-server`
- Production deps: `@hono/node-server`, `preact-render-to-string`
- CSS: `@vanilla-extract/css`, `@vanilla-extract/vite-plugin`
- Dev deps: `typescript`, `tsx`, `@types/node`

### Step 2: VeloJS app shell
Create `app/server.tsx`, `app/client.tsx`, `app/client-root.tsx`, `app/styles/global.css`.

### Step 3: Service layer
Create `app/modules/` with all backend services:

**podman.client.ts** — `podmanRequest<T>(path, method)` helper using `node:http` + Unix socket. Functions: `listContainers()`, `inspectContainer(id)`.

**quadlet.service.ts** — Filesystem operations. Functions: `listQuadlets()`, `getQuadlet(filename)`, `saveQuadlet(filename, content)`, `createQuadlet(filename, content)`, `deleteQuadlet(filename)`.

**systemd.service.ts** — Shell commands via `execFile`. Functions: `startService(name)`, `stopService(name)`, `restartService(name)`, `getServiceStatus(name)`, `getServiceLogs(name, lines)`, `daemonReload()`.

### Step 4: Shared components
Create `AppShell.tsx`, `StatusBadge.tsx`, `ActionButton.tsx`, `CodeEditor.tsx`.

### Step 5: Dashboard page
Create `app/dashboard/Dashboard.tsx` with loader for overview data.

### Step 6: Container pages
Create `ContainerList.tsx` (loader: list containers) and `ContainerDetail.tsx` (loader: inspect + logs, actions: start/stop/restart).

### Step 7: Quadlet pages
Create `QuadletList.tsx` (loader: list files, action: delete), `QuadletEdit.tsx` (loader: file content, action: save), `QuadletNew.tsx` (action: create).

### Step 8: Routes and wiring
Create `app/routes.tsx` connecting everything.

### Step 9: Install and test
Run `npm install`, then `npm run dev` to verify the app starts.

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PODMAN_SOCKET` | `/run/podman/podman.sock` | Podman Unix socket path |
| `QUADLET_DIR` | Auto-detect | Quadlet files directory |
| `PORT` | `3000` | Server port |

---

## Verification

1. `npm install` completes without errors
2. `npm run dev` starts the Vite dev server
3. Browser at `http://localhost:3000` shows the dashboard
4. `/containers` lists containers from Podman API
5. `/quadlets` lists `.container`/`.network`/`.volume` files
6. Container start/stop/restart actions work via systemctl
7. Quadlet editor can read and save files
8. Creating a new quadlet writes the file and runs `daemon-reload`
