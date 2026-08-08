# استقرار

`docker compose up -d --build` دو سرویس `app` و `db` را با healthcheck بالا می‌آورد. volumeهای `ontyme-postgres` و `ontyme-files` به‌ترتیب DB و upload/attachment/export را نگه می‌دارند. پورت با `APP_PORT` قابل تغییر است.

برای backup:

```bash
docker compose exec db pg_dump -U ontyme -d ontyme > ontyme.sql
docker run --rm -v ontyme-files:/data -v "$PWD":/backup alpine tar czf /backup/ontyme-files.tgz -C /data .
```

برای restore، سرویس را متوقف کنید، SQL را با `psql` به DB خالی وارد کنید و volume فایل را برگردانید. migrationهای نسخهٔ جدید قبل از start اجرا می‌شوند. در شبکهٔ شرکت، فقط پورت reverse proxy را expose و TLS را بیرون Docker terminate کنید.
