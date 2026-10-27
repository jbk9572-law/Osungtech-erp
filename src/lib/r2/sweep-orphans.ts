import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { isR2Configured, listAllR2Objects, deleteObjectFromR2, type R2ObjectSummary } from "./client";

// R2에 저장된 파일(key)이 가리키는 DB 행이 삭제됐는데도 R2 객체 자체는
// 남아있는 "고아 파일"을 찾아 지운다. Postgres 트리거가 직접 R2(외부
// HTTPS)를 호출하게 만들 수도 있었지만, 그러려면 pg_net 확장을 새로
// 켜고 트리거 실패가 원본 삭제 트랜잭션까지 묶이는 리스크를 안아야
// 한다 — 지금처럼 R2로 옮긴 테이블이 1개뿐이고 삭제 경로 자체가 아직
// 거의 없는 단계에서는 과한 엔지니어링이라, 대신 주기적으로 도는 이
// 정리 스크립트(scripts/sweep-orphan-r2-files.ts, GitHub Actions 크론)로
// 같은 효과를 낸다 — 앱 코드가 어떤 삭제 경로를 빼먹어도 결국 이 스윕이
// 잡아준다는 안전망.
//
// 새 테이블이 preferR2: true로 R2에 올리기 시작하면(지금은
// mail_attachments.storage_path 하나뿐 — messenger/payment-receipts는
// 아직 영구 공개 URL 전제라 R2로 안 옮김, src/lib/storage/
// upload-attachment.ts 주석 참고) 이 배열에 한 줄만 추가하면 된다.
const KNOWN_R2_REFERENCE_COLUMNS: Array<{
  label: string;
  fetch: (supabase: SupabaseClient<Database>) => Promise<string[]>;
}> = [
  {
    label: "mail_attachments.storage_path",
    fetch: async (supabase) => {
      const rows = await fetchAllRows<{ storage_path: string }>((from, to) =>
        supabase.from("mail_attachments").select("storage_path").like("storage_path", "r2/%").range(from, to),
      );
      return rows.map((r) => r.storage_path);
    },
  },
];

export type OrphanSweepResult = {
  scanned: number;
  referenced: number;
  skippedRecent: number;
  deleted: string[];
};

export async function sweepOrphanR2Files(opts: {
  supabase: SupabaseClient<Database>;
  dryRun?: boolean;
  // 업로드 직후(R2에 Put은 끝났지만 DB insert가 아직 반영 안 된 그 짧은
  // 틈)에 스윕이 돌면 방금 올라간 정상 파일을 "참조 없음"으로 잘못 보고
  // 지워버릴 수 있다 — 그 사고를 막기 위한 유예 기간. 기본 24시간이면
  // 업로드→DB insert 사이의 지연(보통 수백 ms)보다 훨씬 넉넉하다.
  graceMs?: number;
  listObjects?: () => Promise<R2ObjectSummary[]>;
  deleteObject?: (key: string) => Promise<void>;
}): Promise<OrphanSweepResult> {
  if (!isR2Configured()) {
    return { scanned: 0, referenced: 0, skippedRecent: 0, deleted: [] };
  }

  const graceMs = opts.graceMs ?? 24 * 60 * 60 * 1000;
  const deleteObject = opts.deleteObject ?? deleteObjectFromR2;

  // ListObjectsV2도 R2 쓰기(Class A) 과금 대상이라, 테스트가 주입하는
  // listObjects가 아니라 실제 R2를 호출하는 기본 경로를 쓸 때만 페이지
  // 수만큼 호출횟수를 집계한다(DeleteObject는 R2에서 무료라 집계 안 함).
  let listApiCalls = 0;
  const listObjects =
    opts.listObjects ?? (() => listAllR2Objects({ onApiCall: () => { listApiCalls++; } }));

  const objects = await listObjects();
  if (listApiCalls > 0) {
    const { error } = await opts.supabase.rpc("increment_platform_r2_class_a_ops", { p_count: listApiCalls });
    if (error) console.error("R2 호출횟수 집계 실패:", error.message);
  }

  const referenced = new Set<string>();
  for (const column of KNOWN_R2_REFERENCE_COLUMNS) {
    for (const key of await column.fetch(opts.supabase)) referenced.add(key);
  }

  const now = Date.now();
  const deleted: string[] = [];
  let skippedRecent = 0;

  for (const obj of objects) {
    if (referenced.has(obj.key)) continue;
    const ageMs = obj.lastModified ? now - obj.lastModified.getTime() : 0;
    if (ageMs < graceMs) {
      skippedRecent++;
      continue;
    }
    if (!opts.dryRun) await deleteObject(obj.key);
    deleted.push(obj.key);
  }

  return { scanned: objects.length, referenced: referenced.size, skippedRecent, deleted };
}
