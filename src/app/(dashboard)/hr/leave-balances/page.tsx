import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { LeaveBalanceForm } from "@/components/leave-balance-form";
import { setLeaveBalance } from "@/app/(dashboard)/hr/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { todayKstStr } from "@/lib/kst-date";

export default async function LeaveBalancesPage() {
  const supabase = await createClient();
  const { isAdmin } = await getCurrentActor(supabase);

  if (!isAdmin) {
    return (
      <div>
        <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">인사관리 &gt; 연차관리</h1>
        <p className="erp-grid-empty" style={{ marginTop: 24 }}>
          이 화면은 관리자만 볼 수 있습니다.
        </p>
      </div>
    );
  }

  const year = Number(todayKstStr().slice(0, 4));

  const [profiles, { data: balances }] = await Promise.all([
    fetchAllRows<{ id: string; full_name: string | null }>((from, to) =>
      supabase.from("profiles").select("id, full_name").order("full_name").range(from, to),
    ),
    supabase.from("leave_balances").select("user_id, total_days").eq("year", year),
  ]);

  const totalByUser = new Map((balances ?? []).map((b) => [b.user_id, Number(b.total_days)]));

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">인사관리 &gt; 연차관리</h1>

      <PageGuide>
        {year}년 구성원별 연차 총일수를 직접 설정합니다. 노동법상 연차
        발생 규칙(입사일 기준 매월/가산 등)은 자동 계산하지 않으니, 회사
        기준에 맞는 값을 확인 후 입력해주세요.
      </PageGuide>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>구성원</th>
              <th style={{ width: 260 }}>{year}년 연차 총일수</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id}>
                <td>{p.full_name || "구성원"}</td>
                <td>
                  <LeaveBalanceForm
                    action={setLeaveBalance}
                    userId={p.id}
                    year={year}
                    totalDays={totalByUser.get(p.id) ?? 0}
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
