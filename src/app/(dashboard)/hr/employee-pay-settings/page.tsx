import { redirect } from "next/navigation";

// 직원 급여정보는 /hr/payroll(급여관리) 화면으로 합쳐졌다 — 북마크/링크가
// 깨지지 않게 리다이렉트만 남겨둔다.
export default function EmployeePaySettingsPage() {
  redirect("/hr/payroll");
}
