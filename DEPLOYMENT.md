# استقرار

`docker compose up -d --build` دو سرویس `app` و `db` را با healthcheck بالا می‌آورد. volumeهای `hozoor-postgres` و `hozoor-files` به‌ترتیب DB و upload/attachment/export را نگه می‌دارند. پورت با `APP_PORT` قابل تغییر است.

برای backup:

```bash
docker compose exec db pg_dump -U hozoor -d hozoor > hozoor.sql
docker run --rm -v hozoor-files:/data -v "$PWD":/backup alpine tar czf /backup/hozoor-files.tgz -C /data .
```

برای restore، سرویس را متوقف کنید، SQL را با `psql` به DB خالی وارد کنید و volume فایل را برگردانید. migrationهای نسخهٔ جدید قبل از start اجرا می‌شوند. در شبکهٔ شرکت، فقط پورت reverse proxy را expose و TLS را بیرون Docker terminate کنید.
