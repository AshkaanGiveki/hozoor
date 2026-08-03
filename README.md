# Hozoor — سامانه حضور و مرخصی

نسخهٔ اول قابل‌اجرای سامانهٔ تک‌شرکتی حضور، مرخصی و مدیریت زمان کاری است. برنامه به‌صورت یک monolith ماژولار Next.js با PostgreSQL و Prisma اجرا می‌شود.

## اجرای سریع

```bash
docker compose up -d --build
```

سپس به [http://localhost:3000](http://localhost:3000) بروید. migration و seed در شروع سرویس انجام می‌شود.

حساب‌های نمونه: `admin` / `ChangeMe123!`، `hr` / `HrDemo123!`، `manager` / `Manager123!`، `employee1` / `Employee123!`. حساب admin در ورود اول تغییر رمز می‌خواهد؛ رمزهای نمونه را در محیط واقعی تغییر دهید.

## توسعه

```bash
corepack pnpm install
$env:DATABASE_URL="postgresql://hozoor:hozoor@localhost:5432/hozoor"; corepack pnpm prisma generate
corepack pnpm dev
```

فرمت CSV استاندارد: `employeeCode,timestamp,type`؛ فایل XLSX نیز با نگاشت ستون‌های wizard وارد می‌شود. ورود دوبارهٔ همان رکورد به‌واسطهٔ fingerprint یکتا duplicate محسوب می‌شود.

## کیفیت

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

جزئیات معماری، امنیت، مدل سیاست حضور و پشتیبان‌گیری در [ARCHITECTURE.md](ARCHITECTURE.md)، [SECURITY.md](SECURITY.md)، [DEPLOYMENT.md](DEPLOYMENT.md) و `docs/` آمده است.
