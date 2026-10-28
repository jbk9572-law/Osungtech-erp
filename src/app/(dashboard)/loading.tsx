// (dashboard)/layout.tsx가 서버에서 회사정보/프로필/테넌트 등을 비동기로
// 조회하는 동안(약 1~2초, 느리면 더 길게) Next.js가 이 화면을 먼저
// 보여준다 — 그동안 ErpShell의 .erp-titlebar(sticky, navy)가 아직
// DOM에 없다. 최신 iOS Safari는 theme-color 메타 태그를 더 이상
// 안정적으로 안 읽고, 대신 뷰포트 맨 위를 히트테스트해 거기 걸리는
// sticky/fixed 불투명 요소의 배경색을 그대로 노치/다이나믹 아일랜드에
// 칠한다(.erp-titlebar의 position:sticky 주석 참고, 같은 이유로 이미
// 한 번 고친 전례가 있다) — 그 요소가 아직 없으면 기본(흰색)으로
// 남아있다가, 조회가 끝나고 진짜 타이틀바가 마운트되는 순간에야 색이
// "채워지는" 것처럼 보인다(사용자 지적). 실제 타이틀바와 똑같은
// .erp-titlebar 클래스를 먼저 그려서, 로딩 중에도 Safari가 즉시 같은
// 자리에서 같은 색을 찾게 한다.
//
// 처음엔 이 타이틀바를 내용 없이(빈 네이비 박스) 그렸는데, 그러면
// 로고/글자 하나 없는 색 블록이 화면 위에 덩그러니 떠 있다가 그 아래
// 빈 흰 화면 한가운데 "조회 중..."만 보이는 모양이라 사용자가 "이거
// 고장난 것처럼 보인다"고 지적했다 — 그래서 로고(정적 파일이라 조회
// 없이 바로 그릴 수 있음)와 "ERP" 글자를 넣어 실제 타이틀바의 축약된
// 로딩 상태처럼 보이게 하고, 로딩 표시도 화면 한가운데가 아니라
// 타이틀바 바로 아래로 붙였다(erp-loading-panel-under-titlebar).
export default function DashboardLoading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* 회사명(실제 데이터)이 아직 없는 상태라 "ERP"처럼 어중간한
          텍스트를 채우면, 평소엔 "OOO ERP"로 보이다가 이동 중에만 잠깐
          "ERP"로 바뀌는 게 오히려 더 튀어 보인다(사용자 지적) — 로고만
          남기고 글자는 아예 빼서, 어떤 값이 와도 안 어긋나게 한다. */}
      <div className="erp-titlebar" aria-hidden>
        <div className="erp-titlebar-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/branding/logo-mark.png" alt="" className="erp-titlebar-logo" />
        </div>
      </div>
      <div className="erp-loading-panel erp-loading-panel-under-titlebar" style={{ flex: 1 }}>
        <div className="erp-loading-gauge" aria-hidden />
        조회 중...
      </div>
    </div>
  );
}
