"use client";

import { useActionState, useRef, useState } from "react";
import { createActivity } from "@/app/(dashboard)/sales-activities/actions";
import { PartySearchSelect } from "@/components/party-search-select";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { KeyboardHintBar } from "@/components/erp/keyboard-hint-bar";

const ACTIVITY_TYPES = ["전화", "방문", "이메일", "기타"] as const;

type InitialActivity = {
  id: string;
  customer_id: string;
  activity_type: string;
  subject: string;
  content: string | null;
  activity_date: string;
  next_action_date: string | null;
  next_action_memo: string | null;
};

export function SalesActivityForm({
  today,
  customers,
  fixedCustomerId,
  action = createActivity,
  initial,
  submitLabel,
}: {
  today: string;
  // 지정하면 거래처 검색창을 보여준다(영업활동관리 화면). 지정하지 않고
  // fixedCustomerId만 주면 이미 정해진 거래처(거래처 상세 화면)로 고정된다.
  customers?: { id: string; name: string }[];
  fixedCustomerId?: string;
  // 기본은 신규 등록(createActivity). 상세패널에서 수정할 때는
  // updateActivity를 넘긴다.
  action?: (state: FormState, formData: FormData) => Promise<FormState>;
  // 넘기면 수정 모드 — 기존 값으로 채우고, 저장 성공해도 폼을 비우지
  // 않는다(방금 고친 값이 그대로 남아있어야 하므로).
  initial?: InitialActivity;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);
  const [customerId, setCustomerId] = useState(initial?.customer_id ?? "");

  // 저장 성공 시 폼을 비운다(신규 등록 모드만) — party-payment-form.tsx와
  // 동일한 패턴으로, useEffect 대신 렌더 중 state 객체 자체가 바뀌었는지
  // 비교해서 formKey를 올려 리마운트한다(입력값 초기화 + 거래처 선택
  // 초기화를 한 번에 처리).
  const [lastState, setLastState] = useState(state);
  const [formKey, setFormKey] = useState(0);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success && !initial) {
      setFormKey((k) => k + 1);
      setCustomerId("");
    }
  }

  return (
    <form action={formAction} key={formKey} className="flex flex-col gap-3">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="erp-field-grid">
        {fixedCustomerId ? (
          <input type="hidden" name="customer_id" value={fixedCustomerId} />
        ) : (
          <div className="erp-field erp-span-4">
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
        <div className={`erp-field ${fixedCustomerId ? "erp-span-6" : "erp-span-4"}`}>
          <label htmlFor="sa-type">활동 유형</label>
          <select id="sa-type" name="activity_type" defaultValue={initial?.activity_type ?? "방문"} className="erp-input">
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className={`erp-field ${fixedCustomerId ? "erp-span-6" : "erp-span-4"}`}>
          <label htmlFor="sa-date">활동일</label>
          <input id="sa-date" name="activity_date" type="date" defaultValue={initial?.activity_date ?? today} className="erp-input" />
        </div>

        <div className="erp-field erp-span-12">
          <label htmlFor="sa-subject">제목</label>
          <input
            id="sa-subject"
            name="subject"
            autoComplete="off"
            required
            defaultValue={initial?.subject ?? ""}
            className="erp-input"
            style={{ width: "100%" }}
            placeholder="예: 9월 발주 관련 미팅"
          />
        </div>

        <div className="erp-field erp-span-12">
          <label htmlFor="sa-content">내용(선택)</label>
          <textarea
            id="sa-content"
            name="content"
            rows={3}
            defaultValue={initial?.content ?? ""}
            className="erp-input erp-textarea-compact w-full"
          />
        </div>

        <div className="erp-field erp-span-4">
          <label htmlFor="sa-next-date">다음 팔로우업 예정일(선택)</label>
          <input
            id="sa-next-date"
            name="next_action_date"
            type="date"
            defaultValue={initial?.next_action_date ?? ""}
            className="erp-input"
          />
        </div>
        <div className="erp-field erp-span-8">
          <label htmlFor="sa-next-memo">팔로우업 메모(선택)</label>
          <input
            id="sa-next-memo"
            name="next_action_memo"
            autoComplete="off"
            defaultValue={initial?.next_action_memo ?? ""}
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button ref={submitRef} type="submit" className="erp-btn erp-btn-primary" disabled={pending}>
          {pending ? "저장 중..." : (submitLabel ?? "F7 활동 기록")}
        </button>
        <FormMessage state={state} />
      </div>
      <KeyboardHintBar items={[{ key: "F7", label: "저장" }]} />
    </form>
  );
}
