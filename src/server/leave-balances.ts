import { LedgerType, Prisma } from "@prisma/client";
import { db } from "./db";

export type LeaveBalanceSummary = {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  unit: "DAY" | "HOUR";
  year: number;
  openingMinutes: number;
  accruedMinutes: number;
  adjustmentMinutes: number;
  reservedMinutes: number;
  consumedMinutes: number;
  releasedMinutes: number;
  availableMinutes: number;
};

type Tx = Prisma.TransactionClient | typeof db;

export async function ensureLeaveBalance(tx: Tx, employeeId: string, leaveTypeId: string, year: number) {
  return tx.leaveBalance.upsert({
    where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
    update: {},
    create: { employeeId, leaveTypeId, year },
  });
}

export function summarizeLeaveBalance(balance: {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  openingMinutes: number;
  leaveType: { name: string; unit: "DAY" | "HOUR" };
  transactions: Array<{ type: LedgerType; minutes: number }>;
}): LeaveBalanceSummary {
  const totals = balance.transactions.reduce((result, transaction) => {
    if (transaction.type === LedgerType.ACCRUAL) result.accruedMinutes += transaction.minutes;
    if (transaction.type === LedgerType.MANUAL_ADJUSTMENT || transaction.type === LedgerType.CARRYOVER) result.adjustmentMinutes += transaction.minutes;
    if (transaction.type === LedgerType.REQUEST_RESERVED) result.reservedMinutes += Math.abs(transaction.minutes);
    if (transaction.type === LedgerType.REQUEST_CONSUMED) result.consumedMinutes += Math.abs(transaction.minutes);
    if (transaction.type === LedgerType.REQUEST_RELEASED || transaction.type === LedgerType.CANCELLATION) result.releasedMinutes += Math.abs(transaction.minutes);
    return result;
  }, { accruedMinutes: 0, adjustmentMinutes: 0, reservedMinutes: 0, consumedMinutes: 0, releasedMinutes: 0 });
  const availableMinutes = Math.max(0, balance.openingMinutes + totals.accruedMinutes + totals.adjustmentMinutes - totals.reservedMinutes - totals.consumedMinutes + totals.releasedMinutes);
  return { ...balance, leaveTypeName: balance.leaveType.name, unit: balance.leaveType.unit, ...totals, availableMinutes };
}

export async function getLeaveBalances(employeeId: string, year = new Date().getUTCFullYear()) {
  const balances = await db.leaveBalance.findMany({
    where: { employeeId, year },
    include: { leaveType: true, transactions: { select: { type: true, minutes: true } } },
    orderBy: { leaveType: { name: "asc" } },
  });
  return balances.map(summarizeLeaveBalance);
}

export async function getLeaveBalance(employeeId: string, leaveTypeId: string, year: number, tx: Tx = db) {
  const balance = await ensureLeaveBalance(tx, employeeId, leaveTypeId, year);
  const full = await tx.leaveBalance.findUniqueOrThrow({
    where: { id: balance.id },
    include: { leaveType: true, transactions: { select: { type: true, minutes: true } } },
  });
  return summarizeLeaveBalance(full);
}

export async function addLeaveLedgerEntry(tx: Tx, input: { balanceId: string; type: LedgerType; minutes: number; referenceId?: string; description?: string }) {
  return tx.leaveBalanceTransaction.create({ data: input });
}

export async function hasLeaveLedgerEntry(tx: Tx, balanceId: string, type: LedgerType, referenceId: string) {
  return Boolean(await tx.leaveBalanceTransaction.findFirst({ where: { balanceId, type, referenceId } }));
}
