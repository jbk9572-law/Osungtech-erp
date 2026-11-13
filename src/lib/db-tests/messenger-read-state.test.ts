import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createHarness, enableRowLevelSecurity, type Harness } from "./pg-harness";

// 메신저 안 읽음 저장(migration 236): 안 읽은 개수가 맞게 세어지고, 읽음 처리가 되며, 남의 채널에는 읽음 행을
// 만들 수 없어야 한다.

let h: Harness;
let chAll: string;
let chDmOthers: string;
let userB: string;
let userC: string;

beforeEach(async () => {
  h = await createHarness();
  userB = crypto.randomUUID();
  userC = crypto.randomUUID();
  chAll = crypto.randomUUID();
  chDmOthers = crypto.randomUUID();
  const t = h.ids.tenant;
  await h.db.exec(`
    alter table public.profiles add column if not exists full_name text;
    alter table public.profiles add column if not exists created_at timestamptz default '2026-01-01';
    insert into public.profiles (id, role, full_name) values ('${userB}', 'staff', '박대리'), ('${userC}', 'staff', '최사원');
    update public.profiles set full_name = '김과장' where id = '${h.ids.staff}';
    insert into public.tenant_members (user_id, tenant_id) values ('${userB}', '${t}'), ('${userC}', '${t}');

    create table public.messenger_channels (id uuid primary key, tenant_id uuid default public.current_tenant_id(), is_demo boolean default false, type text, name text, created_by uuid, created_at timestamptz default now());
    create table public.messenger_channel_members (channel_id uuid, user_id uuid, tenant_id uuid default public.current_tenant_id(), is_demo boolean default false, joined_at timestamptz default now(), primary key (channel_id, user_id));
    create table public.messenger_messages (id uuid primary key default gen_random_uuid(), channel_id uuid, sender_id uuid, content text default '', created_at timestamptz default now());
    create or replace function public.is_messenger_channel_member(p_channel_id uuid) returns boolean language sql security definer stable as $$
      select exists (select 1 from public.messenger_channels c where c.id = p_channel_id and (c.type = 'all' or exists (select 1 from public.messenger_channel_members m where m.channel_id = p_channel_id and m.user_id = auth.uid())))
    $$;
    insert into public.messenger_channels (id, tenant_id, type) values ('${chAll}', '${t}', 'all'), ('${chDmOthers}', '${t}', 'dm');
    insert into public.messenger_channel_members (channel_id, user_id, tenant_id) values ('${chDmOthers}', '${userB}', '${t}'), ('${chDmOthers}', '${userC}', '${t}');
  `);
  await enableRowLevelSecurity(h.db); // authenticated 역할을 만든다(마이그레이션의 grant보다 먼저)
  for (const f of ["00000000000236_messenger_read_state.sql", "00000000000237_messenger_unread_window.sql", "00000000000238_messenger_mute_and_system_alerts.sql"]) {
    await h.db.exec(fs.readFileSync(path.join(process.cwd(), "supabase", "migrations", f), "utf8"));
  }
  // 운영 messenger_messages는 "내가 볼 수 있는 채널"만 읽히게 RLS가 걸려 있다(migration 137) — 같은 규칙을 재현한다.
  await h.db.exec(`
    alter table public.messenger_messages enable row level security;
    create policy messenger_messages_select on public.messenger_messages for select using (public.is_messenger_channel_member(channel_id));
  `);
  await h.db.exec(`grant all on all tables in schema public to authenticated; grant all on all functions in schema public to authenticated;`);
  await h.as(h.ids.staff);
  await h.db.exec("set role authenticated");
}, 60000);

// 시드 메시지는 RLS 밖(관리 권한)에서 넣고, 조회는 항상 일반 사용자 권한으로 한다.
const say = async (channel: string, sender: string, content: string, at: string) => {
  await h.db.exec("reset role");
  await h.db.query(`insert into public.messenger_messages (channel_id, sender_id, content, created_at) values ($1, $2, $3, $4)`, [channel, sender, content, at]);
  await h.db.exec("set role authenticated");
};

