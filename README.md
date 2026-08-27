# ANA Contest Demo

This repository is a pnpm monorepo containing the AquaSense Next.js client.

## Workspace layout

```text
apps/
  client/       Next.js application and Drizzle database resources
packages/       Reserved for future shared packages
```

The client owns its source code, static assets, Next.js configuration, database
schema, and Drizzle migrations. Environment files such as `.env.local` belong
in `apps/client` so both Next.js and the database scripts load them from the
application directory.

## Getting started

Install dependencies from the repository root:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Commands

Run the common commands from the repository root:

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm format
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

To run a client command directly, filter by its workspace package name:

```bash
pnpm --filter @ana-contest-demo/client <command>
```
