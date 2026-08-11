"use client";

import { useActionState, useRef, useState } from "react";
import { addSupplierPayment, getSupplierTransactionHistory } from "@/app/(dashboard)/suppliers/actions";
import { PartySearchSelect } from "@/components/party-search-select";
import { PartyTransactionHistory } from "@/components/party-transaction-history";
import { FormMessage } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

const METHODS = ["현금", "계좌이체", "카드", "어음"];

// 매입 등록 화면의 "유형: 지급" 모드 — new-collection-form.tsx(수금)과
// 동일한 구조로, 공급처의 미지급금에 바로 반영되는 지급 내역을 등록한다.
export function NewPaymentForm({
  suppliers,
  today,
}: {
  suppliers: { id: string; name: string }[];
  today: string;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [state, formAction, pending] = useActionState(addSupplierPayment, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  const [lastState, setLastState] = useState(state);
  const [formKey, setFormKey] = useState(0);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) {
      setFormKey((k) => k + 1);
      setSupplierId("");
    }
  }

  return (
    <div>
      <form action={formAction} key={formKey}>
        <input type="hidden" name="supplier_id" value={supplierId} />
        <div className="erp-detail" style={{ marginTop: 0 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">기본정보</span>
          </div>
          <div className="erp-detail-body erp-search" style={{ border: "none", padding: 14, margin: 0 }}>
            <div className="erp-field">
              <label>공급처</label>
              <PartySearchSelect
                parties={suppliers}
                value={supplierId}
                onChange={setSupplierId}
                placeholder="공급처명 검색"
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
              "F7 지급 등록"
            )}
          </button>
          <FormMessage state={state} />
        </div>
      </form>

      <PartyTransactionHistory
        partyId={supplierId}
        fetchHistory={getSupplierTransactionHistory}
        title="이 공급처 미결제 전표 조회"
        positiveKind="purchase"
        kindLabels={{ purchase: "매입", payment: "지급" }}
      />
    </div>
  );
}
