-- 품목 등록 화면에서 카테고리를 자유 입력으로 새로 만들던 걸 없애고,
-- 정해진 6종(Paper/Material/Tray/Bobbin/Filter/Etc) 중에서만 고르게
-- 바꿨다 — 이 카테고리는 대시보드 매입-매출 매칭 추적 기준
-- (dashboard-calendar.tsx의 isTrackedCategory)이기도 해서, 자유
-- 입력으로 오타/변형("필터", "Filters" 등)이 생기면 그 로직이 조용히
-- 어긋난다. 화면이 드롭다운으로 보여주려면 이 6개가 실제로 categories
-- 테이블에 있어야 하므로, 없는 것만 채운다(있으면 그대로 둠 — 재실행
-- 안전).
insert into public.categories (name)
values ('Paper'), ('Material'), ('Tray'), ('Bobbin'), ('Filter'), ('Etc')
on conflict (name) do nothing;
