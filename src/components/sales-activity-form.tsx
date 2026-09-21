"use client";

import { useActionState, useState } from "react";
import { createActivity } from "@/app/(dashboard)/sales-activities/actions";
import { PartySearchSelect } from "@/components/party-search-select";
import { FormMessage } from "@/components/form-message";

const ACTIVITY_TYPES = ["전화", "방문", "이메일", "기타"] as const;

export function SalesActivityForm({
  today,
  customers,
  fixedCustomerId,
}: {
  today: string;
  // 지정하면 거래처 검색창을 보여준다(영업활동관리 화면). 지정하지 않고
  // fixedCustomerId만 주면 이미 정해진 거래처(거래처 상세 화면)로 고정된다.
  customers?: { id: string; name: string }[];
  fixedCustomerId?: string;
}) {
  const [state, formAction, pending] = useActionState(createActivity, undefined);
  const [customerId, setCustomerId] = useState("");

  // 저장 성공 시 폼을 비운다 — party-payment-form.tsx와 동일한 패턴으로,
  // useEffect 대신 렌더 중 state 객체 자체가 바뀌었는지 비교해서 formKey를
  // 올려 리마운트한다(입력값 초기화 + 거래처 선택 초기화를 한 번에 처리).
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
    <form action={formAction} key={formKey} className="flex flex-col gap-3" style={{ maxWidth: 560 }}>
      {fixedCustomerId ? (
        <input type="hidden" name="customer_id" value={fixedCustomerId} />
      ) : (
        <div className="erp-field">
          <label htmlFor="sa-customer">거래처</label>
          <PartySearchSelect
            parties={customers ?? []}
            value={customerId}
            onChange={setCustomerId}
            name="customer_id"
            id="sa-customer"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="erp-field">
          <label htmlFor="sa-type">활동 유형</label>
          <select id="sa-type" name="activity_type" defaultValue="방문" className="erp-input">
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="erp-field">
          <label htmlFor="sa-date">활동일</label>
          <input id="sa-date" name="activity_date" type="date" defaultValue={today} className="erp-input" />
        </div>
      </div>

      <div className="erp-field">
        <label htmlFor="sa-subject">제목</label>
        <input id="sa-subject" name="subject" autoComplete="off" required className="erp-input" placeholder="예: 9월 발주 관련 미팅" />
      </div>

      <div className="erp-field">
        <label htmlFor="sa-content">내용(선택)</label>
        <textarea id="sa-content" name="content" rows={3} className="erp-input" style={{ resize: "vertical" }} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="erp-field">
          <label htmlFor="sa-next-date">다음 팔로우업 예정일(선택)</label>
          <input id="sa-next-date" name="next_action_date" type="date" className="erp-input" />
        </div>
        <div className="erp-field">
          <label htmlFor="sa-next-memo">팔로우업 메모(선택)</label>
          <input id="sa-next-memo" name="next_action_memo" autoComplete="off" className="erp-input" />
        </div>
      </div>

      <FormMessage state={state} />

      <button type="submit" className="erp-btn erp-btn-primary" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "등록 중..." : "활동 기록"}
      </button>
    </form>
  );
}
