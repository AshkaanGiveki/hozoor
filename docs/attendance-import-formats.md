# Attendance import formats

OnTyme accepts CSV, TXT, XLS, and XLSX attendance exports. The importer auto-detects common column names and preserves the original row in `sourceData`.

## Canonical event rows

```csv
employee_code,event_date,event_time,event_type,verification_method,device_id,source_record_id
E001,2026-09-21,07:58:12,IN,FINGERPRINT,DEVICE-001,DEVICE-001-000001
E001,2026-09-21,17:16:45,OUT,FINGERPRINT,DEVICE-001,DEVICE-001-000002
```

## ZKTeco / FaraTechno-style raw rows

```csv
PIN,Date,Time,Status,Verify,WorkCode
1001,2026-09-21,07:58:12,0,1,0
1001,2026-09-21,17:16:45,1,1,0
```

Automatic mode interprets common ATTLOG status codes as `0=IN`, `1=OUT`, `2=BREAK_END`, and `3=BREAK_START`. If the vendor software uses another mapping, use a manual mapping or device adapter instead of silently accepting an incorrect interpretation.

## Suprema BioStar-style rows

```csv
Date,Time,User ID,User Name,Device Name,T&A,Event
2026-09-21,07:58:12,1001,Ali Ahmadi,Front Door,Clock-In,Authentication
2026-09-21,17:16:45,1001,Ali Ahmadi,Front Door,Clock-Out,Authentication
```

## Daily summary rows

```csv
Employee ID,Date,First In,Last Out,Worked Minutes,Overtime Minutes
1001,2026-09-21,07:58:12,17:16:45,496,16
```

Daily summaries become an `IN` and `OUT` source event. Raw punches are preferred because they allow OnTyme to recalculate breaks, lateness, early departure, and overtime from the original evidence.

The UI accepts optional manual column names, but automatic detection is enabled by default. Employee IDs must match an employee code or a device mapping. Duplicate events are rejected by a device-scoped fingerprint, and unmatched employee IDs remain auditable instead of being assigned silently.
