# Payroll pipeline E2E verification

The database-backed payroll pipeline test is intentionally gated so ordinary unit runs never mutate a developer or hosted database.

Start the isolated database and apply the project migrations:

```powershell
docker compose up -d db
$env:DATABASE_URL = "postgresql://hozoor:hozoor@127.0.0.1:5433/hozoor?schema=public"
$env:PAYROLL_E2E_DATABASE_URL = $env:DATABASE_URL
npx prisma migrate deploy
npm run db:seed
npx vitest run tests/integration/payroll-pipeline.test.ts
```

The test verifies one source of truth across attendance, calculated payroll runs, persisted report export, payment amount/status, reconciliation totals, and the provider-neutral integration payload. It cleans up its fixture records after completion.
