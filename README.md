# tak-manager-api

A production-ready NestJS REST API template with PostgreSQL (via Prisma), structured logging, request validation, security hardening, and exception handling — built to be reused as a starting point for new projects.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | NestJS 11 |
| Language | TypeScript 5 |
| Runtime | Node.js 24 (via nvm) |
| ORM | Prisma 7 + `@prisma/adapter-pg` |
| Logger | Winston + nest-winston |
| Validation | class-validator + class-transformer |
| Security | Helmet, CORS, Throttler |
| Config | @nestjs/config (.env) |

---

## Project Structure

```
src/
├── main.ts                          # Bootstrap: logger, pipes, interceptors, security
├── app.module.ts                    # Root module: wires all global providers
│
├── common/
│   ├── filters/
│   │   ├── all-exceptions.filter.ts     # Catch-all HTTP exception handler
│   │   └── prisma-exceptions.filter.ts  # Prisma error → HTTP status mapper
│   ├── interceptors/
│   │   └── logging.interceptor.ts       # Logs every HTTP request + latency
│   └── logger/
│       └── logger.config.ts             # Winston config (dev: pretty, prod: JSON)
│
├── generated/
│   └── prisma/                      # Auto-generated Prisma client (do not edit)
│       └── client.ts                # Entry point — import from here
│
├── prisma/
│   ├── prisma.module.ts             # Global PrismaModule (no need to import elsewhere)
│   └── prisma.service.ts            # PrismaClient wrapper with driver adapter + lifecycle hooks
│
└── user/                            # Example feature module (copy to add new features)
    ├── user.module.ts
    ├── user.controller.ts
    ├── user.service.ts
    └── dto/
        └── create.user.dto.ts

prisma/
├── schema.prisma                    # Database schema definition
└── migrations/                      # Auto-generated migration history

prisma.config.ts                     # Prisma CLI config: datasource URL + migrations path
```

---

## Environment Variables

Create a `.env` file in the project root:

```env
# Required
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# Optional
PORT=3000
NODE_ENV=development          # Set to "production" for JSON log output
ALLOWED_ORIGIN=http://localhost:4200   # CORS origin whitelist
```

`DATABASE_URL` is used in two places:
- `prisma.config.ts` — for CLI commands (`migrate dev`, `generate`, `studio`)
- `PrismaService` constructor — passed to `PrismaPg` adapter at runtime

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Set up .env (see above)

# 3. Run database migrations and generate the Prisma client
npx prisma migrate dev

# 4. Start in development mode (watch + auto-reload)
npm run start:dev
```

> **Node.js version:** This project requires Node.js `>=20.19` (Prisma v7 requirement).
> The repo is set up for Node 24 via nvm. Open a new terminal and nvm will activate it automatically.

The API will be available at `http://localhost:3000` (or `PORT` from `.env`).

---

## Scripts

```bash
npm run start:dev        # Development server with watch mode
npm run build            # Compile TypeScript → dist/
npm run start:prod       # Run compiled output (use after build)

npm test                 # Unit tests
npm run test:watch       # Unit tests in watch mode
npm run test:cov         # Coverage report
npm run test:e2e         # End-to-end tests (requires a running DB)

npm run lint             # ESLint with auto-fix
npm run format           # Prettier format

npx prisma migrate dev   # Apply schema changes + regenerate client
npx prisma generate      # Regenerate client only (no migration)
npx prisma studio        # Open Prisma Studio GUI in browser
```

---

## Architecture

### Bootstrap (`main.ts`)

```
NestFactory.create(AppModule, { logger: WinstonLogger })
  ├── helmet()                         # Security headers
  ├── enableCors({ origin })           # CORS from ALLOWED_ORIGIN env var
  ├── ValidationPipe                   # Strips unknown fields, validates DTOs
  └── ClassSerializerInterceptor       # Respects @Exclude() / @Expose() on entities
```

Filters and the logging interceptor are **not** registered here — they're registered as `APP_FILTER` / `APP_INTERCEPTOR` providers inside `AppModule`. This is intentional: providers registered that way have full dependency injection (e.g., they can receive the logger), while `useGlobalFilters()` in `main.ts` does not support DI.

---

### Logging (`src/common/logger/`)

The logger is Winston backed by `nest-winston`. It replaces NestJS's built-in logger entirely, including internal framework logs (route mapping, bootstrap messages, etc.).

**Development** (`NODE_ENV` ≠ `production`):
```
2026-03-28 14:22:01 [HTTP] info: GET /user 200 +8ms
2026-03-28 14:22:05 [ExceptionFilter] warn: POST /user 409 — "A record with this value already exists"
```

**Production** (`NODE_ENV=production`):
```json
{"level":"info","message":"GET /user 200 +8ms","context":"HTTP","timestamp":"2026-03-28T14:22:01.000Z"}
```

JSON output is structured for log aggregators (Datadog, CloudWatch, Loki, etc.).

**Log levels by environment:**

| Environment | Level | What is logged |
|---|---|---|
| development | `debug` | debug, verbose, log, warn, error |
| production | `info` | log, warn, error |

**Injecting the logger in your own services:**

