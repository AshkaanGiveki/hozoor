# امنیت

رمزها با Argon2id، نشست‌ها با token تصادفی و hash در DB، cookie HttpOnly/SameSite و انقضای ۱۴ روزه نگهداری می‌شوند. پنج ورود ناموفق قفل موقت ایجاد می‌کند. reset/change رمز همهٔ نشست‌ها را invalidate می‌کند.

هر query operational با company و نقش/تیم scope می‌شود؛ employee از session استخراج می‌شود و client نمی‌تواند scope را جعل کند. فایل‌ها public نیستند و import با size limit، extension محدود، بدون macro/formula evaluation و fingerprint یکتا انجام می‌شود. CSV export فرمول‌های spreadsheet را خنثی می‌کند. audit log immutable و بدون رمز/توکن است.

برای استقرار واقعی، `SESSION_SECRET` تصادفی، HTTPS پشت reverse proxy، backup رمزگذاری‌شده و محدودکردن دسترسی شبکهٔ PostgreSQL ضروری است. فعال‌سازی SMTP و اتصال مستقیم دستگاه در این نسخه وجود ندارد.
