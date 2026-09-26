import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { GeneratePayrollForm } from "@/components/generate-payroll-form";
import { ConfirmPayslipButton } from "@/components/confirm-payslip-button";
import { generatePayroll, confirmPayslip } from "@/app/(dashboard)/hr/actions";
import { todayKstStr } from "@/lib/kst-date";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ pay_month?: string }>;
}) {
  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "hr");
  const { isAdmin } = await getCurrentActor(supabase);

  if (!isAdmin) {
    return (
      <div>
        <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">인사관리 &gt; 급여명세</h1>
        <p className="erp-grid-empty" style={{ marginTop: 24 }}>
          이 화면은 관리자만 볼 수 있습니다.
        </p>
      </div>
    );
  }

  const { pay_month: payMonthParam } = await searchParams;
  const currentMonth = todayKstStr().slice(0, 7);
  const payMonth = payMonthParam || currentMonth;

  const { data: payslips } = await supabase
    .from("payslips")
    .select("id, user_id, base_pay, total_deduction, net_pay, status, profiles!user_id(full_name)")
    .eq("pay_month", payMonth)
    .order("created_at", { ascending: true });

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">인사관리 &gt; 급여명세</h1>

      <PageGuide>
        4대보험 공제까지만 반영된 급여명세입니다(소득세/지방소득세 별도).
        확정 전까지는 다시 생성하면 값이 갱신되고, 확정 후에는 유지됩니다.
      </PageGuide>

      <GeneratePayrollForm action={generatePayroll} currentMonth={payMonth} />

      {(payslips ?? []).length === 0 ? (
        <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
          {payMonth} 급여명세가 없습니다. 위에서 생성해주세요.
        </p>
      ) : (
        <div className="erp-grid-wrap">
          <table className="erp-grid">
            <thead>
              <tr>
                <th>구성원</th>
                <th className="num" style={{ width: 120 }}>
                  기본급
                </th>
                <th className="num" style={{ width: 120 }}>
                  공제합계
                </th>
                <th className="num" style={{ width: 120 }}>
                  실지급액
                </th>
                <th style={{ width: 90 }}>상태</th>
                <th style={{ width: 90 }} />
              </tr>
            </thead>
            <tbody>
              {(payslips ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{p.profiles?.full_name ?? "-"}</td>
                  <td className="num">{Number(p.base_pay).toLocaleString()}</td>
                  <td className="num" style={{ color: "var(--erp-danger)" }}>
                    -{Number(p.total_deduction).toLocaleString()}
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {Number(p.net_pay).toLocaleString()}
                  </td>
                  <td>
                    <GridBadge tone={p.status === "confirmed" ? "ok" : "warn"}>
                      {p.status === "confirmed" ? "확정" : "초안"}
                    </GridBadge>
                  </td>
                  <td>{p.status === "draft" && <ConfirmPayslipButton id={p.id} action={confirmPayslip} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
