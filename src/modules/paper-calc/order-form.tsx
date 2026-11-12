"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getPaperCalculationsForPurchaseOrder, getPaperCalculationsForTodo } from "@/modules/paper-calc/actions";
import { PageGuide } from "@/components/erp/page-guide";
import { PaperCalcModalTrigger } from "@/modules/paper-calc/components/paper-calc-modal-trigger";
import { ManualLayoutModalTrigger } from "@/modules/paper-calc/components/manual-layout-modal-trigger";
import type { PendingCalcPayload } from "@/modules/paper-calc/components/paper-calc-client";
import { PaperCalcSizeLineRows, PendingPaperCalcRow } from "@/modules/paper-calc/components/order-form-paper-calc-rows";
import { PENDING_PAPER_CALC_KEY, PENDING_PAPER_CALC_PURCHASE_KEY } from "@/modules/paper-calc/lib/paper-calc-pending-key";
import type { PendingCalc } from "@/modules/paper-calc/lib/paper-calc-sync";
import { pendingPaperCalcSizeLines, resolveTg0Quantity, summarizePendingPaperCalc } from "@/modules/paper-calc/lib/pending-paper-calc";

// 매출/매입 등록 폼이 모조지 계산을 끼워 쓰는 "끼움 자리" 전체. 폼은 이 파일만
// 알면 되고(모듈 경계), 모조지 상태·임시 저장(localStorage)·TG0 자동 줄 계산·
// 모달 버튼·서버로 보낼 숨은 입력까지 여기서 관리한다. 이전에는 두 폼이
// 글자 그대로 같은 코드를 각자 약 100줄씩 갖고 있었다.
type Side = "sales" | "purchase";

const STORAGE_KEY: Record<Side, string> = {
  sales: PENDING_PAPER_CALC_KEY,
  purchase: PENDING_PAPER_CALC_PURCHASE_KEY,
};

export const PAPER_STOCK_SKU_IN_FORM = "TG0";

type Tg0Candidate = { id: string; sku: string; name: string; unit?: string | null };

