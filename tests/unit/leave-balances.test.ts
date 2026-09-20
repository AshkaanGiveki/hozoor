import { describe, expect, it } from "vitest";
import { LedgerType } from "@prisma/client";
import { summarizeLeaveBalance } from "@/server/leave-balances";

describe("leave balance ledger", () => {
  it("reserves and consumes minutes while releasing rejected reservations", () => {
    const summary = summarizeLeaveBalance({
      id: "balance",
      employeeId: "employee",
      leaveTypeId: "leave",
      year: 2026,
      openingMinutes: 4800,
      leaveType: { name: "Annual leave", unit: "DAY" },
      transactions: [
        { type: LedgerType.REQUEST_RESERVED, minutes: 480 },
        { type: LedgerType.REQUEST_RELEASED, minutes: 480 },
        { type: LedgerType.REQUEST_RESERVED, minutes: 240 },
        { type: LedgerType.REQUEST_RELEASED, minutes: 240 },
        { type: LedgerType.REQUEST_CONSUMED, minutes: 480 },
      ],
    });
    expect(summary.availableMinutes).toBe(4320);
    expect(summary.reservedMinutes).toBe(720);
    expect(summary.releasedMinutes).toBe(720);
    expect(summary.consumedMinutes).toBe(480);
  });
});
