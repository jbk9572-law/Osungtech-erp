import { createClient, getUser } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { ClockInOutPanel } from "@/components/clock-in-out-panel";
import { LeaveRequestForm } from "@/components/leave-request-form";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { LeaveDecisionButton } from "@/components/leave-decision-button";
import {
  clockIn,
  clockOut,
  requestLeave,
  decideLeaveRequest,
  cancelLeaveRequest,
} from "@/app/(dashboard)/hr/actions";
import { todayKstStr } from "@/lib/kst-date";

const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "danger" }> = {
  pending: { label: "대기", tone: "warn" },
  approved: { label: "승인", tone: "ok" },
  rejected: { label: "반려", tone: "danger" },
};

export default async function AttendancePage() {
  const supabase = await createClient();
  const user = await getUser();
  const { isAdmin } = await getCurrentActor(supabase);
  const today = todayKstStr();
  const year = Number(today.slice(0, 4));

  const [{ data: todayRecord }, { data: myLeaves }, { data: balance }] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("clock_in_at, clock_out_at")
      .eq("user_id", user!.id)
      .eq("work_date", today)
      .maybeSingle(),
    supabase
      .from("leave_requests")
      .select("id, start_date, end_date, days, reason, status, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("leave_balances").select("total_days").eq("user_id", user!.id).eq("year", year).maybeSingle(),
  ]);

  const { data: pendingLeaves } = isAdmin
    ? await supabase
        .from("leave_requests")
        .select("id, start_date, end_date, days, reason, created_at, profiles!user_id(full_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(100)
    : { data: [] as never[] };

  const usedThisYear = (myLeaves ?? [])
    .filter((l) => l.status === "approved" && l.start_date.startsWith(String(year)))
    .reduce((sum, l) => sum + Number(l.days), 0);
  const totalDays = Number(balance?.total_days ?? 0);
  const remaining = totalDays - usedThisYear;

  const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">인사관리 &gt; 근태</h1>

      <PageGuide>
        연차 총일수는 관리자가 &quot;연차관리&quot; 화면에서 직접 설정합니다(노동법
        발생 규칙 자동계산 아님) — 잔여 연차는 그 값에서 승인된 휴가일수를
        뺀 단순 계산입니다.
      </PageGuide>

      <ClockInOutPanel
        clockedIn={!!todayRecord?.clock_in_at}
        clockedOut={!!todayRecord?.clock_out_at}
        clockInTime={fmtTime(todayRecord?.clock_in_at ?? null)}
        clockOutTime={fmtTime(todayRecord?.clock_out_at ?? null)}
        clockInAction={clockIn}
        clockOutAction={clockOut}
      />

      <div className="erp-kpi-row" style={{ marginBottom: 16 }}>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
            {year}년 연차 총일수
          </div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{totalDays.toLocaleString()}일</div>
        </div>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
            사용(승인 기준)
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--erp-primary)" }}>
            {usedThisYear.toLocaleString()}일
          </div>
        </div>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
            잔여
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: remaining < 0 ? "var(--erp-danger)" : undefined }}>
            {remaining.toLocaleString()}일
          </div>
        </div>
      </div>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">휴가 신청</span>
        </div>
        <div className="erp-detail-body">
          <LeaveRequestForm action={requestLeave} today={today} />
        </div>
      </div>

      {isAdmin && (pendingLeaves ?? []).length > 0 && (
        <div className="erp-detail">
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">결재 대기 휴가 신청 (관리자)</span>
          </div>
          <div className="erp-detail-body">
            <div className="erp-grid-wrap">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>신청자</th>
                    <th style={{ width: 200 }}>기간</th>
                    <th className="num" style={{ width: 80 }}>
                      일수
                    </th>
                    <th>사유</th>
                    <th style={{ width: 130 }} />
                  </tr>
                </thead>
                <tbody>
                  {(pendingLeaves ?? []).map((l) => (
                    <tr key={l.id}>
                      <td>{l.profiles?.full_name ?? "-"}</td>
                      <td>
                        {l.start_date.replaceAll("-", ".")} ~ {l.end_date.replaceAll("-", ".")}
                      </td>
                      <td className="num">{Number(l.days).toLocaleString()}</td>
                      <td style={{ color: "var(--erp-text-muted)" }}>{l.reason ?? "-"}</td>
                      <td>
                        <div className="flex gap-1">
                          <LeaveDecisionButton id={l.id} decision="approved" action={decideLeaveRequest} />
                          <LeaveDecisionButton id={l.id} decision="rejected" action={decideLeaveRequest} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">내 휴가 신청 이력</span>
        </div>
        <div className="erp-detail-body">
          {(myLeaves ?? []).length === 0 ? (
            <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
              신청 내역이 없습니다.
            </p>
          ) : (
            <div className="erp-grid-wrap">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th style={{ width: 200 }}>기간</th>
                    <th className="num" style={{ width: 80 }}>
                      일수
                    </th>
                    <th>사유</th>
                    <th style={{ width: 90 }}>상태</th>
                    <th style={{ width: 70 }} />
                  </tr>
                </thead>
                <tbody>
                  {(myLeaves ?? []).map((l) => {
                    const status = STATUS_LABEL[l.status] ?? { label: l.status, tone: "muted" as const };
                    return (
                      <tr key={l.id}>
                        <td>
                          {l.start_date.replaceAll("-", ".")} ~ {l.end_date.replaceAll("-", ".")}
                        </td>
                        <td className="num">{Number(l.days).toLocaleString()}</td>
                        <td style={{ color: "var(--erp-text-muted)" }}>{l.reason ?? "-"}</td>
                        <td>
                          <GridBadge tone={status.tone}>{status.label}</GridBadge>
                        </td>
                        <td>
                          {l.status === "pending" && (
                            <InlineConfirmDelete
                              action={cancelLeaveRequest}
                              hiddenFields={{ id: l.id }}
                              warningText="이 휴가 신청을 취소하시겠습니까?"
                              triggerLabel="취소"
                              triggerClassName="erp-btn"
                              triggerStyle={{ minWidth: 0, height: 24, padding: "1px 8px", fontSize: 11 }}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
