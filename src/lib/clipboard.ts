// navigator.clipboard가 없거나(HTTP/구형 브라우저) 권한이 막힌 환경을 위해
// document.execCommand("copy") 폴백까지 갖춘 클립보드 복사 헬퍼. 대시보드
// 카톡 복사 버튼에서 먼저 쓰이던 걸, 캘린더 구독 URL 복사 버튼이 똑같은
// 로직을 또 필요로 하면서 공용 함수로 뺐다.
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}
