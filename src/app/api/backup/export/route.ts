import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { BACKUP_TABLES, BACKUP_FORMAT_VERSION, type BackupFile } from "@/lib/backup-tables";

// 전체 업무 데이터를 JSON 한 파일로 내려받는다(관리자 전용). service_role
// 클라이언트로 RLS 없이 전부 읽는다 — 그래야 다른 직원이 등록한 매출/매입도
// 빠짐없이 백업에 들어간다. service_role은 RLS를 완전히 우회하므로, 이
// 테넌트/데모 필터를 코드에서 직접 걸지 않으면 다른 회사(테넌트)의 데이터까지
// 통째로 새어나간다 — 아래 tenant_id/is_demo .eq() 필터가 그 대신이다.
export async function GET() {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) {
    return new Response("관리자만 백업을 내려받을 수 있습니다.", { status: 403 });
  }

  const [{ data: tenantId, error: tenantIdError }, { data: isDemo, error: isDemoError }] = await Promise.all([
    supabase.rpc("current_tenant_id"),
    supabase.rpc("is_demo_actor"),
  ]);
  if (tenantIdError || !tenantId) {
    return new Response(
      `소속 회사를 확인하지 못해 백업을 중단했습니다: ${tenantIdError?.message ?? "알 수 없는 오류"}`,
      { status: 500 }
    );
  }
  if (isDemoError) {
    return new Response(`계정 종류를 확인하지 못해 백업을 중단했습니다: ${isDemoError.message}`, { status: 500 });
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
      select: (
        cols: string
      ) => {
        eq: (
          col: string,
          value: unknown
        ) => {
          eq: (
            col: string,
            value: unknown
          ) => {
            range: (
              from: number,
              to: number
            ) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
          };
        };
      };
    };
  };

  // PostgREST는 supabase/config.toml의 max_rows(1000)를 넘으면 별도 에러
  // 없이 결과를 그 값까지만 잘라서 돌려준다 — .range()로 직접 페이지를
  // 넘기며 전부 받아와야 1000건 넘는 테이블(거래 이력 등)이 뒷부분만
  // 조용히 누락되는 일을 막을 수 있다.
  //
  // 복원(restoreBackup, settings/backup/actions.ts)은 외래키 제약 때문에
  // BACKUP_TABLES 순서를 반드시 지켜 한 테이블씩 순서대로 넣어야 하지만,
  // 내보내기는 그냥 읽기만 할 뿐 테이블 간 순서 의존성이 없다 — 예전엔
  // 복원과 같은 습관으로 여기도 테이블마다 await을 순서대로 기다렸는데,
  // 테이블이 28개라 왕복 지연이 그대로 쌓여 느렸다. 테이블 단위는
  // Promise.all로 동시에 돌리고, 같은 테이블 안의 페이지만 순서대로
  // 받는다(한 테이블의 다음 페이지는 그 앞 페이지가 1000건 꽉 찼는지
  // 봐야 알 수 있어서 페이지 자체는 병렬화할 수 없다).
  const PAGE_SIZE = 1000;
  async function fetchAllRowsForTable(table: (typeof BACKUP_TABLES)[number]) {
    const rows: Record<string, unknown>[] = [];
    for (let page = 0; ; page++) {
      const from = page * PAGE_SIZE;
      const { data, error } = await db
        .from(table)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_demo", isDemo === true)
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        throw new Error(`백업 중 오류 (${table}): ${error.message}`);
      }
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE_SIZE) break;
    }
    return { table, rows };
  }

  try {
    const results = await Promise.all(BACKUP_TABLES.map((table) => fetchAllRowsForTable(table)));
    for (const { table, rows } of results) {
      backup.tables[table] = rows;
    }
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "백업 중 알 수 없는 오류가 발생했습니다.", { status: 500 });
  }

  const stamp = backup.createdAt.replace(/[:.]/g, "-");
  return new Response(JSON.stringify(backup), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="erp-backup_${stamp}.json"`,
    },
  });
}
