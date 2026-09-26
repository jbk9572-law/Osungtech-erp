import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { LeaveBalanceForm } from "@/components/leave-balance-form";
import { HireDateForm } from "@/components/hire-date-form";
import { LeavePromotionButton } from "@/components/leave-promotion-button";
import { setLeaveBalance, setHireDate, sendLeavePromotionNotice } from "@/app/(dashboard)/hr/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { todayKstStr } from "@/lib/kst-date";
import { calcStatutoryAnnualLeaveDays, leavePromotionWindow } from "@/lib/leave-accrual";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";

export default async function LeaveBalancesPage() {
  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "hr");
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

  const today = todayKstStr();
  const year = Number(today.slice(0, 4));

  const [profiles, { data: balances }, leaveRows, notices] = await Promise.all([
    fetchAllRows<{ id: string; full_name: string | null; hire_date: string | null }>((from, to) =>
      supabase.from("profiles").select("id, full_name, hire_date").order("full_name").range(from, to),
    ),
    supabase.from("leave_balances").select("user_id, total_days").eq("year", year),
    fetchAllRows<{ user_id: string; start_date: string; days: number; status: string }>((from, to) =>
      supabase
        .from("leave_requests")
        .select("user_id, start_date, days, status")
        .eq("status", "approved")
        .gte("start_date", `${year}-01-01`)
        .lte("start_date", `${year}-12-31`)
        .range(from, to),
    ),
    fetchAllRows<{ user_id: string; stage: number; sent_at: string }>((from, to) =>
      supabase.from("leave_promotion_notices").select("user_id, stage, sent_at").eq("year", year).range(from, to),
    ),
  ]);

  const totalByUser = new Map((balances ?? []).map((b) => [b.user_id, Number(b.total_days)]));
  const usedByUser = new Map<string, number>();
  for (const row of leaveRows) {
    usedByUser.set(row.user_id, (usedByUser.get(row.user_id) ?? 0) + Number(row.days));
  }
  const noticeByUserStage = new Map<string, string>();
  for (const n of notices) {
    noticeByUserStage.set(`${n.user_id}:${n.stage}`, n.sent_at);
  }

  const rows = profiles.map((p) => {
    const totalDays = totalByUser.get(p.id) ?? 0;
    const usedDays = usedByUser.get(p.id) ?? 0;
    const remaining = totalDays - usedDays;
    const suggestedDays = p.hire_date ? calcStatutoryAnnualLeaveDays(p.hire_date, today) : null;
    const window = p.hire_date ? leavePromotionWindow(p.hire_date, today) : null;
    return { profile: p, totalDays, usedDays, remaining, suggestedDays, window };
  });

  // 사용촉진 대상 — 입사일이 등록돼 있고, 잔여 연차가 남아 있고, 1차 통지
  // 시점(사용기한 6개월 전)이 이미 지난 사람만 보여준다. 이미 다 썼거나
  // 아직 촉진 시점이 안 된 사람까지 섞으면 매번 훑어야 할 목록이 쓸데없이
  // 길어진다.
  const promotionTargets = rows.filter(
    (r) => r.window && r.remaining > 0 && r.window.firstNoticeDate <= today,
  );

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">인사관리 &gt; 연차관리</h1>

      <PageGuide>
        입사일을 등록하면 근로기준법 기준 법정 연차 일수를 자동 계산해
        보여줍니다(1년 미만: 개근 월 1일씩 최대 11일 / 1년 이상: 15일 +
        3년째부터 2년마다 1일 가산, 25일 상한). 회사 특약이 있으면 자동계산
        값을 참고만 하고 직접 입력해도 됩니다 — 저장은 항상 사람이
        확인하고 눌러야 반영됩니다.
      </PageGuide>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>구성원</th>
              <th style={{ width: 150 }}>입사일</th>
              <th style={{ width: 260 }}>{year}년 연차 총일수</th>
              <th className="num" style={{ width: 80 }}>
                사용
              </th>
              <th className="num" style={{ width: 80 }}>
                잔여
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ profile: p, totalDays, usedDays, remaining, suggestedDays }) => (
              <tr key={p.id}>
                <td>{p.full_name || "구성원"}</td>
                <td>
                  <HireDateForm action={setHireDate} userId={p.id} hireDate={p.hire_date} />
                </td>
                <td>
                  <LeaveBalanceForm
                    action={setLeaveBalance}
                    userId={p.id}
                    year={year}
                    totalDays={totalDays}
                    suggestedDays={suggestedDays}
                  />
                </td>
                <td className="num">{usedDays}</td>
                <td className="num">{remaining}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-bold text-[var(--erp-text)]">연차 사용촉진 대상</h2>
      <PageGuide>
        사용기한(입사기념일) 6개월 전부터 1차, 2개월 전부터 2차 통지
        대상입니다. 통지를 마치면 아래 버튼으로 발송 처리해 이력을
        남겨주세요 — 이 기록이 미사용 연차수당 지급 의무를 면하는 근거가
        됩니다.
      </PageGuide>
      {promotionTargets.length === 0 ? (
        <p className="erp-grid-empty">지금 시점에 촉진 통지가 필요한 구성원이 없습니다.</p>
      ) : (
        <div className="erp-grid-wrap">
          <table className="erp-grid">
            <thead>
              <tr>
                <th>구성원</th>
                <th className="num" style={{ width: 80 }}>
                  잔여
                </th>
                <th style={{ width: 110 }}>사용기한</th>
                <th style={{ width: 180 }}>1차 (기한 6개월 전)</th>
                <th style={{ width: 180 }}>2차 (기한 2개월 전)</th>
              </tr>
            </thead>
            <tbody>
              {promotionTargets.map(({ profile: p, remaining, window }) => (
                <tr key={p.id}>
                  <td>{p.full_name || "구성원"}</td>
                  <td className="num">{remaining}</td>
                  <td>{window!.expiryDate}</td>
                  <td>
                    <LeavePromotionButton
                      action={sendLeavePromotionNotice}
                      userId={p.id}
                      year={year}
                      stage={1}
                      remainingDays={remaining}
                      sentAt={noticeByUserStage.get(`${p.id}:1`) ?? null}
                    />
                  </td>
                  <td>
                    {window!.secondNoticeDate <= today ? (
                      <LeavePromotionButton
                        action={sendLeavePromotionNotice}
                        userId={p.id}
                        year={year}
                        stage={2}
                        remainingDays={remaining}
                        sentAt={noticeByUserStage.get(`${p.id}:2`) ?? null}
                      />
                    ) : (
                      <span className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
                        {window!.secondNoticeDate}부터
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
