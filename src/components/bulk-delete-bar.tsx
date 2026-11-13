"use client";

import { useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { generateConfirmCode } from "@/lib/confirm-code";

// 그리드 목록 상단에 뜨는 "선택 삭제" 확인 바 — 매출/매입/거래처/상품
// 그리드가 공통으로 쓴다. 상태(선택 항목, useActionState)는 각 그리드가
// 그대로 들고 있고, 여기서는 렌더링만 담당한다.
export function BulkDeleteBar({
  formAction,
  pending,
  state,
  selectedIds,
  namePreview,
  warningText,
  confirmText,
  onConfirmTextChange,
}: {
  formAction: (formData: FormData) => void;
  pending: boolean;
  state: FormState;
  selectedIds: string[];
  namePreview?: string;
  warningText?: string;
  confirmText: string;
  onConfirmTextChange: (value: string) => void;
}) {
  // 선택 건수(1, 3...)를 입력하게 했더니 단건 삭제 화면의 확인 방식과
  // 서로 달라 혼동을 낳았다. 화면마다 다른 숫자를 외워서 치는 대신,
  // 매번 새로 뽑는 임의 4자리 코드를 보고 그대로 입력하는 방식으로
  // 통일한다 — 이 바가 뜰 때(선택 0건→N건) 한 번만 코드를 뽑는다.
  const [code] = useState(generateConfirmCode);
  const confirmMatches = confirmText.trim() === code;

  return (
    <form
      action={formAction}
      className="mb-2 flex flex-wrap items-center gap-2 rounded-sm border p-2 text-sm erp-u-bc-border erp-u-bg-selected"
    >
      <input type="hidden" name="ids" value={JSON.stringify(selectedIds)} />
      <span className="erp-u-semibold">{selectedIds.length}건 선택됨</span>
      {namePreview && <span className="erp-u-muted">({namePreview})</span>}
      {warningText && <span className="erp-u-danger">{warningText}</span>}
      <label className="erp-u-items-center erp-u-gap-6 erp-u-inline-flex">
        확인 코드 <strong>{code}</strong> 입력
        <input
          type="text"
          inputMode="numeric"
          value={confirmText}
          onChange={(e) => onConfirmTextChange(e.target.value)}
          className="erp-input erp-u-h-24 erp-u-pad-0-6 erp-u-text-sm"
          style={{ width: 56 }}
          aria-label={`삭제를 확인하려면 ${code}를 입력하세요`}
        />
      </label>
      <button
        type="submit"
        disabled={pending || !confirmMatches}
        className="erp-btn erp-btn-danger erp-u-minw-0"
      >
        {pending ? "삭제 중..." : "선택 삭제"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
