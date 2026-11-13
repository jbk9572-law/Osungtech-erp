import Link from "next/link";

// (dashboard) 세그먼트 전용 404 — 지금까지 이 앱에 not-found.tsx가 하나도
// 없어서, notFound()가 호출되면(예: 상세보기 라우트에 UUID가 아닌 값이
// 들어온 경우 — src/lib/is-uuid.ts 참고) 타이틀바/트리메뉴 등 앱 전체
// 껍데기 없이 Next.js 기본 흰 화면("404 This page could not be found")
// 만 덩그러니 떴다. error.tsx와 같은 카드 스타일로 통일한다.
export default function DashboardNotFound() {
  return (
    <div className="erp-u-text-center" style={{ maxWidth: 560, margin: "32px auto" }}>
      <div className="erp-u-border erp-u-bg-panel erp-u-radius-0"
        style={{ padding: "28px 20px" }}
      >
        <p className="erp-u-bold erp-u-text erp-u-mb-8" style={{ fontSize: 15 }}>
          페이지를 찾을 수 없습니다.
        </p>
        <p className="erp-u-muted erp-u-text-compact erp-u-mb-20">
          주소가 바뀌었거나 삭제된 항목일 수 있습니다.
        </p>
        <Link href="/dashboard" className="erp-btn erp-btn-primary">
          메인 화면으로
        </Link>
      </div>
    </div>
  );
}
