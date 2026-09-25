-- 견적서 "발송" 버튼이 지금까지는 quotes.status를 'sent'로 바꾸는 것
-- 뿐이었고 실제 이메일 발송과 전혀 연결돼 있지 않았다(사용자 지적). 공문관리
-- 모듈(migration 142)이 쓰는 mail_accounts + sendMail 패턴을 그대로 견적서에도
-- 붙이면서, 실제로 이메일이 나간 시각을 남길 sent_at 컬럼을 추가한다.
alter table public.quotes add column if not exists sent_at timestamptz;
