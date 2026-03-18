# EvidencePack AI (MVP Scaffold)

MVP scaffold for generating and maintaining audit-ready evidence packs for AI systems.

## Stack
- Next.js + TypeScript
- Prisma ORM
- PostgreSQL

## Local setup
1. Start PostgreSQL:
   - `docker compose up -d db`
2. Create local environment file:
   - `Copy-Item .env.example .env` (PowerShell)
3. Install dependencies:
   - `npm install`
4. Run the app (migrations + seed + dev server):
   - `npm run dev`

App URL: `http://localhost:3000`

## Scripts
- `npm run dev`: Run migrations, seed demo data, start Next dev server
- `npm run build`: Build production app
- `npm run start`: Start production app
- `npm run typecheck`: Run TypeScript checks
- `npm run db:migrate`: Create a new migration in development
- `npm run db:seed`: Reseed demo data
