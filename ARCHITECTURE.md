# معماری

فرانت‌اند و route handlerهای API در Next.js App Router هستند. لایه‌های `src/server` شامل Prisma، احراز هویت نشست‌محور، مجوز حوزه‌ای، audit، adapter ورود و موتور محاسبه است. رابط‌ها از دادهٔ سرور می‌خوانند و هر mutation از route handler اعتبارسنجی Zod و کنترل permission دارد.

رویداد خام (`RawAttendanceEvent`) immutable و fingerprint شده است. `recalculateAttendanceDay` با policy مؤثر، leave/off-time/correction تأییدشده، رویدادها را به `AttendanceDay` و sessionها تبدیل می‌کند و idempotent است. policy نسخه‌دار است؛ گزارش‌ها به `AttendanceDay` محدود و scope شده‌اند.

PostgreSQL و فایل‌های خصوصی دو volume جدا دارند. entrypoint قبل از start، `prisma migrate deploy` را اجرا می‌کند و seed bootstrap/demo به‌صورت idempotent اجرا می‌شود.
