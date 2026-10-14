import type { ReactNode } from "react";

// "현재 화면 그대로 엑셀로 다운로드" 버튼이 거의 똑같은 모양(href+
// className="erp-btn"+title+marginLeft:auto)으로 리포트/목록 화면
// 9곳에 복붙돼 있던 걸 하나로 묶었다(헌법검사에서 발견).
export function ExcelDownloadLink({
  href,
  title = "현재 화면 그대로 엑셀로 다운로드",
  label = "📥 엑셀 다운로드",
  pushRight = false,
  primary = false,
}: {
  href: string;
  title?: string;
  label?: ReactNode;
  // 툴바 안에서 다른 버튼과 나란히 두지 않고 오른쪽 끝으로 밀 때(리포트
  // 화면 다수가 이 모양)만 켠다.
  pushRight?: boolean;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      className={`erp-btn${primary ? " erp-btn-primary" : ""}`}
      title={title}
      style={pushRight ? { marginLeft: "auto" } : undefined}
    >
      {label}
    </a>
  );
}
