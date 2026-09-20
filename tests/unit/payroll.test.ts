import { describe, expect, it } from "vitest";
import { checksumRules, validateLegalRules } from "@/server/payroll";

describe("payroll rule safety", () => {
  it("rejects incomplete legal rules", () => {
    expect(validateLegalRules({ workingDays: 30 })).toContain("Missing required");
  });

  it("accepts a complete non-negative rule set", () => {
    expect(validateLegalRules({ workingDays: 30, workingHoursPerDay: 7.3333, overtimeMultiplier: 1.4, employeeInsuranceRate: 0.07, employerInsuranceRate: 0.23, taxRate: 0.1 })).toBeNull();
  });

  it("creates a stable rule checksum", () => {
    expect(checksumRules({ taxRate: 0.1 })).toBe(checksumRules({ taxRate: 0.1 }));
  });
});
