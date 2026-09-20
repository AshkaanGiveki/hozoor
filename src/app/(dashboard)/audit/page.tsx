"use client";

import { useEffect, useState } from "react";

type Log = { id: string; action: string; entityType: string; entityId?: string | null; createdAt: string; actor?: { username: string; firstName: string; lastName: string } | null };

export default function AuditPage() {
  const [rows, setRows] = useState<Log[]>([]);
  const [query, setQuery] = useState("");
  useEffect(() => { void fetch(`/api/v1/audit-logs?action=${encodeURIComponent(query)}`).then((response) => response.json()).then((result) => setRows(result.data || [])); }, [query]);
  return <><div className="sectionTitle"><div><p className="eyebrow">Security and accountability</p><h1>Audit log</h1><p>Review administrative and workflow changes in your organization.</p></div></div><section className="card"><label>Filter by action<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="employee.update" /></label><div>{rows.length ? rows.map((row) => <article key={row.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--color-border-secondary)" }}><strong>{row.action}</strong><p>{row.entityType} · {row.entityId || "—"}</p><small>{row.actor ? `${row.actor.firstName} ${row.actor.lastName} (${row.actor.username})` : "System"} · {new Date(row.createdAt).toLocaleString()}</small></article>) : <div className="empty">No audit events found.</div>}</div></section></>;
}