export function useOrderPaperCalc<P extends Tg0Candidate>({
  side,
  isEdit,
  products,
  unitPriceOf,
}: {
  side: Side;
  isEdit: boolean;
  products: P[];
  // TG0 품목의 이 폼 기준 단가(매출: 거래처별 판매단가, 매입: 원가).
  unitPriceOf: (tg0: P) => number;
}) {
  const key = STORAGE_KEY[side];
  // 신규 등록일 때만 의미가 있다: 수정 화면은 이미 주문 id가 있어서 모조지 계산
  // 화면에서 바로 저장하면 된다. 값을 채우는 경로는 (1) 폼 안 모달의 "이 계산
  // 적용하기" 콜백, (2) 독립 화면에서 미리 계산 후 localStorage에 담아둔 것을
  // 마운트 시/storage 이벤트로 읽어오는 것이다.
  const [pending, setPending] = useState<string | null>(null);
  // 모조지(TG0) 입고 품목/할일 가져오기는 수량만 옮기면 사이즈별 배치 내역이
  // 사라지므로, 연결된 계산 자체를 통째로 복사해서 등록 시 같이 붙인다.
  const [copied, setCopied] = useState<PendingCalc[]>([]);
  // 거래처와 협의해 자동 계산값과 다른 수량으로 등록해야 할 때 고칠 수 있게
  // 한다 — null이면 자동값 그대로.
  const [overrideQuantity, setOverrideQuantity] = useState<number | null>(null);

  useEffect(() => {
    if (isEdit) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 후 localStorage의 임시 모조지 계산을 한 번 읽어오는 동기화(서버 렌더링 때는 localStorage가 없어 초기값으로 못 읽는다)
    setPending(localStorage.getItem(key));

    function handleStorage(e: StorageEvent) {
      if (e.key === key) setPending(e.newValue);
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [isEdit, key]);

  const summary = useMemo(() => summarizePendingPaperCalc(pending, copied), [pending, copied]);
  const tg0Product = useMemo(
    () => products.find((p) => p.sku === PAPER_STOCK_SKU_IN_FORM),
    [products],
  );
  const unitPrice = tg0Product ? unitPriceOf(tg0Product) : 0;
  const { quantity, isOverridden } = resolveTg0Quantity(summary, overrideQuantity);
  const amount = quantity * unitPrice;
  const sizeLines = useMemo(() => pendingPaperCalcSizeLines(pending, copied), [pending, copied]);

  return {
    side,
    isEdit,
    pending,
    copied,
    summary,
    tg0Product,
    unitPrice,
    quantity,
    isOverridden,
    overrideQuantity,
    amount,
    sizeLines,
    hasAny: !!pending || copied.length > 0,
    apply: (payload: PendingCalcPayload) => setPending(JSON.stringify(payload)),
    // 입고 불러오기/할일 가져오기로 가져온 항목에 모조지 계산이 붙어 있으면 통째로
    // 복사해 등록 시 같이 붙인다. 복사된 계산이 있으면 true.
    copyFromPurchaseOrder: async (purchaseOrderId: string) => {
      const calcs = await getPaperCalculationsForPurchaseOrder(purchaseOrderId);
      if (calcs.length > 0) setCopied((prev) => [...prev, ...calcs]);
      return calcs.length > 0;
    },
    copyFromTodo: async (todoId: string) => {
      const calcs = await getPaperCalculationsForTodo(todoId);
      if (calcs.length > 0) setCopied((prev) => [...prev, ...calcs]);
      return calcs.length > 0;
    },
    reloadFromStorage: () => setPending(localStorage.getItem(key)),
    // 제출 시점에 임시 계산을 같이 넘기고 나면 더 이상 필요 없으니 지운다(등록이
    // 실패해도 계산 자체는 다시 하면 되므로 감수할 만한 트레이드오프).
    clearStorageOnSubmit: () => {
      if (pending) localStorage.removeItem(key);
    },
    cancel: () => {
      localStorage.removeItem(key);
      setPending(null);
      setCopied([]);
      setOverrideQuantity(null);
    },
    setOverrideQuantity,
  };
}

export type OrderPaperCalc = ReturnType<typeof useOrderPaperCalc>;

// 서버 액션(createSale/createPurchase)이 읽는 숨은 입력.
export function PaperCalcHiddenInputs({ pc }: { pc: OrderPaperCalc }) {
  return (
    <>
      {pc.pending && <input type="hidden" name="pendingPaperCalc" value={pc.pending} />}
      {pc.copied.length > 0 && (
        <input type="hidden" name="copiedPaperCalcs" value={JSON.stringify(pc.copied)} />
      )}
    </>
  );
}

export function PaperCalcOverrideInput({ pc }: { pc: OrderPaperCalc }) {
  return pc.isOverridden ? (
    <input type="hidden" name="tg0OverrideQuantity" value={pc.overrideQuantity ?? ""} />
  ) : null;
}

// 매출은 직접 계산·복사 둘 다, 매입은 직접 계산만 안내 대상이다(기존 동작 유지).
export function PaperCalcLinkedGuide({ pc, includeCopied }: { pc: OrderPaperCalc; includeCopied: boolean }) {
  const show = includeCopied ? pc.hasAny : !!pc.pending;
  if (!show) return null;
  return (
    <PageGuide>
      모조지 계산 결과가 이 주문에 연결되어 있습니다 — 아래 품목 목록에 TG0
      자동 반영 줄로 표시됩니다. 등록하면 실제로 저장됩니다.
    </PageGuide>
  );
}

// "+ 품목 추가" 옆의 모조지 계산/재단 배치 시뮬레이터 버튼. 신규 등록이고 모듈이
// 켜진 회사에서만 보인다.
export function PaperCalcToolbarButtons({ pc, enabled }: { pc: OrderPaperCalc; enabled: boolean }) {
  if (pc.isEdit || !enabled) return null;
  return (
    <>
      <PaperCalcModalTrigger pendingFor={pc.side} onApply={pc.apply} />
      {/* 모조지 계산(자동 계산)과 재단 배치 시뮬레이터(직접 배치)는 한 세트라
          나란히 붙여둔다. 둘 다 라우트 이동 없는 중첩 팝업이라 이 폼이 이미
          모달로 열려 있어도 품목 줄이 사라지지 않는다 — 안에서 "등록에 연결"을
          누르면 storage 이벤트 대신 팝업이 닫히는 시점에 localStorage를 직접
          다시 읽어 반영한다. */}
      <ManualLayoutModalTrigger pendingFor={pc.side} onClose={pc.reloadFromStorage} />
    </>
  );
}

// 품목 표 맨 위에 끼우는 TG0 자동 줄 + 사이즈 참고 줄.
export function PaperCalcGridRows({
  pc,
  dashAfterQuantity = false,
  dashAfterUnit = false,
}: {
  pc: OrderPaperCalc;
  dashAfterQuantity?: boolean;
  dashAfterUnit?: boolean;
}): ReactNode {
  return (
    <>
      {pc.summary && (
        <PendingPaperCalcRow
          tg0Product={pc.tg0Product}
          quantity={pc.quantity}
          onQuantityChange={pc.setOverrideQuantity}
          unitAmount={pc.unitPrice}
          amount={pc.amount}
          autoSheet={pc.summary.totalSheet}
          isOverridden={pc.isOverridden}
          dashAfterQuantity={dashAfterQuantity}
          dashAfterUnit={dashAfterUnit}
          onCancel={pc.cancel}
        />
      )}
      <PaperCalcSizeLineRows lines={pc.sizeLines} dashAfterQuantity={dashAfterQuantity} dashAfterUnit={dashAfterUnit} />
    </>
  );
}
