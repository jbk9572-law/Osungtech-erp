import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { assertFileUploadAllowed } from "@/lib/quota/tenant-quota";
import { isR2Configured, uploadObjectToR2, deleteObjectFromR2, getR2DownloadUrl } from "@/lib/r2/client";

// 모든 첨부파일 업로드가 거쳐가는 공용 관문. 두 가지를 한 곳에서 보장한다:
// 1) 쿼터 체크 — 파일 저장소 300MB 쿼터를 넘기면(유예 110%까지) 업로드
//    자체를 막는다. 기존 4개 업로드 지점(messenger/payment-receipts/mail/
//    branding,signature)이 각자 따로 체크를 넣으면 한 곳을 빠뜨리기 쉬워
//    (버그 수정 규칙 2번) 업로드하는 모든 곳이 이 함수 하나만 거치게 한다.
// 2) R2 전환 — Cloudflare R2 환경변수가 설정되면 preferR2: true로 명시
//    opt-in한 호출부만 R2에 저장한다. 메일 첨부(mail/actions.ts,
//    mail/sync.ts)는 읽는 쪽이 이미 매번 새로 만드는 단기 Presigned URL
//    (getAttachmentDownloadUrl, 10분)만 쓰고 있어서 전환했다 — 전제가
//    R2와 완전히 같다. messenger-attachments/payment-receipts는 "영구
//    공개 URL을 DB 컬럼에 저장해두고 그대로 렌더링"하는 구조라 R2로
//    옮기면 영구 URL이 없어지므로, 읽기 쪽 화면(messenger-page.tsx,
//    영수증 갤러리 등)을 먼저 Presigned 방식으로 바꾸기 전까지는 opt-in
//    하지 않는다 — 자격증명만 있다고 전부 조용히 R2로 바뀌면 "영구
//    URL이 갑자기 깨지는" 사고로 이어진다.
// 쿼터 집계 RPC는 "이미 끝난 업로드/삭제 뒤의 부가 기록"이라 실패해도
// 방금 끝난 파일 작업 자체를 되돌리지 않는다(이미 성공한 업로드를 실패로
// 바꾸는 게 더 나쁘다) — 대신 조용히 삼키지 않고 로그를 남겨 사용량이
// 실제와 어긋나고 있다는 걸 나중에 추적할 수 있게 한다.
async function trackFileUsage(supabase: SupabaseClient<Database>, deltaBytes: number): Promise<void> {
  const { error } = await supabase.rpc("increment_tenant_file_usage", { p_delta_bytes: deltaBytes });
  if (error) console.error("파일 쿼터 사용량 갱신 실패:", error.message);
}

export type AttachmentUploadResult =
  | { ok: true; path: string; backend: "r2" | "supabase"; publicUrl: string | null }
  | { ok: false; error: string };

export async function uploadAttachment(opts: {
  supabase: SupabaseClient<Database>;
  bucket: string;
  path: string;
  file: File | Blob;
  contentType: string;
  preferR2?: boolean;
}): Promise<AttachmentUploadResult> {
  const size = opts.file.size;

  const quota = await assertFileUploadAllowed(opts.supabase, size);
  if (!quota.allowed) return { ok: false, error: quota.message };

  if (opts.preferR2 && isR2Configured()) {
    const key = `r2/${opts.bucket}/${opts.path}`;
    let buffer: Buffer;
    try {
      buffer = Buffer.from(await opts.file.arrayBuffer());
      await uploadObjectToR2(key, buffer, opts.contentType);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "R2 업로드에 실패했습니다." };
    }
    await trackFileUsage(opts.supabase, size);
    return { ok: true, path: key, backend: "r2", publicUrl: null };
  }

  const { error } = await opts.supabase.storage
    .from(opts.bucket)
    .upload(opts.path, opts.file, { contentType: opts.contentType, upsert: true });
  if (error) return { ok: false, error: error.message };

  await trackFileUsage(opts.supabase, size);

  const {
    data: { publicUrl },
  } = opts.supabase.storage.from(opts.bucket).getPublicUrl(opts.path);
  return { ok: true, path: opts.path, backend: "supabase", publicUrl };
}

// r2/ 접두사로 저장 경로의 백엔드를 구분한다 — 테이블마다 별도 backend
// 컬럼을 추가하는 대신, 이미 고유해야 하는 path/storage_path 값 자체에
// 식별자를 담아 스키마 변경을 최소화했다(기존 경로는 절대 "r2/"로
// 시작하지 않으므로 안전하게 구분된다).
export async function deleteAttachment(opts: {
  supabase: SupabaseClient<Database>;
  bucket: string;
  path: string;
  sizeBytes: number | null | undefined;
}): Promise<void> {
  if (opts.path.startsWith("r2/")) {
    await deleteObjectFromR2(opts.path);
  } else {
    await opts.supabase.storage.from(opts.bucket).remove([opts.path]);
  }
  if (opts.sizeBytes) {
    await trackFileUsage(opts.supabase, -opts.sizeBytes);
  }
}

// 일괄 삭제(지급결의서 삭제 시 영수증 전체 등) 전용 — 개별 deleteAttachment를
// N번 호출하면 쿼터 RPC도 N번 왕복하게 되어, 한 건으로 묶어 한 번만 반영한다.
export async function deleteAttachments(
  supabase: SupabaseClient<Database>,
  bucket: string,
  items: { path: string; sizeBytes: number | null | undefined }[],
): Promise<void> {
  if (items.length === 0) return;

  const r2Paths = items.filter((it) => it.path.startsWith("r2/")).map((it) => it.path);
  const supabasePaths = items.filter((it) => !it.path.startsWith("r2/")).map((it) => it.path);

  await Promise.all([
    ...r2Paths.map((key) => deleteObjectFromR2(key)),
    supabasePaths.length > 0 ? supabase.storage.from(bucket).remove(supabasePaths) : Promise.resolve(),
  ]);

  const totalBytes = items.reduce((sum, it) => sum + (it.sizeBytes ?? 0), 0);
  if (totalBytes > 0) {
    await trackFileUsage(supabase, -totalBytes);
  }
}

export async function getAttachmentDownloadUrl(opts: {
  supabase: SupabaseClient<Database>;
  bucket: string;
  path: string;
  expiresInSeconds?: number;
}): Promise<string | null> {
  if (opts.path.startsWith("r2/")) {
    return getR2DownloadUrl(opts.path, opts.expiresInSeconds ?? 600);
  }
  const { data } = await opts.supabase.storage.from(opts.bucket).createSignedUrl(opts.path, opts.expiresInSeconds ?? 600);
  return data?.signedUrl ?? null;
}
