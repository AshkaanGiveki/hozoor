import { describe, expect, it } from "vitest";
import { fingerprint, parseDelimited } from "@/server/import-engine";

describe("attendance import adapters", () => {
  it("parses the canonical event shape", () => {
    const rows = parseDelimited("employeeCode,timestamp,type\n1001,2025-02-02T09:00:00Z,IN\n1001,2025-02-02T17:00:00Z,OUT", { adapter: "manual", externalId: "employeeCode", timestamp: "timestamp", type: "type" });
    expect(rows).toHaveLength(2);
    expect(rows[0].type).toBe("IN");
  });

  it("auto-detects ZKTeco date/time/status columns", () => {
    const rows = parseDelimited("PIN,Date,Time,Status,Verify,WorkCode\n1001,2025-02-02,09:00:00,0,1,0\n1001,2025-02-02,17:00:00,1,1,0");
    expect(rows.map((row) => row.type)).toEqual(["IN", "OUT"]);
    expect(rows[0].externalId).toBe("1001");
  });

  it("auto-detects Suprema event time and T&A labels", () => {
    const rows = parseDelimited("Date,Time,User ID,User Name,Device Name,T&A,Event\n2025-02-02,09:00:00,1001,Ali,Front Door,Clock-In,Authentication\n2025-02-02,17:00:00,1001,Ali,Front Door,Clock-Out,Authentication");
    expect(rows.map((row) => row.type)).toEqual(["IN", "OUT"]);
  });

  it("converts daily first-in/last-out summaries into two events", () => {
    const rows = parseDelimited("Employee ID,Date,First In,Last Out,Worked Minutes\n1001,2025-02-02,09:00:00,17:00:00,480");
    expect(rows).toHaveLength(2);
    expect(rows[0].type).toBe("IN");
    expect(rows[1].type).toBe("OUT");
  });

  it("supports semicolon-delimited exports and stable fingerprints", () => {
    const row = parseDelimited("User ID;Date;Time;Status\n1001;2025-02-02;09:00:00;0")[0];
    expect(row.type).toBe("IN");
    expect(fingerprint("device", row)).toBe(fingerprint("device", row));
  });
});
