// 옵션(공급받는자만 등) 없이 그냥 바로 인쇄만 하면 되는 화면(지급결의양식
// 등)에서, 새 탭을 띄우고 그 탭에서 다시 인쇄 대화상자를 띄우는 2단계
// 대신 화면에 보이지 않는 iframe에 인쇄 페이지를 불러온다 — 그 인쇄
// 페이지 자체가 이미 로드되자마자 자동으로 인쇄 대화상자를 띄우므로
// (PrintButton의 autoPrint 기본 동작) 여기서 따로 print()를 호출할
// 필요는 없고, 인쇄가 끝난 뒤 iframe만 정리해주면 된다. 사용자 입장에선
// 새 창 없이 인쇄 대화상자만 뜨는 것처럼 보인다.
export function printInPlace(href: string) {
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
  });
  iframe.src = href;
  iframe.onload = () => {
    const win = iframe.contentWindow;
    const cleanup = () => iframe.remove();
    win?.addEventListener("afterprint", cleanup);
    // afterprint를 못 받는 환경(일부 브라우저)을 대비한 안전장치.
    setTimeout(cleanup, 60000);
  };
  document.body.appendChild(iframe);
}
