"use client";

import { useState, type FormEvent } from "react";
import ResponsiveDataList from "./ResponsiveDataList";
import SelectField from "./SelectField";
import styles from "./EmployeesClient.module.scss";

type Employee = { id: string; employeeCode: string; firstName: string; lastName: string; department?: { name?: string } | null; team?: { name?: string } | null; user?: { username?: string } | null };

export default function EmployeesClient({ initial, departments, teams }: { initial: Employee[]; departments: any[]; teams: any[] }) {
  const [rows, setRows] = useState(initial);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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
          { key: "username", label: "نام کاربری", value: (row) => <span dir="ltr">{row.user?.username || "—"}</span>, search: (row) => row.user?.username || "" },
        ]}
      />
    </div>
  </>;
}
