"use server";

import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { BACKUP_TABLES, BACKUP_FORMAT_VERSION, RESTORE_SKIP_TABLES, type BackupFile } from "@/lib/backup-tables";
import { dispatchServerRestore } from "@/lib/github-restore";
import type { FormState } from "@/components/form-message";

// db-backups 브랜치의 파일명은 항상 이 형식의 UTC 타임스탬프다
// (.github/workflows/db-backup.yml의 `date -u +%Y-%m-%dT%H%M%SZ`).
const SNAPSHOT_FILENAME_RE = /^\d{4}-\d{2}-\d{2}T\d{6}Z\.dump$/;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// 백업 파일을 업로드해서 "지금 DB에 없는 데이터만" 다시 채워넣는다(관리자
// 전용). onConflict: "id" + ignoreDuplicates: true로 이미 존재하는 행은
// 절대 건드리지 않는다 — 백업 이후에 등록/수정된 데이터가 조용히
// 되돌아가거나 지워지는 일은 없다. 재해 상황(DB 전체 유실)처럼 완전히
// 그대로 되돌려야 하는 경우는 이 기능이 아니라 docs/db-backup-restore.md의
// pg_dump 기반 절차를 쓴다.
export async function restoreBackup(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "관리자만 복원할 수 있습니다." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "백업 파일을 선택해주세요." };
  }

  let parsed: BackupFile;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { error: "백업 파일을 읽을 수 없습니다 (JSON 형식이 아닙니다)." };
  }

  if (!parsed || typeof parsed !== "object" || !parsed.tables) {
    return { error: "이 파일은 백업 파일 형식이 아닙니다." };
  }
  if (parsed.formatVersion !== BACKUP_FORMAT_VERSION) {
    return {
      error: `백업 파일 형식 버전(${parsed.formatVersion ?? "알 수 없음"})이 지금 앱의 형식(${BACKUP_FORMAT_VERSION})과 달라 복원할 수 없습니다.`,
    };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "관리자 클라이언트 초기화에 실패했습니다." };
  }
  // 위에서 만든 admin 클라이언트를 이 함수 안에서만, 테이블마다 스키마가
  // 다른 동적 upsert 루프에 한해 느슨한 타입으로 다룬다.
  const db = admin as unknown as {
    from: (table: string) => {
      upsert: (
        rows: Record<string, unknown>[],
        opts: { onConflict: string; ignoreDuplicates: boolean }
      ) => { select: (cols: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> };
    };
  };

  const results: { table: string; restored: number; error?: string }[] = [];

  for (const table of BACKUP_TABLES) {
    if ((RESTORE_SKIP_TABLES as readonly string[]).includes(table)) continue;
    const rows = parsed.tables[table];
    if (!rows || rows.length === 0) continue;

    let restored = 0;
    let failMessage: string | undefined;
    for (const batch of chunk(rows, 500)) {
      const { data, error } = await db
        .from(table)
        .upsert(batch, { onConflict: "id", ignoreDuplicates: true })
        .select("id");
      if (error) {
        failMessage = error.message;
        break;
      }
      restored += data?.length ?? 0;
    }
    results.push({ table, restored, error: failMessage });
  }

  const failed = results.filter((r) => r.error);
  const totalRestored = results.reduce((sum, r) => sum + r.restored, 0);
  const summary = `총 ${totalRestored.toLocaleString()}건을 새로 채워넣었습니다 (이미 있던 데이터는 건드리지 않았습니다).`;

  if (failed.length > 0) {
    return {
      error: `${summary} 다만 ${failed.length}개 테이블에서 오류가 있었습니다: ${failed
        .map((r) => `${r.table}(${r.error})`)
        .join(", ")}`,
    };
  }

  return { success: summary };
}

// 재해복구(서버에서 시점 복원) — 백업 시점 그대로 DB를 통째로 되돌리는
// 파괴적 작업(pg_restore --clean)이라, 이 앱에서 직접 실행하지 않고
// GitHub Actions 워크플로우(db-restore.yml)를 호출만 한다. 실제 복원은
// 거기서 일어난다 — 자세한 배경은 docs/db-backup-restore.md 참고.
export async function restoreFromServerSnapshot(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "관리자만 복원할 수 있습니다." };

  const snapshot = formData.get("snapshot");
  if (typeof snapshot !== "string" || !SNAPSHOT_FILENAME_RE.test(snapshot)) {
    return { error: "복원할 백업 시점을 선택해주세요." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await dispatchServerRestore(snapshot, user?.email ?? user?.id ?? "알 수 없음");
  if (!result.ok) {
    return { error: result.error ?? "복원 요청에 실패했습니다." };
  }

  return {
    success: `복원 요청을 GitHub Actions로 보냈습니다 (${snapshot}). 완료까지 몇 분 걸릴 수 있으니 Actions 탭에서 진행 상황을 확인하세요.`,
  };
}
