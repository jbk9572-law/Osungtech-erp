import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { CloseButton } from "@/components/erp/close-button";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { ClockInOutPanel } from "@/components/clock-in-out-panel";
import { LeaveRequestForm } from "@/components/leave-request-form";
import { AttendanceCorrectionForm } from "@/components/attendance-correction-form";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { LeaveDecisionButton } from "@/components/leave-decision-button";
import {
  clockIn,
  clockOut,
  requestLeave,
  decideLeaveRequest,
  cancelLeaveRequest,
  requestAttendanceCorrection,
  cancelAttendanceCorrection,
} from "@/app/(dashboard)/hr/actions";
import { todayKstStr } from "@/lib/kst-date";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { buildOrgTree } from "@/lib/org-chart";

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

  const [{ data: todayRecord }, { data: myLeaves }, { data: myCorrections }, { data: balance }, departments, profiles, presetsRaw] =
    await Promise.all([
      supabase
        .from("attendance_records")
        .select("clock_in_at, clock_out_at")
        .eq("user_id", user!.id)
        .eq("work_date", today)
        .maybeSingle(),
      supabase
        .from("leave_requests")
        .select("id, start_date, end_date, days, reason, status, created_at, approval_document_id")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("attendance_correction_requests")
        .select("id, work_date, requested_clock_in_at, requested_clock_out_at, reason, status, created_at, approval_document_id")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("leave_balances").select("total_days").eq("user_id", user!.id).eq("year", year).maybeSingle(),
      fetchAllRows<{ id: string; name: string; parent_department_id: string | null; sort_order: number }>((from, to) =>
        supabase.from("departments").select("id, name, parent_department_id, sort_order").order("sort_order").range(from, to),
      ),
      fetchAllRows<{ id: string; full_name: string | null; position_title: string | null; department_id: string | null }>(
        (from, to) => supabase.from("profiles").select("id, full_name, position_title, department_id").order("full_name").range(from, to),
      ),
      fetchAllRows<{ id: string; name: string; approver_ids: string[]; reference_ids: string[] }>((from, to) =>
        supabase.from("approval_line_presets").select("id, name, approver_ids, reference_ids").order("name").range(from, to),
      ),
    ]);

  // 결재선 인프라가 생기기 전(마이그레이션 115 이전)에 등록된 레거시
  // 신청만 이 화면에서 관리자가 직접 처리한다 — 결재선이 연결된 신청은
  // 전자결재 기안함에서 처리하고 여기서는 상태만 보여준다.
  const { data: pendingLeaves } = isAdmin
    ? await supabase
        .from("leave_requests")
        .select("id, start_date, end_date, days, reason, created_at, profiles!user_id(full_name)")
        .eq("status", "pending")
        .is("approval_document_id", null)
        .order("created_at", { ascending: true })
        .limit(100)
    : { data: [] as never[] };

  const orgTree = buildOrgTree(
    departments.map((d) => ({ id: d.id, name: d.name, parentDepartmentId: d.parent_department_id, sortOrder: d.sort_order })),
    profiles.map((p) => ({ id: p.id, fullName: p.full_name, positionTitle: p.position_title, departmentId: p.department_id })),
  );
  const profileNameById: Record<string, string> = {};
  for (const p of profiles) profileNameById[p.id] = p.full_name || "구성원";
  const presets = presetsRaw.map((p) => ({ id: p.id, name: p.name, approverIds: p.approver_ids, referenceIds: p.reference_ids }));

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
      <ListPageHeader title="인사관리 > 근태" actions={<CloseButton href="/dashboard">✕</CloseButton>} />

      <PageGuide>
        연차 총일수는 관리자가 &quot;연차관리&quot; 화면에서 직접 설정합니다(노동법
        발생 규칙 자동계산 아님) — 잔여 연차는 그 값에서 승인된 휴가일수를
        뺀 단순 계산입니다. 휴가 신청·근태 정정 신청 모두 전자결재와 같은
        결재선을 타므로, 진행 상황은 기안함에서도 확인할 수 있습니다.
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

      <FormSection tabLabel="휴가 신청">
        <LeaveRequestForm action={requestLeave} today={today} orgTree={orgTree} presets={presets} profileNameById={profileNameById} />
      </FormSection>

      <div style={{ marginTop: 14 }}>
        <FormSection tabLabel="근태 정정 신청">
          <AttendanceCorrectionForm
            action={requestAttendanceCorrection}
            today={today}
            orgTree={orgTree}
            presets={presets}
            profileNameById={profileNameById}
          />
        </FormSection>
      </div>

      {isAdmin && (pendingLeaves ?? []).length > 0 && (
        <div className="erp-detail">
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">결재 대기 휴가 신청 (레거시 · 결재선 없음)</span>
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
                    <th style={{ width: 140 }} />
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
                          <div className="flex items-center gap-1">
                            {l.approval_document_id && (
                              <Link
                                href={`/approvals/${l.approval_document_id}`}
                                className="erp-btn"
                                style={{ minWidth: 0, height: 24, padding: "1px 8px", fontSize: 11 }}
                              >
                                결재 문서
                              </Link>
                            )}
                            {l.status === "pending" && (
                              <InlineConfirmDelete
                                action={cancelLeaveRequest}
                                hiddenFields={{ id: l.id }}
                                warningText="이 휴가 신청을 취소하시겠습니까? 결재선이 연결된 신청이면 기안 문서도 함께 회수됩니다."
                                triggerLabel="취소"
                                triggerClassName="erp-btn"
                                triggerStyle={{ minWidth: 0, height: 24, padding: "1px 8px", fontSize: 11 }}
                              />
                            )}
                          </div>
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

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">내 근태 정정 신청 이력</span>
        </div>
        <div className="erp-detail-body">
          {(myCorrections ?? []).length === 0 ? (
            <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
              신청 내역이 없습니다.
            </p>
          ) : (
            <div className="erp-grid-wrap">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>날짜</th>
                    <th style={{ width: 110 }}>정정 출근</th>
                    <th style={{ width: 110 }}>정정 퇴근</th>
                    <th>사유</th>
                    <th style={{ width: 90 }}>상태</th>
                    <th style={{ width: 140 }} />
                  </tr>
                </thead>
                <tbody>
                  {(myCorrections ?? []).map((c) => {
                    const status = STATUS_LABEL[c.status] ?? { label: c.status, tone: "muted" as const };
                    return (
                      <tr key={c.id}>
                        <td>{c.work_date.replaceAll("-", ".")}</td>
                        <td>{fmtTime(c.requested_clock_in_at) ?? "-"}</td>
                        <td>{fmtTime(c.requested_clock_out_at) ?? "-"}</td>
                        <td style={{ color: "var(--erp-text-muted)" }}>{c.reason}</td>
                        <td>
                          <GridBadge tone={status.tone}>{status.label}</GridBadge>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            {c.approval_document_id && (
                              <Link
                                href={`/approvals/${c.approval_document_id}`}
                                className="erp-btn"
                                style={{ minWidth: 0, height: 24, padding: "1px 8px", fontSize: 11 }}
                              >
                                결재 문서
                              </Link>
                            )}
                            {c.status === "pending" && (
                              <InlineConfirmDelete
                                action={cancelAttendanceCorrection}
                                hiddenFields={{ id: c.id }}
                                warningText="이 근태 정정 신청을 취소하시겠습니까? 연결된 기안 문서도 함께 회수됩니다."
                                triggerLabel="취소"
                                triggerClassName="erp-btn"
                                triggerStyle={{ minWidth: 0, height: 24, padding: "1px 8px", fontSize: 11 }}
                              />
                            )}
                          </div>
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
