"use client";

import { useEffect, type ReactNode, type RefObject } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { DocSubmitBar, VoucherTypeBar, useFormSheetClass } from "@/components/erp/voucher-chrome";
import { useModalClose } from "@/lib/modal-context";
import { useThemeFeatures } from "@/lib/erp-theme-features";

// C형 입력 모달의 공용 틀(설정 폼 D형과 같은 12칸 격자) — 제목 줄 · 라벨이 칸 위에 있는 입력 격자 · 하단 바 [취소][저장].
// 입력칸은 children에 `erp-field erp-span-N`으로 넣는다. 화면마다 제목·버튼·메시지를 다시 짜지 않는다(개발헌법 3번).
// 모달 안에서 저장에 성공하면 모달을 닫고 목록으로 돌아간다(H형 규칙). 모달이 아닌 전용 화면에서는 그대로 둔다.
export function ModalFormSheet({
  title,
  tabLabel,
  formRef,
  formAction,
  state,
  pending,
  submitRef,
  submitLabel,
  children,
}: {
  title: string;
  tabLabel: string;
  formRef?: RefObject<HTMLFormElement | null>;
  formAction: (formData: FormData) => void;
  state: FormState;
  pending: boolean;
  submitRef?: RefObject<HTMLButtonElement | null>;
  submitLabel: string;
  children: ReactNode;
}) {
  const sheetClass = useFormSheetClass();
  const close = useModalClose();
  // 모달 밖(목록 화면 안에 인라인으로 놓은 경우)에서는 모달 전용 띠(제목줄·하단 바)를 달지 않는다 — 카드 머리 + 카드 안 저장 버튼 줄만.
  const inModal = close !== null;
  // 제목줄(VoucherTypeBar)이 이미 화면 이름을 보여주는 테마는 카드 머리 줄을 또 그리지 않는다 — 같은 말이 연달아 두 줄 나오지 않게
  const { voucherLayout } = useThemeFeatures();
  useEffect(() => {
    if (state?.success) close?.();
  }, [state, close]);

  const actions = (
    <div className="erp-form-actions">
      <FormMessage state={state} />
      <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
        {pending ? (
          <>
            <span className="erp-spinner" aria-hidden /> 저장 중...
          </>
        ) : (
          submitLabel
        )}
      </button>
    </div>
  );

  return (
    <form ref={formRef} action={formAction} className={inModal ? sheetClass : undefined}>
      {inModal && <VoucherTypeBar title={title}>{null}</VoucherTypeBar>}
      <div className="erp-detail erp-u-mt-0">
        {(!voucherLayout || !inModal) && (
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">{tabLabel}</span>
          </div>
        )}
        <div className="erp-detail-body erp-field-grid erp-u-border-none erp-u-p-14 erp-u-m-0">{children}</div>
      </div>
      {inModal ? <DocSubmitBar>{actions}</DocSubmitBar> : actions}
    </form>
  );
}
