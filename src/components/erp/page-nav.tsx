import Link from "next/link";

// 목록 아래/위에 두는 "이전 · 다음" 페이지 이동 줄 — 한 번에 다 못 보여 주는 긴 목록(로그 등)을 공용으로 넘겨 본다.
export function PageNav({
  basePath,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const href = (p: number) => (p <= 1 ? basePath : `${basePath}?page=${p}`);
  return (
    <div className="erp-toolbar" role="navigation" aria-label="페이지 이동">
      {page > 1 ? (
        <Link href={href(page - 1)} className="erp-btn">
          ← 이전
        </Link>
      ) : (
        <span className="erp-btn" aria-disabled="true">
          ← 이전
        </span>
      )}
      <span className="erp-u-text-base">
        {from.toLocaleString("ko-KR")}–{to.toLocaleString("ko-KR")} / 전체 {total.toLocaleString("ko-KR")}건 ({page}/{lastPage} 페이지)
      </span>
      {page < lastPage ? (
        <Link href={href(page + 1)} className="erp-btn">
          다음 →
        </Link>
      ) : (
        <span className="erp-btn" aria-disabled="true">
          다음 →
        </span>
      )}
    </div>
  );
}