```typescript
import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class MyService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  doSomething() {
    this.logger.log('Something happened', 'MyService');
    this.logger.warn('Watch out', 'MyService');
    this.logger.error('Failed', error.stack, 'MyService');
  }
}
```

---

### HTTP Request Logging (`src/common/interceptors/logging.interceptor.ts`)

Automatically logs every incoming request after the response is sent:

```
GET /user/1 200 +12ms
POST /user 409 +5ms
```

Registered globally via `APP_INTERCEPTOR` in `AppModule`.

---

### Exception Handling (`src/common/filters/`)

Two filters are registered globally via `APP_FILTER`:

**`PrismaExceptionFilter`** — catches `Prisma.PrismaClientKnownRequestError` and maps Prisma error codes to HTTP responses:

| Prisma Code | HTTP Status | Message |
|---|---|---|
| P2002 | 409 Conflict | A record with this value already exists |
| P2025 | 404 Not Found | Record not found |
| P2003 | 400 Bad Request | Related record not found |
| others | 500 | Database Error |

**`AllExceptionFilter`** — catch-all fallback for everything else:
- `HttpException` → uses its status and message directly
- anything else → 500 Internal Server Error

Both filters log through Winston:
- `5xx` errors → `logger.error()` with full stack trace
- `4xx` errors → `logger.warn()` with status and message

All error responses follow a consistent shape:
```json
{
  "statusCode": 404,
  "timestamp": "2026-03-28T14:22:01.000Z",
  "path": "/user/999",
  "message": "Record not found"
}
```

---

### Validation (`ValidationPipe`)

Configured globally with:
- `whitelist: true` — strips any properties not declared in the DTO
- `forbidNonWhitelisted: true` — returns a 400 error if unknown properties are sent

DTOs use `class-validator` decorators:

```typescript
export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;
}
```

---

### Security

| Feature | Config | Location |
|---|---|---|
| Security headers | `helmet()` | `main.ts` |
| CORS | `origin: process.env.ALLOWED_ORIGIN` | `main.ts` |
| Rate limiting | 20 requests / 60 seconds per IP | `AppModule` (`ThrottlerModule`) |

---

### Database & Prisma (v7)

Prisma v7 made several breaking changes from earlier versions. This project is configured to handle all of them.

#### Connection URL

The `url` field was removed from `schema.prisma` in v7. The database URL is now split across two places:

**`prisma.config.ts`** — used by the Prisma CLI (`migrate`, `generate`, `studio`):
```typescript
import { defineConfig, env } from 'prisma/config';
import 'dotenv/config'; // v7 no longer auto-loads .env

export default defineConfig({
  datasource: { url: env('DATABASE_URL') },
  migrations: { path: 'prisma/migrations' },
});
```

**`PrismaService`** — used at runtime via the `@prisma/adapter-pg` driver adapter:
```typescript
constructor() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  super({ adapter });
}
```

#### Generated Client

The client is generated to `src/generated/prisma/` with `client.ts` as the entry point. Always import from that path:

```typescript
import { PrismaClient, Prisma, User } from '../generated/prisma/client';
// NOT from '@prisma/client'
```

The `Prisma` namespace contains all types and error classes:

```typescript
Prisma.PrismaClientKnownRequestError   // error class used in exception filter
Prisma.UserCreateInput                 // input types for service methods
```

#### VSCode Extension Warning

The Prisma VSCode extension currently shows `Argument "url" is missing in data source block "db"`. This is a **false positive** — the extension hasn't been updated to understand v7's `prisma.config.ts` approach yet. The CLI and runtime both work correctly without `url` in `schema.prisma`.

#### `tsconfig.build.json`

`prisma.config.ts` is a CLI-only file and is excluded from the app build to prevent TypeScript from widening `rootDir` beyond `src/`:

```json
{
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts", "prisma.config.ts"]
}
```

`PrismaService` extends `PrismaClient` and handles `$connect()` / `$disconnect()` via NestJS lifecycle hooks. `PrismaModule` is declared `global: true`, so you can inject `PrismaService` in any module without re-importing `PrismaModule`.

---

## API Endpoints

### Users

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/user` | `{ email, name }` | Create a user |
| `GET` | `/user` | — | Get all users |
| `GET` | `/user/:id` | — | Get user by ID |

---

## Adding a New Feature Module

Copy the `user` module as a template:

```bash
# 1. Generate scaffold
npx @nestjs/cli g module <feature>
npx @nestjs/cli g controller <feature>
npx @nestjs/cli g service <feature>

# 2. Add model to prisma/schema.prisma

# 3. Run migration
npx prisma migrate dev --name add_<feature>

# 4. Regenerate the Prisma client
npx prisma generate

# 5. Inject PrismaService into your new service (no module import needed)
# 6. Register the new module in AppModule imports[]
```

Import the generated types in your service:

```typescript
import { User } from '../generated/prisma/client';

async findById(id: number): Promise<User> {
  return await this.prisma.user.findFirst({ where: { id } });
}
```

The logger, validation, exception filters, rate limiting, and CORS are all global — they apply automatically to every new module you add.
