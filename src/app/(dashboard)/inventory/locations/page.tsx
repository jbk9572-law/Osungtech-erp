import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { PageGuide } from "@/components/erp/page-guide";
import { CreateRackForm } from "@/components/create-rack-form";
import { DeleteRackButton } from "@/components/delete-rack-button";

type LocationRow = { id: string; rack: string; tier: number; position: number; code: string };

// 창고 실제 배치(가운데 통로, 오른쪽 줄 A1~A5, 왼쪽 줄 B1~B5)와 그대로
// 맞춰 보여주기 위한 패턴. 이 패턴에 안 맞는 랙(예: 맨 처음 만든 "A"
// 하나짜리)은 화면에서 사라지면 안 되니 "기타 위치"에 그대로 보여준다.
const RACK_SIDE_PATTERN = /^([AB])([1-9]\d*)$/;

export default async function InventoryLocationsPage() {
  const supabase = await createClient();

  const [locations, stockRows] = await Promise.all([
    fetchAllRows<LocationRow>((from, to) =>
      supabase.from("locations").select("id, rack, tier, position, code").order("rack").range(from, to),
    ),
    fetchAllRows<{ location_id: string }>((from, to) =>
      supabase.from("inventory_locations").select("location_id").range(from, to),
    ),
  ]);

  const countByLocation = new Map<string, number>();
  for (const row of stockRows) {
    countByLocation.set(row.location_id, (countByLocation.get(row.location_id) ?? 0) + 1);
  }

  const racks = new Map<string, LocationRow[]>();
  for (const loc of locations) {
    const list = racks.get(loc.rack) ?? [];
    list.push(loc);
    racks.set(loc.rack, list);
  }

  const rightRacks: [string, LocationRow[]][] = [];
  const leftRacks: [string, LocationRow[]][] = [];
  const otherRacks: [string, LocationRow[]][] = [];
  for (const entry of [...racks.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const m = entry[0].match(RACK_SIDE_PATTERN);
    if (!m) {
      otherRacks.push(entry);
      continue;
    }
    (m[1] === "A" ? rightRacks : leftRacks).push(entry);
  }
  const byRackNumber = (a: [string, LocationRow[]], b: [string, LocationRow[]]) =>
    Number(a[0].slice(1)) - Number(b[0].slice(1));
  rightRacks.sort(byRackNumber);
  leftRacks.sort(byRackNumber);

  // 랙 하나를 "이름 + 4칸 점유 상태 아이콘 + 요약" 요약줄로 보여주고,
  // 누르면 그 자리에서 위치별(4칸) 상세가 펼쳐진다 — <details>는 별도
  // 클라이언트 컴포넌트/JS 없이 펼침 상태를 브라우저가 그대로 처리해준다.
  function renderRackCard(rack: string, locs: LocationRow[]) {
    const byKey = new Map(locs.map((l) => [`${l.tier}-${l.position}`, l]));
    const tiers = [2, 1] as const; // 2단(상단)을 위에, 1단(하단)을 아래에 보여준다.
    const filledCount = locs.filter((l) => (countByLocation.get(l.id) ?? 0) > 0).length;
    const totalItems = locs.reduce((sum, l) => sum + (countByLocation.get(l.id) ?? 0), 0);

    return (
      <details key={rack} className="erp-detail" style={{ marginTop: 0, marginBottom: 0 }}>
        <summary
          className="erp-detail-tabs"
          style={{ listStyle: "none", cursor: "pointer", padding: "10px 14px", gap: 12, alignItems: "center" }}
        >
          <span style={{ fontSize: 16, fontWeight: 800, color: "var(--erp-primary-dark)", width: 34 }}>
            {rack}
          </span>
          <span
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gridTemplateRows: "1fr 1fr",
              gap: 3,
              width: 28,
              height: 28,
              flexShrink: 0,
            }}
          >
            {tiers.flatMap((tier) =>
              [1, 2].map((position) => {
                const loc = byKey.get(`${tier}-${position}`);
                const filled = loc ? (countByLocation.get(loc.id) ?? 0) > 0 : false;
                return (
                  <span
                    key={`${tier}-${position}`}
                    style={{
                      borderRadius: 3,
                      border: `1.5px ${filled ? "solid" : "dashed"} ${
                        filled ? "var(--erp-primary)" : "var(--erp-border)"
                      }`,
                      background: filled ? "var(--erp-primary)" : "#fff",
                    }}
                  />
                );
              }),
            )}
          </span>
          <span style={{ fontSize: 11, color: "var(--erp-text-muted)", lineHeight: 1.4 }}>
            {filledCount > 0 ? (
              <>
                {filledCount}/4칸 사용
                <br />
                <b style={{ color: "var(--erp-text)", fontSize: 12 }}>{totalItems}품목</b>
              </>
            ) : (
              "미지정"
            )}
          </span>
          <span
            style={{ marginLeft: "auto", display: "flex", gap: 8 }}
            onClick={(e) => e.preventDefault()}
          >
            <Link href={`/inventory/locations/${rack}/print`} className="erp-btn">
              QR 인쇄
            </Link>
            <DeleteRackButton rack={rack} />
          </span>
        </summary>
        <div className="erp-detail-body">
          {tiers.map((tier) => (
            <div
              key={tier}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}
            >
              {[1, 2].map((position) => {
                const loc = byKey.get(`${tier}-${position}`);
                if (!loc) return <div key={position} />;
                const count = countByLocation.get(loc.id) ?? 0;
                return (
                  <Link
                    key={loc.id}
                    href={`/inventory/locations/${loc.code}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "16px 8px",
                      border: "1px solid var(--erp-border)",
                      borderRadius: 6,
                      background: "#fff",
                      textDecoration: "none",
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--erp-text)" }}>
                      {loc.code}
                    </span>
                    <span className={count > 0 ? "erp-badge erp-badge-info" : "erp-badge erp-badge-muted"}>
                      {count > 0 ? `${count}품목 보관 중` : "미지정"}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </details>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">재고관리 &gt; 보관 위치(랙) 관리</h1>
        <Link href="/inventory" className="erp-btn erp-btn-danger">
          ESC 재고현황으로
        </Link>
      </div>

      <PageGuide>
        랙 이름을 A1~A5, B1~B5처럼 지으면 가운데 통로를 기준으로 오른쪽/왼쪽 창고 배치 그대로 보여줍니다.
        랙을 누르면 그 자리에서 4칸(2단 × 좌우) 상세가 펼쳐지고, 거기서 지금 보관 중인 품목을
        등록/수정할 수 있습니다. QR은 위치에 고정되어 있어서 품목이나 수량이 바뀌어도 다시 인쇄할
        필요가 없습니다.
      </PageGuide>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 16 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">랙 추가</span>
        </div>
        <div className="erp-detail-body">
          <CreateRackForm />
        </div>
      </div>

      {racks.size === 0 && <p className="erp-grid-empty">아직 등록된 랙이 없습니다. 위에서 추가해주세요.</p>}

      {(rightRacks.length > 0 || leftRacks.length > 0) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 60px 1fr",
            gap: 14,
            marginBottom: otherRacks.length ? 20 : 0,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--erp-text-muted)" }}
            >
              좌측
            </div>
            {leftRacks.map(([rack, locs]) => renderRackCard(rack, locs))}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              writingMode: "vertical-rl",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 4,
              color: "var(--erp-text-muted)",
              border: "1px dashed var(--erp-border)",
              borderRadius: 4,
              background: "var(--erp-bg-subtle)",
              padding: "8px 0",
            }}
          >
            통로
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--erp-text-muted)" }}
            >
              우측
            </div>
            {rightRacks.map(([rack, locs]) => renderRackCard(rack, locs))}
          </div>
        </div>
      )}

      {otherRacks.length > 0 && (
        <div>
          {(rightRacks.length > 0 || leftRacks.length > 0) && (
            <div className="mb-2 text-xs font-semibold" style={{ color: "var(--erp-text-muted)" }}>
              기타 위치
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {otherRacks.map(([rack, locs]) => renderRackCard(rack, locs))}
          </div>
        </div>
      )}
    </div>
  );
}
