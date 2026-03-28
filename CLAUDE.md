# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev        # Watch mode with auto-reload
npm run build            # Compile TypeScript to dist/

# Testing
npm test                 # Run unit tests
npm run test:watch       # Unit tests in watch mode
npm run test:cov         # Unit tests with coverage
npm run test:e2e         # End-to-end tests (requires running DB)
npx jest path/to/file.spec.ts  # Run a single test file

# Code quality
npm run lint             # ESLint with auto-fix
npm run format           # Prettier format

# Database
npx prisma migrate dev   # Apply migrations and regenerate client
npx prisma generate      # Regenerate Prisma client after schema changes
npx prisma studio        # Open Prisma Studio GUI
```

## Architecture

NestJS REST API with Prisma ORM (PostgreSQL). Requires `DATABASE_URL` in `.env`.

**Module pattern:** Each feature lives in `src/<feature>/` with a module, controller, and service. `PrismaModule` is global — inject `PrismaService` anywhere without re-importing the module.

**Prisma client** (v7) is generated to `generated/prisma/` — import from `'<relative-path>/generated/prisma/client'`, not `'@prisma/client'`. Use the `Prisma` namespace for types: `import { PrismaClient, Prisma } from '.../generated/prisma/client'`.

**Current modules:**
- `PrismaModule` (global) — database connection, wraps PrismaClient lifecycle
- `UserModule` — user feature; `UserService` has `createUser()` / `getUsers()` backed by Prisma

App listens on `process.env.PORT ?? 3000`.
