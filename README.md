# Nourish

Monorepo: Bun workspaces + Turborepo.

## Project Structure

```
.env                         Secrets (gitignored), loaded via Vite's loadEnv
packages/
  web/                       Unified server (API + web frontend via Vite)
    vite.config.ts           Vite 7 config — loads .env, sets port, registers plugins
    index.html               Frontend HTML entry
    vite/plugins/
      hono-dev-plugin.ts     Intercepts /api/* in dev, forwards to Hono via SSR
    src/
      api/
        index.ts             Hono routes (.basePath('api')) + AppType export
        database/
          index.ts           Database client (Turso/LibSQL)
          schema.ts          Drizzle schema
      web/
        main.tsx             App entry
        app.tsx              Root component + Wouter routing
        pages/               Page components
        components/          UI components
        hooks/
          use-desktop.ts     Desktop detection
        lib/
          api.ts             Typed API client (hono client)
          desktop.ts         Electron API types
          utils.ts           Shared utilities
        styles.css           Tailwind CSS entry
  mobile/                    Expo + React Native + expo-router
    app/                     File-based routing
    lib/
      api.ts                 Typed API client
  desktop/                   Electron shell (loads web app from server)
    electron/
      main.ts                Main process + IPC handlers
      preload.ts             contextBridge API
    vite.config.ts           Vite config
```

## Environment Variables

Secrets and credentials live in `.env` at the project root (gitignored). Vite's `loadEnv` loads them into `process.env` at dev/build time (configured in `packages/web/vite.config.ts`). In API code (Hono), use `process.env.YOUR_VAR`. In browser code, only `VITE_`-prefixed vars are exposed via `import.meta.env.VITE_YOUR_VAR`. Drizzle scripts use `bun --env-file=../../.env` to load env vars directly.

## Desktop UI

The desktop app has no separate renderer by default. It loads the web app from `packages/web`; desktop-specific UI should live in `packages/web/src/web/` and be gated with `useDesktop()` / `window.electronAPI`. Keep `packages/desktop` for Electron window setup, menus/tray/shortcuts, IPC handlers, native OS APIs, and packaging. Only add a separate desktop renderer when the product intentionally needs a different desktop-only UI architecture.

## Servers

Dev servers are started and managed automatically — no need to run them manually.

## Vercel

This repo now includes Vercel config for both the repo root and the `packages/web` workspace, because Vercel monorepo detection may run the project from either location depending on your dashboard settings.

- Install command: `bun install`
- Build command: `cd packages/web && bun run build`
- Output directory: `packages/web/dist`
- SPA routing: non-file requests fall back to `index.html`
- API routes: `/api/*` are served by [api/[[...route]].ts](/home/avinyaa/Nourish-8688/api/[[...route]].ts:1)

If your Vercel project Root Directory is `packages/web`, the workspace-local config applies instead:

- Config: [packages/web/vercel.json](/home/avinyaa/Nourish-8688/packages/web/vercel.json:1)
- Build command: `bun run build`
- Output directory: `dist`
- API routes: `/api/*` are served by [packages/web/api/[[...route]].ts](/home/avinyaa/Nourish-8688/packages/web/api/[[...route]].ts:1)

If Vercel already has old settings saved for this project, clear them or set:

- Preferred with current logs:
- Root Directory: `packages/web`
- Framework Preset: `Vite`
- Install Command: `bun install`
- Build Command: `bun run build`
- Output Directory: `dist`

- Alternate repo-root setup:
- Root Directory: `.`
- Framework Preset: `Vite`
- Install Command: `bun install`
- Build Command: `cd packages/web && bun run build`
- Output Directory: `packages/web/dist`

## Database

```sh
cd packages/web
bun run db:push        # Push schema to database
bun run db:generate    # Generate migration files
bun run db:migrate     # Run migrations
bun run db:studio      # Open Drizzle Studio
```
