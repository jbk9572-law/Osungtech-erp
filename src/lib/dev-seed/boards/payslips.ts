import { selectInChunks } from "@/lib/fetch-all-rows";
import type { BoardSeedResult, Db, DummyEmployee } from "../types";

// 급여명세 "샘플" — 실제 원천징수 세율표로 계산한 금액이 아니라 단순 비율로 만든 예시 숫자다(화면은 샌드박스 회사에서 "샘플" 안내를 띄운다).
// 초안(draft) 상태로만 넣어 확정·지급 처리와 섞이지 않게 한다. 한 직원·한 달에 하나만 만든다(이미 있으면 건너뜀).
export async function seedPayslipSamples(admin: Db, tenantId: string, employees: DummyEmployee[]): Promise<BoardSeedResult> {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const payMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-01`;

  const ids = employees.map((e) => e.id);
  const [{ data: settings }, { data: existing }] = await Promise.all([
    selectInChunks(ids, (chunk) => admin.from("employee_pay_settings").select("user_id, monthly_base_pay").eq("tenant_id", tenantId).in("user_id", chunk)),
    selectInChunks(ids, (chunk) => admin.from("payslips").select("user_id").eq("pay_month", payMonth).in("user_id", chunk)),
  ]);
  const have = new Set((existing ?? []).map((r) => r.user_id));
  const rows = (settings ?? [])
    .filter((s) => !have.has(s.user_id))
    .map((s) => {
      const base = Number(s.monthly_base_pay ?? 0);
      const pension = Math.round(base * 0.045);
      const health = Math.round(base * 0.03545);
      const ltc = Math.round(health * 0.1295);
      const employment = Math.round(base * 0.009);
      const incomeTax = Math.round(base * 0.03);
      const localTax = Math.round(incomeTax * 0.1);
      const totalDeduction = pension + health + ltc + employment + incomeTax + localTax;
      return {
        user_id: s.user_id,
        pay_month: payMonth,
        base_pay: base,
        gross_pay: base,
        pension_deduction: pension,
        health_deduction: health,
        long_term_care_deduction: ltc,
        employment_deduction: employment,
        income_tax_deduction: incomeTax,
        local_income_tax_deduction: localTax,
        total_deduction: totalDeduction,
        net_pay: base - totalDeduction,
        rate_year: prev.getFullYear(),
        status: "draft",
      };
    });
  if (rows.length === 0) return { board: "급여명세 샘플(payslips)", created: 0, error: settings && settings.length > 0 ? undefined : "직원 급여 기준정보가 없어 건너뜀" };
  const { error } = await admin.from("payslips").insert(rows);
  return { board: "급여명세 샘플(payslips)", created: error ? 0 : rows.length, error: error?.message };
}
