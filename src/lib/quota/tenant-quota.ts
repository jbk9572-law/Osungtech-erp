import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// 80%/95%/100%+유예 — 저가형 SaaS에서 용량이 찼다고 갑자기 저장을 막으면
// 고객이 불신을 느끼고 이탈한다는 요청사항을 반영한 임계값. 100%를 넘긴
// 뒤에도 바로 잠그지 않고 GRACE_OVER_RATIO(110%)까지는 계속 쓸 수 있게
// 완충 구간을 둔다 — 그 사이에 관리자가 운영자 문의로 용량을 늘리거나
// 불필요한 데이터를 정리할 시간을 번다.
export const QUOTA_WARN_RATIO = 0.8;
export const QUOTA_DANGER_RATIO = 0.95;
export const QUOTA_GRACE_OVER_RATIO = 1.1;

export type QuotaBucket = "ok" | "warn" | "danger" | "grace_over" | "blocked";

export function bucketForPct(pct: number): QuotaBucket {
  const ratio = pct / 100;
  if (ratio >= QUOTA_GRACE_OVER_RATIO) return "blocked";
  if (ratio >= 1) return "grace_over";
  if (ratio >= QUOTA_DANGER_RATIO) return "danger";
  if (ratio >= QUOTA_WARN_RATIO) return "warn";
  return "ok";
}

export type TenantQuotaStatus = {
  dbBytesUsed: number;
  dbQuotaBytes: number;
  dbPct: number;
  dbBucket: QuotaBucket;
  fileBytesUsed: number;
  fileQuotaBytes: number;
  filePct: number;
  fileBucket: QuotaBucket;
};

type QuotaRpcRow = {
  db_bytes_used: number | null;
  db_quota_bytes: number | null;
  db_pct: number | null;
  file_bytes_used: number | null;
  file_quota_bytes: number | null;
  file_pct: number | null;
};

// (dashboard)/layout.tsx의 safeQuery+ttlCached 패턴과 함께 쓸 수 있도록
// "RPC 원시 행 -> 상태" 변환만 순수 함수로 뺐다 — 레이아웃은 이미 자기
// 자신의 캐시/에러-내구성 래퍼를 쓰고 있어 여기서 또 supabase 클라이언트를
// 새로 호출하면 캐시가 중복된다.
export function quotaStatusFromRpcRow(data: QuotaRpcRow): TenantQuotaStatus {
  const dbPct = Number(data.db_pct ?? 0);
  const filePct = Number(data.file_pct ?? 0);

  return {
    dbBytesUsed: Number(data.db_bytes_used ?? 0),
    dbQuotaBytes: Number(data.db_quota_bytes ?? 0),
    dbPct,
    dbBucket: bucketForPct(dbPct),
    fileBytesUsed: Number(data.file_bytes_used ?? 0),
    fileQuotaBytes: Number(data.file_quota_bytes ?? 0),
    filePct,
    fileBucket: bucketForPct(filePct),
  };
}

// 쿼터 숫자 자체는 get_tenant_quota_status() RPC(마이그레이션 186)가
// 계산해서 돌려준다 — 퍼센트 산출을 프론트/서버 양쪽에서 각자 다시
// 구현하면 나눗셈 방식이 미묘하게 어긋날 수 있어 DB를 단일 출처로 둔다.
export async function getTenantQuotaStatus(
  supabase: SupabaseClient<Database>,
): Promise<TenantQuotaStatus | null> {
  const { data, error } = await supabase.rpc("get_tenant_quota_status").maybeSingle();
  if (error || !data) return null;
  return quotaStatusFromRpcRow(data);
}

export type QuotaBannerInfo = { tone: "warn" | "danger"; message: string } | null;

// 요청사항의 "80%/95%에서 친절한 안내, 100%를 넘어도 즉시 잠그지 않고
// 관리자에게 경고"를 하나의 메시지 선택 로직으로 모은다 — DB/파일 두
// 쿼터 중 더 급한 쪽(worse) 기준으로 배너 하나만 띄운다(둘 다 동시에
// 걸리는 경우에도 화면에 배너 두 줄이 겹치지 않게).
export function buildQuotaBannerMessage(status: TenantQuotaStatus, isAdmin: boolean): QuotaBannerInfo {
  const worse =
    status.dbPct >= status.filePct
      ? { label: "DB", bucket: status.dbBucket }
      : { label: "파일 저장소", bucket: status.fileBucket };

  if (worse.bucket === "ok") return null;

  if (worse.bucket === "warn") {
    return {
      tone: "warn",
      message: `저장 공간(${worse.label})이 80%를 넘었습니다. 안정적인 사용을 위해 추가 용량 검토가 필요합니다.`,
    };
  }
  if (worse.bucket === "danger") {
    return {
      tone: "danger",
      message: `저장 공간(${worse.label})이 95%를 넘었습니다. 곧 가득 차면 저장이 지연될 수 있습니다 — 운영자 문의로 미리 용량을 요청해주세요.`,
    };
  }
  // grace_over/blocked(100%+) — 바로 잠그지 않고 유예 구간 동안은 계속
  // 쓸 수 있다는 점을 분명히 알린다. 관리자에게는 조치를 유도하는 문구,
  // 일반 사용자에게는 관리자에게 문의해야 한다는 안내로 구분한다.
  return {
    tone: "danger",
    message: isAdmin
      ? `저장 공간(${worse.label})을 초과했습니다. 지금은 계속 쓸 수 있지만 곧 제한될 수 있어, 운영자 문의로 추가 용량을 요청해주세요.`
      : `저장 공간(${worse.label})이 가득 찼습니다. 관리자에게 추가 용량 요청을 부탁해주세요.`,
  };
}

// 파일 업로드 전 호출 — 업로드할 바이트까지 더했을 때 유예 구간(110%)을
// 넘기면 그제서야 막는다. DB 전표 등록은 업로드처럼 "파일 하나"로 끊어서
// 미리 크기를 알 수 없고(여러 테이블에 걸쳐 트리거가 갱신), 스펙도 DB
// 쪼터는 하드 블록 대상이 아니라고 명시했으므로 이 체크는 파일 업로드
// 전용이다.
export async function assertFileUploadAllowed(
  supabase: SupabaseClient<Database>,
  additionalBytes: number,
): Promise<{ allowed: true; bucket: QuotaBucket } | { allowed: false; message: string }> {
  const status = await getTenantQuotaStatus(supabase);
  if (!status) return { allowed: true, bucket: "ok" };

  const projectedBytes = status.fileBytesUsed + additionalBytes;
  const projectedPct = status.fileQuotaBytes > 0 ? (projectedBytes / status.fileQuotaBytes) * 100 : 0;
  const projectedBucket = bucketForPct(projectedPct);

  if (projectedBucket === "blocked") {
    return {
      allowed: false,
      message:
        "파일 저장 공간이 한도를 초과해 더 이상 업로드할 수 없습니다. 운영자 문의로 추가 용량을 요청해주세요.",
    };
  }
  return { allowed: true, bucket: projectedBucket };
}
