-- 근태 GPS 위치 확인.
--
-- 지금까지 출퇴근 체크는 시각만 기록해서, 실제로 회사에 있었는지 전혀
-- 확인할 방법이 없었다("모바일에서만 해도 대충 체크되는거잖아" 지적).
-- 웹페이지에서는 연결된 WiFi 이름(SSID)을 읽을 방법이 없어서(브라우저
-- 보안 정책상 불가능) "WiFi 확인"은 문자 그대로는 만들 수 없고, 대신
-- 모바일/데스크톱 브라우저 모두에서 쓸 수 있는 GPS(navigator.geolocation)
-- 기반 위치 확인으로 만든다 — 사무실 좌표에서 얼마나 떨어져 있었는지
-- 기록해 관리자가 나중에 검토할 수 있게 한다. 위치 권한을 거부해도
-- 출퇴근 자체를 막지는 않는다(실내 GPS 오차·권한 거부 등으로 정상
-- 근무자가 체크를 못 하게 되는 걸 막기 위함) — 대신 위치가 없다는 사실
-- 자체가 기록에 남는다.

alter table public.company_profile
  add column if not exists office_lat numeric,
  add column if not exists office_lng numeric,
  add column if not exists office_radius_m integer not null default 300;

alter table public.attendance_records
  add column if not exists clock_in_lat numeric,
  add column if not exists clock_in_lng numeric,
  add column if not exists clock_in_accuracy_m numeric,
  add column if not exists clock_out_lat numeric,
  add column if not exists clock_out_lng numeric,
  add column if not exists clock_out_accuracy_m numeric;
