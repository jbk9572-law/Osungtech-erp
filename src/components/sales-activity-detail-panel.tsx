import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DetailPageHeader } from "@/components/erp/page-header";
import { DeleteButton } from "@/components/delete-button";
import { SalesActivityForm } from "@/components/sales-activity-form";
import { deleteActivity, updateActivity } from "@/app/(dashboard)/sales-activities/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { todayKstStr } from "@/lib/kst-date";

// sales-activities/page.tsx의 목록+상세 분할 화면에서, 목록 옆 패널에 이
// 컴포넌트를 그대로 렌더링한다(quote-detail-panel.tsx와 같은 패턴).
// 활동 기록은 단일 테이블이라 "조회용 읽기 화면" 대신 등록폼을 그대로
// 재사용해 바로 고칠 수 있게 한다(customer-detail-panel.tsx가 PartnerForm을
// 그대로 쓰는 것과 같은 방식).
export async function SalesActivityDetailPanel({ id, closeHref }: { id: string; closeHref: string }) {
  const supabase = await createClient();

  const [{ data: activity }, customers] = await Promise.all([
    supabase
      .from("sales_activities")
      .select(
        "id, customer_id, activity_type, subject, content, activity_date, next_action_date, next_action_memo, customers(name)",
      )
      .eq("id", id)
      .maybeSingle(),
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase.from("customers").select("id, name").order("name").range(from, to),
    ),
  ]);

  if (!activity) notFound();

  return (
    <>
      <DetailPageHeader
        title={activity.subject}
        meta={
          <>
            {activity.customers?.name ?? "-"} · {activity.activity_type} · {activity.activity_date.replaceAll("-", ".")}
          </>
        }
        actions={
          <>
            <DeleteButton action={deleteActivity} id={activity.id} confirmMessage="이 활동 기록을 삭제하시겠습니까?" />
            <Link href={closeHref} className="erp-btn">
              목록
            </Link>
          </>
        }
      />

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">활동 내용 수정</span>
        </div>
        <div className="erp-detail-body">
          <SalesActivityForm
            today={todayKstStr()}
            customers={customers}
            action={updateActivity}
            submitLabel="저장"
            initial={{
              id: activity.id,
              customer_id: activity.customer_id,
              activity_type: activity.activity_type,
              subject: activity.subject,
              content: activity.content,
              activity_date: activity.activity_date,
              next_action_date: activity.next_action_date,
              next_action_memo: activity.next_action_memo,
            }}
          />
        </div>
      </div>
    </>
  );
}
