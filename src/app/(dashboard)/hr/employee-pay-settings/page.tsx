import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { EmployeePayForm } from "@/components/employee-pay-form";
import { setEmployeePaySetting } from "@/app/(dashboard)/hr/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";

export default async function EmployeePaySettingsPage() {
  const supabase = await createClient();
  const { isAdmin } = await getCurrentActor(supabase);

  if (!isAdmin) {
    return (
      <div>
        <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">인사관리 &gt; 직원 급여정보</h1>
        <p className="erp-grid-empty" style={{ marginTop: 24 }}>
          이 화면은 관리자만 볼 수 있습니다.
        </p>
      </div>
    );
  }

  const [profiles, { data: paySettings }] = await Promise.all([
    fetchAllRows<{ id: string; full_name: string | null }>((from, to) =>
      supabase.from("profiles").select("id, full_name").order("full_name").range(from, to),
    ),
    supabase.from("employee_pay_settings").select("user_id, monthly_base_pay"),
  ]);

  const payByUser = new Map((paySettings ?? []).map((p) => [p.user_id, Number(p.monthly_base_pay)]));

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">인사관리 &gt; 직원 급여정보</h1>

      <PageGuide>
        월 기본급을 설정합니다. 급여명세 생성 시 이 값을 기준으로 4대보험
        공제를 계산합니다(연장/야간수당, 소득세는 포함되지 않습니다).
      </PageGuide>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>구성원</th>
              <th style={{ width: 260 }}>월 기본급</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id}>
                <td>{p.full_name || "구성원"}</td>
                <td>
                  <EmployeePayForm
                    action={setEmployeePaySetting}
                    userId={p.id}
                    monthlyBasePay={payByUser.get(p.id) ?? 0}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
