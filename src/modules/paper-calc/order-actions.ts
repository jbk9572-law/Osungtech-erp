import {
  attachCopiedPaperCalculations,
  attachCopiedPaperCalculationsToPurchase,
  attachPendingPaperCalculation,
  attachPendingPaperCalculationToPurchase,
  attachPendingPaperCalculationToTodo,
  overridePurchasePaperStockQuantity,
  overrideSalesPaperStockQuantity,
} from "@/modules/paper-calc/lib/paper-calc-sync";

type Supabase = Parameters<typeof attachPendingPaperCalculation>[0];

// 매출/매입/할일 등록 서버 액션이 모조지에 대해 아는 것은 이 파일의 세 가지뿐이다:
// 폼에서 넘어온 모조지 값 읽기, 주문 생성 직후 계산 붙이기, TG0 수량 직접 입력 반영.
export type PaperCalcFormFields = {
  // 폼의 임시 계산(JSON 문자열), 입고/할일 가져오기로 복사한 계산들(JSON), TG0 수량 직접 입력값.
  pending: string;
  copied: string;
  tg0OverrideRaw: string;
  // 모조지 계산이 연결돼 있으면 수동 품목이 0개여도 등록을 막지 않는다(TG0 한 줄로 충분).
  hasAny: boolean;
};

export function readPaperCalcFields(formData: FormData): PaperCalcFormFields {
  const pending = String(formData.get("pendingPaperCalc") ?? "");
  const copied = String(formData.get("copiedPaperCalcs") ?? "");
  const tg0OverrideRaw = String(formData.get("tg0OverrideQuantity") ?? "");
  return { pending, copied, tg0OverrideRaw, hasAny: !!pending || !!copied };
}

function parseOverride(raw: string): number | null {
  const q = Number(raw);
  return raw && Number.isFinite(q) && q > 0 ? q : null;
}

// 이 단계가 실패해도 주문 자체는 이미 만들어졌으니 등록을 막지 않고, 경고 메시지만
// 돌려줘 상세 화면에 띄운다. warning이 이미 있으면(위치 경고 등) 뒤 단계는 기존
// 동작 그대로 건너뛴다(??=).
export async function attachPaperCalcToSale(
  supabase: Supabase,
  salesOrderId: string,
  fields: PaperCalcFormFields,
  warning: string | null,
): Promise<string | null> {
  let result = warning;
  if (fields.pending) {
    result ??= await attachPendingPaperCalculation(supabase, salesOrderId, fields.pending);
  }
  if (fields.copied) {
    result ??= await attachCopiedPaperCalculations(supabase, salesOrderId, fields.copied);
  }
  // TG0 자동 반영 줄이 위에서 만들어진 뒤에만 오버라이드를 적용할 수 있다.
  const override = parseOverride(fields.tg0OverrideRaw);
  if (override !== null) {
    await overrideSalesPaperStockQuantity(supabase, salesOrderId, override, "등록 시 직접 입력");
  }
  return result;
}

// 매입 쪽은 임시 계산 붙이기 결과가 기존 경고를 덮어쓰는 기존 동작을 그대로 유지한다.
export async function attachPaperCalcToPurchase(
  supabase: Supabase,
  purchaseOrderId: string,
  fields: PaperCalcFormFields,
  warning: string | null,
): Promise<string | null> {
  let result = warning;
  if (fields.pending) {
    result = await attachPendingPaperCalculationToPurchase(supabase, purchaseOrderId, fields.pending);
  }
  if (fields.copied) {
    result ??= await attachCopiedPaperCalculationsToPurchase(supabase, purchaseOrderId, fields.copied);
  }
  const override = parseOverride(fields.tg0OverrideRaw);
  if (override !== null) {
    await overridePurchasePaperStockQuantity(supabase, purchaseOrderId, override, "등록 시 직접 입력");
  }
  return result;
}

export async function attachPaperCalcToTodo(
  supabase: Supabase,
  todoId: string,
  pending: string | null,
): Promise<string | null> {
  return pending ? attachPendingPaperCalculationToTodo(supabase, todoId, pending) : null;
}
