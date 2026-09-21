import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { SalesActivityForm } from "@/components/sales-activity-form";
import { NextActionCheckbox } from "@/components/next-action-checkbox";
import { DeleteButton } from "@/components/delete-button";
import { deleteActivity } from "@/app/(dashboard)/sales-activities/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { todayKstStr } from "@/lib/kst-date";

export default async function SalesActivitiesPage() {
  const supabase = await createClient();
  const today = todayKstStr();

  const [customers, { data: activities }] = await Promise.all([
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("customers").select("id, name").order("name").range(from, to)
    ),
    supabase
      .from("sales_activities")
      .select("id, activity_type, subject, content, activity_date, next_action_date, next_action_memo, next_action_done, customers(id, name)")
      .order("activity_date", { ascending: false })
      .limit(300),
  ]);

  const upcoming = (activities ?? [])
    .filter((a) => a.next_action_date && !a.next_action_done)
    .sort((a, b) => (a.next_action_date! < b.next_action_date! ? -1 : 1));

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <ListPageHeader title="영업활동관리" />
      <PageGuide>
        거래처별 상담/방문/전화 이력을 기록하고, 다음 팔로우업 예정일을 정해두면 여기서 한눈에 챙길 수 있습니다.
      </PageGuide>

      <FormSection tabLabel="새 활동 기록">
        <SalesActivityForm today={today} customers={customers} />
      </FormSection>

      {upcoming.length > 0 && (
        <div className="erp-detail">
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">팔로우업 예정 ({upcoming.length}건)</span>
          </div>
          <div className="erp-detail-body">
            <div className="erp-grid-wrap">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>예정일</th>
                    <th style={{ width: 140 }}>거래처</th>
                    <th>메모</th>
                    <th style={{ width: 70 }}>완료</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((a) => {
                    const overdue = a.next_action_date! < today;
                    return (
                      <tr key={a.id}>
                        <td style={{ color: overdue ? "var(--erp-danger)" : "var(--erp-text)", fontWeight: overdue ? 700 : 400 }}>
                          {a.next_action_date!.replaceAll("-", ".")}
                          {overdue && " (지남)"}
                        </td>
                        <td>{a.customers?.name ?? "-"}</td>
                        <td>{a.next_action_memo || a.subject}</td>
                        <td>
                          <NextActionCheckbox id={a.id} done={a.next_action_done} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">전체 활동 이력 (최근 300건)</span>
        </div>
        <div className="erp-detail-body">
          <div className="erp-grid-wrap">
            <table className="erp-grid">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>일자</th>
                  <th style={{ width: 60 }}>유형</th>
                  <th style={{ width: 140 }}>거래처</th>
                  <th>제목</th>
                  <th style={{ width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {(activities ?? []).map((a) => (
                  <tr key={a.id}>
                    <td>{a.activity_date.replaceAll("-", ".")}</td>
                    <td>{a.activity_type}</td>
                    <td>{a.customers?.name ?? "-"}</td>
                    <td>{a.subject}</td>
                    <td>
                      <DeleteButton action={deleteActivity} id={a.id} confirmMessage="이 활동 기록을 삭제하시겠습니까?" />
                    </td>
                  </tr>
                ))}
                {(!activities || activities.length === 0) && (
                  <tr>
                    <td colSpan={5} className="erp-grid-empty">
                      기록된 영업활동이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
