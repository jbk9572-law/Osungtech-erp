"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DraftSavedIndicator } from "@/components/draft-saved-indicator";
import { useThemeFeatures } from "@/lib/erp-theme-features";
import { formatNumber } from "@/lib/format-number";
import { useModalClose } from "@/lib/modal-context";

// 매출/매입 전표 등록 모달의 "틀" — 테마에 따라 구조 자체가 다르다.
//  · 클래식: 가운데 제목 + "기본정보" 머리줄(오른쪽에 저장 버튼) + 표 아래 합계.
//  · voucherLayout 테마: 왼쪽 제목 + 상태 칩 한 줄, 머리줄 없음, 아래 고정 바(합계금액 + 저장 버튼).
// 두 전표 폼이 같은 조각을 쓰므로 한 곳을 고치면 둘 다 바뀐다.

// 전표 모달 맨 위 한 줄(제목 + 유형 탭 + 상태 칩). 유형 탭(매출/수금/반품)은 전환기(switcher)가, 상태 칩은 폼이 그린다 —
// 칩은 아래 슬롯으로 올려 보내(portal) 한 줄에 같이 보이게 한다. 클래식은 이 줄이 없고 탭만 기존 자리에 그린다.
const ChipSlotContext = createContext<HTMLElement | null>(null);

export function VoucherTypeBar({ title, children }: { title: string; children: ReactNode }) {
  const { voucherLayout } = useThemeFeatures();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  if (!voucherLayout) return <>{children}</>;
  return (
    <ChipSlotContext.Provider value={slot}>
      <div className="erp-voucher-titlebar erp-voucher-typebar">
        <h2 className="erp-voucher-title">{title}</h2>
        {children}
        <span className="erp-voucher-chips" ref={setSlot} />
      </div>
    </ChipSlotContext.Provider>
  );
}

/** 테마 구조 플래그에 따라 자식을 숨긴다(예: voucherLayout 테마는 모달 위 큰 제목을 따로 두지 않는다). */
export function HideWhenVoucher({ children }: { children: ReactNode }) {
  return useThemeFeatures().voucherLayout ? null : <>{children}</>;
}

/** 전표 제목. 상태 칩(임시저장 시각, 이월, 샘플 등)은 children으로 받는다. 유형 줄(VoucherTypeBar) 안이면 칩만 그 줄로 올린다. */
export function VoucherTitle({ title, savedAt, children }: { title: string; savedAt: number | null; children?: ReactNode }) {
  const { voucherLayout } = useThemeFeatures();
  const slot = useContext(ChipSlotContext);
  if (!voucherLayout) return <h2 className="erp-doc-title">{title.split("").join(" ")}</h2>;
  const chips = (
    <>
      <DraftSavedIndicator savedAt={savedAt} />
      {children}
    </>
  );
  if (slot) return createPortal(chips, slot);
  return (
    <div className="erp-voucher-titlebar">
      <h2 className="erp-voucher-title">{title}</h2>
      {chips}
    </div>
  );
}

/** "기본정보" 머리줄 — 클래식만 그린다(저장 버튼이 여기 있다). voucherLayout 테마는 하단 바로 옮겨 간다. */
export function VoucherBasicHead({ actions }: { actions: ReactNode }) {
  const { voucherLayout } = useThemeFeatures();
  if (voucherLayout) return null;
  return (
    <div className="erp-form-section-head">
      <span className="erp-eyebrow erp-u-m-0">기본정보</span>
      {actions}
    </div>
  );
}

/** 재고 부족 경고 띠 — voucherLayout 테마만. 품목(상품) 단위로 합쳐서 넘긴다. */
export function VoucherWarning({ shortages }: { shortages: { name: string; short: number; unit: string }[] }) {
  const { voucherLayout } = useThemeFeatures();
  if (!voucherLayout || shortages.length === 0) return null;
  const [first, ...rest] = shortages;
  return (
    <div className="erp-voucher-warning" role="alert">
      ⚠ {first.name} 출고 수량이 재고보다 {formatNumber(first.short)}{first.unit} 많습니다{rest.length > 0 && ` (외 ${rest.length}개 품목)`}. 저장하면 재고 부족으로 거부될 수 있습니다.
    </div>
  );
}

/** 하단 고정 바 — voucherLayout 테마만. 왼쪽 단축키 안내, 오른쪽 합계금액과 [취소] [저장]. */
export function VoucherFooter({ supply, tax, total, actions }: { supply: number; tax: number; total: number; actions: ReactNode }) {
  const { voucherLayout } = useThemeFeatures();
  const close = useModalClose();
  if (!voucherLayout) return null;
  return (
    <div className="erp-voucher-footer">
      <span className="erp-voucher-footer-hint">Tab 다음 칸 · F7 저장 · Esc 저장 후 닫기</span>
      <div className="erp-voucher-footer-right">
        <div className="erp-voucher-footer-sum">
          <span className="erp-u-muted erp-u-text-xs">
            공급가액 {formatNumber(supply)} · 부가세 {formatNumber(tax)}
          </span>
          <span className="erp-voucher-footer-label">합계금액</span>
          <b className="erp-voucher-footer-total">{formatNumber(total)}원</b>
        </div>
        {close && (
          <button type="button" className="erp-btn" onClick={close}>
            취소
          </button>
        )}
        {actions}
      </div>
    </div>
  );
}

/** 상태 칩 한 개(예: "이월 처리", "샘플"). */
export function VoucherChip({ tone = "muted", children }: { tone?: "muted" | "info" | "warning"; children: ReactNode }) {
  return <span className={`erp-voucher-chip erp-voucher-chip-${tone}`}>{children}</span>;
}
