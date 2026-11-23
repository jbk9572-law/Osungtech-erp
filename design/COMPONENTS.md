# 공용 부품 규격 (COMPONENTS)

화면은 아래 부품과 단계 이름으로만 조립한다. 부품은 `style`·임의 `className`을 받지 않고, 예외는 `variant`(이름 있는 변형, `EXCEPTIONS.md`)로만 켠다.
값은 `SPEC.md`의 규칙표(토큰)만 쓴다.

## 0. 직접 박은 값 현황 (실측, 2026-11-23)

`src` 화면 코드의 `style={{…}}` 정적 선언 1,152개 / 동적(계산된 값) 372개.

| 속성 | 개수 | 의미 |
|---|---|---|
| width | 458 | **표 열 폭이 대부분.** 숫자 width 373개 중 `<th>`가 271개(73%). 서로 다른 값 47가지(90·110·100·140·120·130·70·160…) |
| height | 79 | 버튼·입력칸 높이(24·26·22·34 등) |
| padding | 65+ | 칸·박스 안쪽 여백 |
| color | 55 | 대부분 `#000`/`#fff` (인쇄 서식) 또는 토큰 |
| minWidth / maxWidth | 46 / 44 | 입력칸·패널 폭 |
| fontSize | 45 | 11px 등 — 토큰으로 대체 가능 |
| tableLayout | 21 | `fixed` 반복 |

폴더별 상위: reports 83, hr 79, production 66, inventory-qr-scanner 62, inventory 58, paper-calc 33.

→ 가장 큰 덩어리는 **표 열 폭 약 570개**다. 이것을 "열 폭 단계"로 묶으면 파편화의 절반이 한 번에 사라진다.

## 1. 표 열 폭 단계 (신규 규격)

47가지 값을 8단계로 합친다. 표 머리 `<th>`·`<col>`은 숫자 대신 단계 이름을 쓴다.

| 단계 | 폭 | 쓰는 열 (예) |
|---|---|---|
| xs | 60px | No, 체크박스, 단위, 상태 칩 |
| s | 80px | 코드, 수량, 날짜(짧은) |
| m | 100px | 금액, 날짜 |
| l | 120px | 연락처, 대표 |
| xl | 140px | 거래처·품목명(짧은), 결제조건 |
| xxl | 200px | 품목명(긴), 주소 |
| fill | 남는 폭 | 비고·메모 (하나만) |

(원본 값 → 단계 매핑: 60→xs, 70·80→s, 90·100·110→m, 120·130→l, 140·150→xl, 160·200→xxl. 새 값이 필요하면 단계를 추가하지 않고 가장 가까운 단계를 쓴다.)

## 2. 부품 목록

| 묶음 | 부품 | 속성(허용값만) |
|---|---|---|
| 배치 | `Stack` | `gap` 1~6 (토큰 간격), `align` |
| | `Row` | `gap`, `wrap`, `justify` |
| | `Grid` | 12칸, 칸마다 `span` 1~12 |
| | `Card` | `title`, `hint`, `variant` |
| | `Section` | `title` |
| 입력 | `Field` | 라벨 + 입력 + 힌트 + 오류, `span`, `required` |
| | `Input`/`Select`/`DateInput` | 높이는 28px 고정 |
| 표시 | `KeyValue`, `SummaryBox`, `Hint`, `Badge`, `StatusChip` | `tone`(info/warn/danger/success) |
| 동작 | `Button` | `size` = md(28) / sm(24) 두 가지만, `tone` |
| | `ButtonBar`, `Toolbar` | 위치 규칙 고정 |
| 표 | `Th`/`Col` | `w` = 열 폭 단계 |
| 상태 | `Loading`, `Empty`, `ErrorState`, `NoAccess`, `ZeroResults` | 문구·모양 고정 |
| 틀 | `Page`, `ListPage`(A), `DetailPanel`, `Modal`(C), `SettingsPage`(D) | |

## 3. 변환 원칙

- 정적 선언은 **자동 변환**한다(분류 → 단계 이름 → 부품 속성). 사람이 하나씩 고치지 않는다.
- 동적 값(계산된 폭·위치)은 CSS 변수(`--w`, `--x`)로만 넘기고 `style`에는 변수 선언만 허용한다.
- 인쇄 서식(`InvoiceCopy*`, 명세표 등)은 외부 서식 복제라 변환 대상에서 제외한다(예외 `print-form`).
- 폴더 단위로 "직접 값 0개"를 목표로 하고, 옮긴 폴더는 검사 기준선을 낮춰 다시 늘 수 없게 한다.
- 기존 표 열 폭 lint(`check-fixed-table-columns`)는 단계 이름 기반으로 바꾼다(합계 폭 검증은 유지).
