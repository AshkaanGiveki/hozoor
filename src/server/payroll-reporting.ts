import { Prisma } from "@prisma/client";

export type PayrollRegisterRow = { employeeId: string; employeeCode: string; employeeName: string; departmentId: string | null; departmentName: string | null; gross: Prisma.Decimal; deductions: Prisma.Decimal; net: Prisma.Decimal; employerInsurance: Prisma.Decimal; paid: Prisma.Decimal; paymentStatus: string };

export function summarizePayrollRegister(rows: PayrollRegisterRow[]) {
  const groups = new Map<string, { departmentId: string | null; departmentName: string; employeeCount: number; gross: Prisma.Decimal; deductions: Prisma.Decimal; net: Prisma.Decimal; employerInsurance: Prisma.Decimal; paid: Prisma.Decimal; unmatched: number }>();
  for (const row of rows) {
    const key = row.departmentId ?? "unassigned";
    const current = groups.get(key) ?? { departmentId: row.departmentId, departmentName: row.departmentName ?? "Unassigned", employeeCount: 0, gross: new Prisma.Decimal(0), deductions: new Prisma.Decimal(0), net: new Prisma.Decimal(0), employerInsurance: new Prisma.Decimal(0), paid: new Prisma.Decimal(0), unmatched: 0 };
    current.employeeCount += 1;
    current.gross = current.gross.plus(row.gross);
    current.deductions = current.deductions.plus(row.deductions);
    current.net = current.net.plus(row.net);
    current.employerInsurance = current.employerInsurance.plus(row.employerInsurance);
    current.paid = current.paid.plus(row.paid);
    if (row.paymentStatus !== "PAID" || !row.paid.eq(row.net)) current.unmatched += 1;
    groups.set(key, current);
  }
  return [...groups.values()].map((group) => ({ ...group, gross: group.gross.toString(), deductions: group.deductions.toString(), net: group.net.toString(), employerInsurance: group.employerInsurance.toString(), paid: group.paid.toString() }));
}

export function reconcilePayrollTotals(rows: PayrollRegisterRow[], exportedNet?: Prisma.Decimal | null) {
  const calculatedNet = rows.reduce((sum, row) => sum.plus(row.net), new Prisma.Decimal(0));
  const paidNet = rows.filter((row) => row.paymentStatus === "PAID").reduce((sum, row) => sum.plus(row.paid), new Prisma.Decimal(0));
  const unmatched = rows.filter((row) => row.paymentStatus !== "PAID" || !row.paid.eq(row.net)).length;
  return { calculatedNet: calculatedNet.toString(), exportedNet: exportedNet?.toString() ?? null, paidNet: paidNet.toString(), unmatched, exportMatchesCalculated: exportedNet ? exportedNet.eq(calculatedNet) : null };
}
