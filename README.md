# EvidencePack AI (MVP Scaffold)

MVP scaffold for generating and maintaining audit-ready evidence packs for AI systems.

## Stack
- Next.js + TypeScript
- Prisma ORM
- SQLite (local development; `docker-compose.yml` is optional if you want PostgreSQL)

## Local setup
1. Create local environment file:
   - `Copy-Item .env.example .env` (PowerShell)
2. Install dependencies:
   - `npm install`
3. Run the app (migrations + seed + dev server):
   - `npm run dev`

The SQLite database file is created at `prisma/dev.db` (path from `DATABASE_URL` in `.env`).

App URL: `http://localhost:3000`

## Scripts
- `npm run dev`: Run migrations, seed demo data, start Next dev server
- `npm run build`: Build production app
- `npm run start`: Start production app
- `npm run typecheck`: Run TypeScript checks
- `npm run db:migrate`: Create a new migration in development
- `npm run db:seed`: Reseed demo data
