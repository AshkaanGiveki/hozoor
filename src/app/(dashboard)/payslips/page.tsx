"use client";
import { useEffect, useState } from "react";

type Line = { id: string; label: string; amount: string; type: string };
type Run = { id: string; grossAmount: string; totalDeductions: string; netPayable: string; publishedAt: string | null; acknowledgedAt: string | null; period: { year: number; month: number; status: string }; lines: Line[] };

export default function PayslipsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [message, setMessage] = useState("");
  async function load() { const response = await fetch("/api/v1/payroll/runs"); const result = await response.json(); setRuns(result.data || []); }
  useEffect(() => { void load(); }, []);
  async function acknowledge(id: string) { const response = await fetch(`/api/v1/payroll/runs/${id}/acknowledge`, { method: "POST" }); if (response.ok) { setMessage("Payslip acknowledgement recorded."); void load(); } }
  return <><div className="sectionTitle"><div><p className="eyebrow">Payroll transparency</p><h1>My payslips</h1><p>Each payslip shows the same finalized amounts used for payment and reporting.</p></div></div>{message && <div className="alert success">{message}</div>}{runs.length ? runs.map((run) => <section className="card" key={run.id}><div className="sectionTitle"><div><h2>{run.period.year}/{String(run.period.month).padStart(2, "0")}</h2><p className="muted">Status: {run.period.status} · {run.publishedAt ? "Published" : "Not published"}</p></div><div>{run.publishedAt && <button className="button secondary" onClick={() => window.open(`/api/v1/payroll/runs/${run.id}/print`, "_blank", "noopener,noreferrer")}>Print / save PDF</button>}{run.publishedAt && !run.acknowledgedAt && <button className="button primary" onClick={() => void acknowledge(run.id)}>Acknowledge</button>}</div></div><div className="tableWrap"><table><thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody>{run.lines.map((line) => <tr key={line.id}><td>{line.label}</td><td>{Number(line.amount).toLocaleString()} ریال</td></tr>)}<tr><th>Gross compensation</th><th>{Number(run.grossAmount).toLocaleString()} ریال</th></tr><tr><th>Total deductions</th><th>{Number(run.totalDeductions).toLocaleString()} ریال</th></tr><tr><th>Net payable</th><th>{Number(run.netPayable).toLocaleString()} ریال</th></tr></tbody></table></div></section>) : <div className="card empty">No published payslips are available.</div>}</>;
}
