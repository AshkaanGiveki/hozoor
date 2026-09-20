"use client";

import { useState, type FormEvent } from "react";
import ResponsiveDataList from "./ResponsiveDataList";
import SelectField from "./SelectField";
import styles from "./EmployeesClient.module.scss";

type Employee = { id: string; employeeCode: string; firstName: string; lastName: string; email?: string | null; phone?: string | null; active?: boolean; departmentId?: string | null; teamId?: string | null; groupId?: string | null; department?: { name?: string } | null; team?: { name?: string } | null; group?: { name?: string } | null; user?: { username?: string; role?: string; status?: string } | null };

export default function EmployeesClient({ initial, departments, teams, groups }: { initial: Employee[]; departments: any[]; teams: any[]; groups: any[] }) {
  const [rows, setRows] = useState(initial);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    const object = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/v1/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(object) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error?.message || "ایجاد کارمند ناموفق بود"); return; }
      setRows([...rows, result.data]);
      setMessage("کارمند با موفقیت ایجاد شد.");
      event.currentTarget.reset();
    } finally { setLoading(false); }
  }

  async function update(event: FormEvent<HTMLFormElement>, employee: Employee) {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch(`/api/v1/employees/${employee.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, active: input.active === "true" }) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error?.message || "ÙˆÛŒØ±Ø§ÛŒØ´ Ú©Ø§Ø±Ù…Ù†Ø¯ Ø§Ù†Ø¬Ø§Ù… Ù†Ø´Ø¯."); return; }
    setRows(rows.map((row) => row.id === employee.id ? { ...row, ...result.data } : row));
    setEditingId(null);
    setMessage("Ù¾Ø±ÙˆÙ†Ø¯Ù‡ Ú©Ø§Ø±Ù…Ù†Ø¯ Ø¨Ù‡â€ŒØ±ÙˆØ² Ø´Ø¯.");
  }

  async function toggleActive(employee: Employee) {
    const response = await fetch(`/api/v1/employees/${employee.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firstName: employee.firstName, lastName: employee.lastName, employeeCode: employee.employeeCode, active: employee.active === false }) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error?.message || "ØªØºÛŒÛŒØ± ÙˆØ¶Ø¹ÛŒØª Ø§Ù†Ø¬Ø§Ù… Ù†Ø´Ø¯."); return; }
    setRows(rows.map((row) => row.id === employee.id ? { ...row, ...result.data, user: { ...row.user, status: result.data.active ? "ACTIVE" : "INACTIVE" } } : row));
  }

  return <>
    <div className="sectionTitle"><div><p className="eyebrow">ساختار سازمانی</p><h1>کارکنان</h1><p>ایجاد حساب و مدیریت حوزهٔ کارکنان</p></div></div>
    <div className={styles.layout}>
      <form className="card stack" onSubmit={submit}>
        <h3>افزودن کارمند</h3>
        <div className={styles.two}><label>نام<input name="firstName" required /></label><label>نام خانوادگی<input name="lastName" required /></label></div>
        <div className={styles.two}><label>کد پرسنلی<input name="employeeCode" dir="ltr" required /></label><label>نام کاربری<input name="username" dir="ltr" required /></label></div>
        <label>رمز موقت<input name="password" type="password" dir="ltr" defaultValue="Employee123!" required /></label>
        <label>نقش<SelectField name="role" defaultValue="EMPLOYEE" options={[{ value: "EMPLOYEE", label: "کارمند" }, { value: "MANAGER", label: "مدیر" }, { value: "HR_ADMIN", label: "منابع انسانی" }]} /></label>
        <label>بخش<SelectField name="departmentId" placeholder="انتخاب بخش" options={[{ value: "", label: "بدون بخش" }, ...departments.map((item) => ({ value: item.id, label: item.name }))]} /></label>
        <label>تیم<SelectField name="teamId" placeholder="انتخاب تیم" options={[{ value: "", label: "بدون تیم" }, ...teams.map((item) => ({ value: item.id, label: item.name }))]} /></label>
        <label>گروه حضور<SelectField name="groupId" placeholder="بدون گروه" options={[{ value: "", label: "بدون گروه" }, ...groups.map((item) => ({ value: item.id, label: item.name }))]} /></label>
        {message && <div className="alert success">{message}</div>}
        <button className="button primary" disabled={loading}>{loading ? "در حال ایجاد حساب…" : "ایجاد حساب کارمند"}</button>
      </form>
      <ResponsiveDataList
        title="فهرست کارکنان"
        description="جستجو در کد، نام، بخش، تیم و نام کاربری"
        rows={rows}
        getRowId={(row) => row.id}
        fields={[
          { key: "employeeCode", label: "کد پرسنلی", primary: true, value: (row) => <span dir="ltr">{row.employeeCode}</span>, search: (row) => row.employeeCode },
          { key: "name", label: "نام و نام خانوادگی", primary: true, value: (row) => `${row.firstName} ${row.lastName}`, search: (row) => `${row.firstName} ${row.lastName}` },
          { key: "status", label: "وضعیت", primary: true, value: () => <span className="status present">فعال</span>, search: () => "فعال active" },
          { key: "department", label: "بخش", value: (row) => row.department?.name || "—", search: (row) => row.department?.name || "" },
          { key: "team", label: "تیم", value: (row) => row.team?.name || "—", search: (row) => row.team?.name || "" },
          { key: "group", label: "گروه حضور", value: (row) => row.group?.name || "—", search: (row) => row.group?.name || "" },
          { key: "username", label: "نام کاربری", value: (row) => <span dir="ltr">{row.user?.username || "—"}</span>, search: (row) => row.user?.username || "" },
        ]}
        renderActions={(employee) => editingId === employee.id ? <form className="stack" onSubmit={(event) => update(event, employee)}><div className={styles.two}><label>Ù†Ø§Ù…<input name="firstName" defaultValue={employee.firstName} required /></label><label>Ù†Ø§Ù… Ø®Ø§Ù†ÙˆØ§Ø¯Ú¯ÛŒ<input name="lastName" defaultValue={employee.lastName} required /></label></div><div className={styles.two}><label>Ú©Ø¯ Ù¾Ø±Ø³Ù†Ù„ÛŒ<input name="employeeCode" defaultValue={employee.employeeCode} required /></label><label>Ø§ÛŒÙ…ÛŒÙ„<input name="email" type="email" defaultValue={employee.email || ""} /></label></div><label>Ø´Ù…Ø§Ø±Ù‡ ØªÙ…Ø§Ø³<input name="phone" defaultValue={employee.phone || ""} /></label><div className={styles.two}><label>Ø¨Ø®Ø´<select name="departmentId" defaultValue={employee.departmentId || ""}><option value="">Ø¨Ø¯ÙˆÙ† Ø¨Ø®Ø´</option>{departments.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>ØªÛŒÙ…<select name="teamId" defaultValue={employee.teamId || ""}><option value="">Ø¨Ø¯ÙˆÙ† ØªÛŒÙ…</option>{teams.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div><input type="hidden" name="active" value={employee.active === false ? "false" : "true"} /><div><button className="button primary" type="submit">Ø°Ø®ÛŒØ±Ù‡</button><button className="button secondary" type="button" onClick={() => setEditingId(null)}>Ø§Ù†ØµØ±Ø§Ù</button></div></form> : <div><button className="button secondary" type="button" onClick={() => setEditingId(employee.id)}>ÙˆÛŒØ±Ø§ÛŒØ´</button><button className="button secondary" type="button" onClick={() => toggleActive(employee)}>{employee.active === false ? "ÙØ¹Ø§Ù„â€ŒÚ©Ø±Ø¯Ù†" : "ØºÛŒØ±ÙØ¹Ø§Ù„â€ŒÚ©Ø±Ø¯Ù†"}</button></div>}
      />
    </div>
  </>;
}
