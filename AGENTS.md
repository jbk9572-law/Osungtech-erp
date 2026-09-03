<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 버그 수정 시 반드시 지킬 규칙 (모든 세션에 적용, 정기 감사 세션 포함)

한 곳의 버그를 고칠 때, 같은 패턴이 다른 곳에도 있는지 확인하지 않고 그
지점만 좁게 고치면, 사용자가 나중에 다른 위치에서 같은 버그를 또 발견해
같은 지시를 반복하게 되고 이는 토큰 낭비다. 그래서 다음을 예외 없이 지킨다:

1. **패턴 기반 버그를 찾으면, 고치기 전에 먼저 코드베이스 전체에서 같은
   패턴을 검색한다** (Grep으로 유사 구조 검색, 또는 같은 컴포넌트/헬퍼를
   쓰는 다른 호출부 확인). 찾은 인스턴스를 전부 한 번에 고친다 — 지적받은
   한 곳만 고치고 끝내지 않는다.
2. **가능하면 반복될 수 있는 구조 자체를 없앤다**: 똑같은 로직/스타일이
   2곳 이상에 복붙돼 있으면 공용 함수·훅·CSS 클래스로 합친다(예:
   `clampDropdownLeft`, `sumOutstandingBalance`, `.erp-kpi-row`).
3. **사람이 매번 다시 찾아야 하는 종류의 버그라면 자동 검사 스크립트로
   만든다**: `scripts/check-*.mjs`를 새로 추가하거나 확장해서 `npm run
   lint`에 물린다(기존 예: `check-pagination.mjs`, `check-mutation-
   errors.mjs`, `check-search-autocomplete.mjs`). 스크립트를 만든 뒤에는
   반드시 직접 실행해서 수동으로 놓친 인스턴스가 없는지 확인한다 —
   실제로 이 방식이 손으로 다 고쳤다고 생각한 뒤에도 누락분을 잡아낸
   전례가 있다.
4. 위 세 가지 중 어느 것도 적용할 수 없는 진짜 일회성 버그라면 그냥
   그 자리에서 고치면 된다 — 모든 수정에 억지로 공용화/자동검사를
   끼워 넣으라는 뜻은 아니다. 판단 기준은 "같은 실수가 다른 곳에서
   반복될 수 있는가"이다.
