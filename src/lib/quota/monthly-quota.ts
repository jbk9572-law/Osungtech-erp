import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// 요금제의 월 한도(이메일 발송·세금계산서 발행). 한도에 도달하면 새 발송/발행을 막는다 —
// 파일 용량처럼 서서히 막는 유예 구간은 두지 않는다(건수 한도는 "이번 달 N건"이라는 명확한 약속이라서).
// 사용량은 발송/발행이 끝난 뒤 increment_* RPC 가 올린다(recordEmailSent / recordInvoiceIssued).
// 한도 조회 자체가 실패하면 업무를 막지 않고 통과시킨다(fail-open, 로그만 남김) — 한도 확인 장애가 발송을 멈추면 안 된다.
export type MonthlyQuotaKind = "email" | "invoice";

type QuotaStatus = {
  exempt: boolean;
  email_used: number;
  email_quota: number;
  invoice_used: number;
  invoice_quota: number;
};

const LABEL: Record<MonthlyQuotaKind, string> = { email: "이메일 발송", invoice: "세금계산서 발행" };

type Client = SupabaseClient<Database>;

export async function remainingMonthlyQuota(supabase: Client, kind: MonthlyQuotaKind): Promise<{ remaining: number; quota: number } | null> {
  const { data, error } = await supabase.rpc("get_monthly_quota_status");
  if (error || !data) {
    console.error("월 한도 조회 실패(통과 처리):", error?.message);
    return null;
  }
  const s = data as unknown as QuotaStatus;
  if (s.exempt) return null;
  const quota = Number(kind === "email" ? s.email_quota : s.invoice_quota);
  const used = Number(kind === "email" ? s.email_used : s.invoice_used);
  return { remaining: Math.max(0, quota - used), quota };
}

export function quotaExceededMessage(kind: MonthlyQuotaKind, quota: number): string {
  return `이번 달 ${LABEL[kind]} 한도(${quota}건)를 모두 사용했습니다. 운영자에게 문의해 한도를 늘리거나 다음 달에 이용해주세요.`;
}

// 지금 needed 건을 처리할 수 있으면 null, 아니면 화면에 보일 안내 문구.
export async function checkMonthlyQuota(supabase: Client, kind: MonthlyQuotaKind, needed = 1): Promise<string | null> {
  const q = await remainingMonthlyQuota(supabase, kind);
  if (!q || q.remaining >= needed) return null;
  return quotaExceededMessage(kind, q.quota);
}

export async function recordEmailSent(supabase: Client): Promise<void> {
  const { error } = await supabase.rpc("increment_tenant_email_usage");
  if (error) console.error("[mail] failed to track email usage:", error);
}

export async function recordInvoiceIssued(supabase: Client): Promise<void> {
  const { error } = await supabase.rpc("increment_tenant_invoice_usage");
  if (error) console.error("계산서 쿼터 사용량 갱신 실패:", error.message);
}
