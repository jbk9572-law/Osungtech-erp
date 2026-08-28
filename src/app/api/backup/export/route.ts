import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { BACKUP_TABLES, BACKUP_FORMAT_VERSION, type BackupFile } from "@/lib/backup-tables";

// 전체 업무 데이터를 JSON 한 파일로 내려받는다(관리자 전용). service_role
// 클라이언트로 RLS 없이 전부 읽는다 — 그래야 다른 직원이 등록한 매출/매입도
// 빠짐없이 백업에 들어간다.
export async function GET() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    return new Response("관리자만 백업을 내려받을 수 있습니다.", { status: 403 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "관리자 클라이언트 초기화에 실패했습니다.", {
      status: 500,
    });
  }

  const backup: BackupFile = {
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    tables: {},
  };

  // 테이블마다 스키마가 달라 공용 admin 클라이언트의 제네릭 타입으로는
  // 표현할 수 없다 — 이 파일 안에서만, 서비스 롤로 그대로 select("*")한
  // 값을 담는 용도로 한정해 타입을 느슨하게 쓴다.
  const db = admin as unknown as {
    from: (table: string) => {
      select: (cols: string) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
    };
  };

  for (const table of BACKUP_TABLES) {
    const { data, error } = await db.from(table).select("*");
    if (error) {
      return new Response(`백업 중 오류 (${table}): ${error.message}`, { status: 500 });
    }
    backup.tables[table] = data ?? [];
  }

  const stamp = backup.createdAt.replace(/[:.]/g, "-");
  return new Response(JSON.stringify(backup), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="osungtech-backup_${stamp}.json"`,
    },
  });
}
