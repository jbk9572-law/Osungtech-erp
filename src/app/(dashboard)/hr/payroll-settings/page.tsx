import { redirect } from "next/navigation";

// 급여 기준 설정은 /hr/payroll(급여관리) 화면으로 합쳐졌다 — 북마크/링크가
// 깨지지 않게 리다이렉트만 남겨둔다.
export default function PayrollSettingsPage() {
  redirect("/hr/payroll");
}
