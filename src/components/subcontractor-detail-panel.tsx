import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SubcontractorForm } from "@/components/subcontractor-form";
import { PortalAccountForm, PortalAccountDisableForm } from "@/components/portal-account-form";
import { PartyPaymentForm } from "@/components/party-payment-form";
import { PartyPaymentDeleteForm } from "@/components/party-payment-delete-form";
import { PageGuide } from "@/components/erp/page-guide";
import { formatNumber } from "@/lib/format-number";
import { todayKstStr } from "@/lib/kst-date";
import { getSubcontractorBalance } from "@/lib/ar-ap";
import {
  updateSubcontractor,
  addSubcontractorPayment,
  deleteSubcontractorPayment,
} from "@/app/(dashboard)/subcontractors/actions";

export async function SubcontractorDetailPanel({ id }: { id: string }) {
  const supabase = await createClient();

  const [{ data: subcontractor }, { data: portalAccounts }, { data: assignedSteps }, { data: custody }, balance] =
    await Promise.all([
      supabase.from("subcontractors").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("customer_portal_accounts")
        .select("id, username, disabled, created_at")
        .eq("subcontractor_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("work_order_process_steps")
        .select("id, process_name, status, unit_cost, returned_quantity, work_orders(id, doc_no, quantity, products(name))")
        .eq("subcontractor_id", id)
        .order("sort_order"),
      supabase
        .from("subcontractor_inventory")
        .select("product_id, quantity, products(name, spec, unit)")
        .eq("subcontractor_id", id)
        .gt("quantity", 0)
        .order("updated_at", { ascending: false }),
      getSubcontractorBalance(supabase, id),
    ]);

  if (!subcontractor) {
    return <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>업체를 찾을 수 없습니다.</p>;
  }

  return (
    <>
      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">업체 정보</span>
        </div>
        <div className="erp-detail-body">
          <SubcontractorForm action={updateSubcontractor} idFieldValue={subcontractor.id} initial={subcontractor} />
        </div>
      </div>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">업체 포털 계정</span>
        </div>
        <div className="erp-detail-body">
          <PageGuide>
            이 업체가 직접 로그인해 배정된 공정의 진행 상태(시작/완료/배송)를
            올릴 수 있는 포털 계정입니다. 거래처 포털과 같은 방식(아이디+
            비밀번호)으로 로그인하며, 내부 직원 계정과는 완전히 분리됩니다.
          </PageGuide>
          <PortalAccountForm targetId={subcontractor.id} kind="subcontractor" />
          {portalAccounts && portalAccounts.length > 0 && (
            <div className="erp-grid-wrap" style={{ marginTop: 12 }}>
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th>아이디</th>
                    <th style={{ width: 90 }}>상태</th>
                    <th style={{ width: 110 }}>발급일</th>
                    <th style={{ width: 90 }} />
                  </tr>
                </thead>
                <tbody>
                  {portalAccounts.map((a) => (
                    <tr key={a.id}>
                      <td>{a.username}</td>
                      <td>
                        <span className={`erp-badge ${a.disabled ? "erp-badge-muted" : "erp-badge-success"}`}>
                          {a.disabled ? "비활성" : "사용중"}
                        </span>
                      </td>
                      <td>{new Date(a.created_at).toLocaleDateString("ko-KR")}</td>
                      <td>{!a.disabled && <PortalAccountDisableForm id={a.id} kind="subcontractor" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">배정된 공정</span>
        </div>
        <div className="erp-detail-body">
          {assignedSteps && assignedSteps.length > 0 ? (
            <div className="erp-grid-wrap">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>지시번호</th>
                    <th>완제품</th>
                    <th>공정</th>
                    <th style={{ width: 90 }} className="num">단가</th>
                    <th style={{ width: 90 }} className="num">반품수량</th>
                    <th style={{ width: 100 }}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedSteps.map((s) => (
                    <tr key={s.id}>
                      <td>
                        {s.work_orders?.id ? (
                          <Link href={`/production/${s.work_orders.id}`}>{s.work_orders.doc_no}</Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>{s.work_orders?.products?.name ?? "-"}</td>
                      <td>{s.process_name}</td>
                      <td className="num">{s.unit_cost != null ? `${formatNumber(Number(s.unit_cost))}원` : "-"}</td>
                      <td className="num">{Number(s.returned_quantity) > 0 ? formatNumber(Number(s.returned_quantity)) : "-"}</td>
                      <td>
                        <span className={`erp-badge ${s.status === "returned" ? "erp-badge-danger" : "erp-badge-muted"}`}>
                          {STEP_STATUS_LABEL[s.status] ?? s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <PageGuide>
              아직 이 업체에 배정된 공정이 없습니다. 생산지시 상세에서 공정
              단계를 이 업체로 배정할 수 있습니다.
            </PageGuide>
          )}
        </div>
      </div>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">외주 보유재고</span>
        </div>
        <div className="erp-detail-body">
          <PageGuide>
            첫 공정이 이 업체로 배정된 생산지시에서 &ldquo;외주
            자재출고&rdquo;로 보낸 자재 중, 아직 업체가 작업을
            완료(투입소비)하지 않은 수량입니다.
          </PageGuide>
          {custody && custody.length > 0 ? (
            <div className="erp-grid-wrap">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th>품목</th>
                    <th style={{ width: 110 }} className="num">보유수량</th>
                  </tr>
                </thead>
                <tbody>
                  {custody.map((c) => (
                    <tr key={c.product_id}>
                      <td>
                        {c.products?.name ?? "-"}
                        {c.products?.spec && ` (${c.products.spec})`}
                      </td>
                      <td className="num">
                        {formatNumber(Number(c.quantity))} {c.products?.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
              보유 중인 자재가 없습니다.
            </p>
          )}
        </div>
      </div>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">외주비 정산</span>
        </div>
        <div className="erp-detail-body">
          <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
            <span>가공비 누계: {formatNumber(balance.totalFees)}원</span>
            <span>지급 누계: {formatNumber(balance.totalPaid)}원</span>
            <span style={{ color: balance.balance > 0 ? "var(--erp-danger)" : "var(--erp-text)", fontWeight: 700 }}>
              잔액: {formatNumber(balance.balance)}원
            </span>
          </div>

          {balance.unpaidSteps.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p className="mb-1.5 text-xs" style={{ color: "var(--erp-text-muted)" }}>
                미정산 공정 (오래된 순, 지급은 오래된 것부터 상계 처리)
              </p>
              <div className="erp-grid-wrap">
                <table className="erp-grid">
                  <thead>
                    <tr>
                      <th style={{ width: 90 }}>일자</th>
                      <th>공정</th>
                      <th className="num">미정산액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balance.unpaidSteps.map((s) => (
                      <tr key={s.id}>
                        <td>{s.date.replaceAll("-", ".")}</td>
                        <td>
                          {s.docNo ? `${s.docNo} · ` : ""}
                          {s.processName}
                        </td>
                        <td className="num">{formatNumber(s.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <PartyPaymentForm
            action={addSubcontractorPayment}
            partyIdField="subcontractor_id"
            partyId={subcontractor.id}
            today={todayKstStr()}
            label="지급"
          />

          {balance.payments.length > 0 && (
            <div className="erp-grid-wrap" style={{ marginTop: 12 }}>
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>일자</th>
                    <th className="num">금액</th>
                    <th style={{ width: 90 }}>방법</th>
                    <th>적요</th>
                    <th style={{ width: 70 }} />
                  </tr>
                </thead>
                <tbody>
                  {balance.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.paid_at.replaceAll("-", ".")}</td>
                      <td className="num">{formatNumber(Number(p.amount))}</td>
                      <td>{p.method ?? "-"}</td>
                      <td>{p.memo ?? "-"}</td>
                      <td>
                        <PartyPaymentDeleteForm
                          action={deleteSubcontractorPayment}
                          id={p.id}
                          partyIdField="subcontractor_id"
                          partyId={subcontractor.id}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const STEP_STATUS_LABEL: Record<string, string> = {
  pending: "입고 대기",
  received: "입고완료",
  in_progress: "작업중",
  done: "완료",
  shipped: "출고완료",
  returned: "반품됨",
};
