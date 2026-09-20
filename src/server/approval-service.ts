import { Prisma, RequestKind, RoleCode } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export async function ensureWorkflow(tx: Tx, companyId: string, kind: RequestKind) {
  const existing = await tx.approvalWorkflow.findFirst({ where: { companyId, kind, active: true }, include: { steps: { orderBy: { order: "asc" } } }, orderBy: { name: "asc" } });
  if (existing?.steps.length) return existing;
  return tx.approvalWorkflow.create({
    data: {
      companyId,
      name: `${kind.replaceAll("_", " ")} approval`,
      kind,
      active: true,
      steps: { create: [{ order: 1, role: RoleCode.MANAGER, required: true }, { order: 2, role: RoleCode.HR_ADMIN, required: true }] },
    },
    include: { steps: { orderBy: { order: "asc" } } },
  });
}

export function statusForRole(role: RoleCode) {
  return role === RoleCode.MANAGER ? "PENDING_MANAGER" as const : "PENDING_ADMIN" as const;
}
