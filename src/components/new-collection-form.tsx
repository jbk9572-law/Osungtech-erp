"use client";

import { useActionState, useRef, useState } from "react";
import { addCustomerPayment, getCustomerTransactionHistory } from "@/app/(dashboard)/customers/actions";
import { PartySearchSelect } from "@/components/party-search-select";
import { PartyTransactionHistory } from "@/components/party-transaction-history";
import { FormMessage } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

const METHODS = ["현금", "계좌이체", "카드", "어음"];

// 매출 등록 화면의 "유형: 수금" 모드 — 품목 그리드 없이 출고처의 미수금에
// 바로 반영되는 수금 내역을 등록한다. addCustomerPayment를 그대로 쓰므로
// 출고처 상세 화면의 수금 등록/이력과 동일한 데이터다.
export function NewCollectionForm({
  customers,
  today,
}: {
  customers: { id: string; name: string }[];
  today: string;
}) {
  const [customerId, setCustomerId] = useState("");
  const [state, formAction, pending] = useActionState(addCustomerPayment, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  const [lastState, setLastState] = useState(state);
  const [formKey, setFormKey] = useState(0);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) {
      setFormKey((k) => k + 1);
      setCustomerId("");
    }
  }

  return (
    <div>
      <form action={formAction} key={formKey}>
        <input type="hidden" name="customer_id" value={customerId} />
        <div className="erp-detail" style={{ marginTop: 0 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">기본정보</span>
          </div>
          <div className="erp-detail-body erp-search" style={{ border: "none", padding: 14, margin: 0 }}>
            <div className="erp-field">
              <label>출고처</label>
              <PartySearchSelect
                parties={customers}
                value={customerId}
                onChange={setCustomerId}
                placeholder="출고처명 검색"
              />
            </div>
            <div className="erp-field">
              <label>일자</label>
              <input type="date" name="paid_at" defaultValue={today} className="erp-input" required />
            </div>
            <div className="erp-field">
              <label>금액</label>
              <input type="number" name="amount" step="1" min="1" placeholder="-" className="erp-input" required />
            </div>
            <div className="erp-field">
              <label>방법</label>
              <select name="method" className="erp-input" defaultValue="">
                <option value="">-</option>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="erp-field" style={{ flex: 1, minWidth: 220 }}>
              <label>적요 (선택)</label>
              <input name="memo" className="erp-input" style={{ width: "100%" }} />
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
            {pending ? (
              <>
                <span className="erp-spinner" aria-hidden /> 저장 중...
              </>
            ) : (
              "F7 수금 등록"
            )}
          </button>
          <FormMessage state={state} />
        </div>
      </form>

      <PartyTransactionHistory
        partyId={customerId}
        fetchHistory={getCustomerTransactionHistory}
        title="이 출고처 미결제 전표 조회"
        positiveKind="sale"
        kindLabels={{ sale: "매출", collection: "수금" }}
      />
    </div>
  );
}
