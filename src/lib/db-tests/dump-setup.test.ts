import fs from "node:fs";
import { it } from "vitest";
import { FUNCTIONS_UNDER_TEST, SCHEMA_SQL, latestFunctionSql } from "./pg-harness";

// scripts/db-concurrency(진짜 Postgres 동시성 시험)에 올릴 "테스트용 스키마 + 최신 DB 함수" SQL을 파일로 뽑는다.
// DUMP_OUT 환경변수가 있을 때만 실행된다(평소 테스트에서는 건너뜀).
it.skipIf(!process.env.DUMP_OUT)("동시성 시험용 설정 SQL을 DUMP_OUT 파일로 내보낸다", () => {
  const read = (f: string) => fs.readFileSync(`supabase/migrations/${f}`, "utf8");
  const guard = read("00000000000242_guard_purchase_link_capacity.sql").match(/create constraint trigger guard_purchase_link_capacity[\s\S]*?;/)![0];
  const todo = (read("00000000000243_todo_reopen_on_order_delete.sql").match(/create trigger [\s\S]*?;/g) ?? []).join("\n");
  fs.writeFileSync(process.env.DUMP_OUT!, [SCHEMA_SQL, ...FUNCTIONS_UNDER_TEST.map(latestFunctionSql), guard, todo].join("\n\n"));
});
