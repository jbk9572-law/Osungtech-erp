-- 사용자가 올린 메인 대시보드 목업의 "긴급 결제 및 수금 리마인더"
-- 위젯(예: "(주)타이거일렉 마감 임박 6,180,000원") — 지금 앱엔 미수금
-- 연체를 능동적으로 알려주는 길이 없고(/receivables에서 직접 들어가
-- 봐야만 연체일수가 보임), 안전재고부족/할일마감처럼 메신저 "전체"
-- 채널로 자동 알림이 가는 건 이 두 가지뿐이었다(migration 169). 같은
-- 패턴으로 세 번째 알림 종류를 추가한다 — 새 테이블/화면 없이
-- messenger-system-alerts.ts의 기존 크론 루프에 한 블록만 더 얹는다.
alter table public.messenger_system_alert_state drop constraint if exists messenger_system_alert_state_alert_type_check;
alter table public.messenger_system_alert_state
  add constraint messenger_system_alert_state_alert_type_check
  check (alert_type in ('low_stock', 'todo_due', 'receivable_overdue'));