describe("get_messenger_unread / mark_messenger_channel_read", () => {
  it("남이 보낸 새 메시지만 채널별로 세고, 내가 보낸 건 세지 않는다", async () => {
    await say(chAll, userB, "안녕하세요", "2026-11-20 09:00:00+00");
    await say(chAll, userC, "회의 3시", "2026-11-20 09:05:00+00");
    await say(chAll, h.ids.staff, "넵", "2026-11-20 09:06:00+00");
    const r = await h.db.query(`select * from public.get_messenger_unread()`);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ channel_label: "전체", last_sender_name: "최사원", last_content: "회의 3시" });
    expect(Number((r.rows[0] as { unread_count: number }).unread_count)).toBe(2);
  });

  it("읽음 처리하면 0이 되고, 그 뒤 새 메시지는 다시 센다", async () => {
    await say(chAll, userB, "하나", "2026-11-20 09:00:00+00");
    await h.db.query(`select public.mark_messenger_channel_read($1)`, [chAll]);
    // 가상 DB의 시계는 실제 시각이라 "시간이 흐른 뒤"를 직접 만든다 — 읽은 시각을 12/1로 옮겨 둔다.
    await h.db.exec(`reset role; update public.messenger_channel_reads set last_read_at = '2026-12-01 00:00:00+00'; set role authenticated;`);
    expect((await h.db.query(`select * from public.get_messenger_unread()`)).rows).toHaveLength(0);
    await say(chAll, userB, "둘", "2026-12-02 00:00:00+00");
    expect((await h.db.query(`select * from public.get_messenger_unread()`)).rows).toHaveLength(1);
  });

  it("기능이 켜지기 전(2026-11-13 06:00 UTC 이전) 메시지는 안 읽음으로 세지 않는다", async () => {
    await say(chAll, userB, "옛날 메시지", "2026-06-01 09:00:00+00");
    expect((await h.db.query(`select * from public.get_messenger_unread()`)).rows).toHaveLength(0);
  });

  it("내가 속하지 않은 DM 채널은 읽음 행을 만들 수도, 메시지를 셀 수도 없다", async () => {
    await say(chDmOthers, userB, "둘만의 대화", "2026-11-20 09:00:00+00");
    expect((await h.db.query(`select * from public.get_messenger_unread()`)).rows).toHaveLength(0);
    await h.db.query(`select public.mark_messenger_channel_read($1)`, [chDmOthers]);
    await h.as(h.ids.admin);
    const rows = await h.db.query(`select 1 from public.messenger_channel_reads`);
    expect(rows.rows).toHaveLength(0);
  });

  it("시스템 자동 알림(보낸 사람 없음)은 안 읽은 개수에 넣지 않는다", async () => {
    await h.db.exec("reset role");
    await h.db.query(`insert into public.messenger_messages (channel_id, sender_id, content, created_at) values ($1, null, '미수금 연체 알림', '2026-11-20 09:00:00+00')`, [chAll]);
    await h.db.exec("set role authenticated");
    expect((await h.db.query(`select * from public.get_messenger_unread()`)).rows).toHaveLength(0);
  });

  it("알림을 끈 방은 안 읽은 목록에서 빠지고, 다시 켜면 돌아온다", async () => {
    await say(chAll, userB, "회의 3시", "2026-11-20 09:00:00+00");
    await h.db.query(`select public.set_messenger_channel_muted($1, true)`, [chAll]);
    // 가상 DB 시계 문제로 읽은 시각을 과거로 돌려 둔다(끄는 순간 now()로 기록되므로).
    await h.db.exec(`reset role; update public.messenger_channel_reads set last_read_at = '2026-11-14 00:00:00+00'; set role authenticated;`);
    expect((await h.db.query(`select * from public.get_messenger_unread()`)).rows).toHaveLength(0);
    await h.db.query(`select public.set_messenger_channel_muted($1, false)`, [chAll]);
    expect((await h.db.query(`select * from public.get_messenger_unread()`)).rows).toHaveLength(1);
  });

  it("푸시 대상에서 알림을 끈 사람만 거르고, 채널 멤버가 아닌 사람은 아무것도 얻지 못한다", async () => {
    await h.as(userB);
    await h.db.query(`select public.set_messenger_channel_muted($1, true)`, [chDmOthers]);
    await h.as(userC);
    const r = await h.db.query(`select * from public.messenger_unmuted_recipients($1, $2::uuid[])`, [chDmOthers, `{${userB},${userC}}`]);
    expect(r.rows.map((x) => (x as { messenger_unmuted_recipients: string }).messenger_unmuted_recipients)).toEqual([userC]);
    await h.as(h.ids.staff); // chDmOthers의 멤버가 아니다
    expect((await h.db.query(`select * from public.messenger_unmuted_recipients($1, $2::uuid[])`, [chDmOthers, `{${userB}}`])).rows).toHaveLength(0);
  });
});
