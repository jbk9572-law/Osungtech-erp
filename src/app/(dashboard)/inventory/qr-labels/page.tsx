import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { matchesSearch } from "@/lib/search-match";
import { PrintButton } from "@/components/print-button";
import { PageGuide } from "@/components/erp/page-guide";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { QrLabelCard } from "@/components/qr-label-card";

// 라벨 하나에 넣는 QR은 SKU 문자열 그대로를 인코딩한다 — 관리번호처럼
// 대문자/무공백 규칙이 있는 값이 아니라 이미 유일성이 보장된 SKU라서
// 별도 정규화 없이 그대로 쓴다. QR 자동실사 화면(qr-count-scan.ts)이
// 스캔한 문자열을 SKU로 그대로 조회하므로 여기서 인코딩하는 값과
// 정확히 같아야 한다.
export default async function InventoryQrLabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; hideZero?: string }>;
}) {
  const { q, hideZero: hideZeroRaw } = await searchParams;
  const hideZero = hideZeroRaw === "1";
  const supabase = await createClient();

  const products = await fetchAllRows<{
    id: string;
    sku: string;
    name: string;
    spec: string | null;
    label_direction: string;
    categories: { name: string } | null;
    inventory: { quantity: number }[];
  }>((from, to) =>
    supabase
      .from("products")
      .select("id, sku, name, spec, label_direction, categories(name), inventory(quantity)")
      .order("name")
      .range(from, to),
  );

  const keyword = q?.trim().toLowerCase();
  const filtered = products
    .filter((p) => !keyword || matchesSearch(keyword, p.sku, p.name, p.spec, p.categories?.name))
    // 매입 즉시 그 자리에서 매출로 나가고 창고에 안 들어오는 품목이
    // 절반 이상이라, 그런 품목까지 매번 라벨 인쇄 목록에 다 뜨면 실제로
    // 붙일 실물이 없는 라벨을 골라내는 게 더 번거롭다 — 현재 재고가
    // 0인 품목은 체크박스로 숨길 수 있게 한다.
    // 창고가 여러 개면 [0]은 임의의 창고 하나만 가리킨다 — 전체(모든
    // 창고 합계) 재고가 0인지로 판단해야 한다.
    .filter((p) => !hideZero || (p.inventory ?? []).reduce((sum, inv) => sum + Number(inv.quantity), 0) > 0);

  // 예전엔 여기서 서버가 필터링된 품목 전부(수백 개)의 QR SVG를 한 요청
  // 안에서 만들어 내려보냈다 — PNG(toDataURL)에서 SVG로 바꿔서 한 번
  // 가벼워졌지만, "요청 하나가 라벨 수백 장을 만든다"는 구조 자체는
  // 그대로라 품목이 더 늘면 다시 Cloudflare Workers 요청당 CPU 한도
  // ("Worker exceeded resource limits")에 걸릴 수 있었다. 이제 QR 생성은
  // QrLabelCard가 각자 클라이언트에서 하므로, 여기서는 SKU만 그대로
  // 내려주면 된다.
  const labels = filtered;

  return (
    <div className="print-page-margin">
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/inventory" } }} />
      <div className="mb-3 flex items-center justify-between print:hidden">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">재고관리 &gt; QR 라벨 인쇄</h1>
      </div>
      <PageGuide className="print:hidden">
        아래 라벨을 인쇄해서 품목/박스에 붙이면, QR 자동실사 화면에서 스캔으로 바로 인식됩니다.
      </PageGuide>

      <form method="get" className="erp-search print:hidden">
        <div className="erp-field" style={{ minWidth: 220, flex: 1 }}>
          <label htmlFor="search-q">품목 검색 (비워두면 전체 품목)</label>
          <input
            id="search-q"
            type="text"
            name="q"
            autoComplete="off"
            defaultValue={q ?? ""}
            placeholder="상품명, SKU, 규격, 카테고리"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <div className="erp-field" style={{ justifyContent: "flex-end" }}>
          <label aria-hidden="true">&nbsp;</label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: 34,
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            <input type="checkbox" name="hideZero" value="1" defaultChecked={hideZero} />
            0건인 품목은 보지 않기
          </label>
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          조회
        </button>
        {(q || hideZero) && (
          <Link href="/inventory/qr-labels" className="erp-btn">
            초기화
          </Link>
        )}
      </form>

      <div className="erp-toolbar print:hidden">
        <PrintButton autoPrint={false} />
        <Link href="/inventory/count/scan" className="erp-btn">
          QR 자동실사 화면으로
        </Link>
        <Link href="/inventory" className="erp-btn erp-btn-dark">
          ESC 목록으로
        </Link>
      </div>

      {!labels.length && (
        <p className="erp-grid-empty" style={{ marginTop: 12 }}>
          조건에 맞는 품목이 없습니다.
        </p>
      )}

      <div className="erp-qr-label-grid">
        {labels.map((label) => (
          <QrLabelCard
            key={label.id}
            productId={label.id}
            sku={label.sku}
            name={label.name}
            spec={label.spec}
            initialDir={label.label_direction === "down" ? "down" : "up"}
          />
        ))}
      </div>
    </div>
  );
}
