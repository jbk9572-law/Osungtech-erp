import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { PageGuide } from "@/components/erp/page-guide";

type LocationRow = { code: string; tier: number; position: number };

// QR에는 위치 화면 URL을 그대로 인코딩한다 — 앱 안의 별도 스캐너 화면을
// 먼저 열 필요 없이, 창고에서 아무 휴대폰 카메라로 찍기만 해도 바로
// 그 위치의 재고 화면으로 들어갈 수 있게 하기 위해서다. 로그인 세션이
// 없는 휴대폰이면 /login으로 튕기는데, 로그인 액션이 next 파라미터로
// 원래 열려던 위치 화면으로 되돌려보낸다(src/app/login/actions.ts).
async function buildLocationUrl(code: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}/inventory/locations/${code}`;
}

export default async function RackPrintPage({ params }: { params: Promise<{ code: string }> }) {
  // 이 라우트는 /inventory/locations/[code](위치 상세)와 URL 한 단계를
  // 공유해서 다이나믹 세그먼트 이름을 똑같이 "code"로 맞춰야 한다 —
  // Next.js는 같은 깊이의 경로에 서로 다른 슬러그 이름(rack vs code)을
  // 허용하지 않고, 이름이 다르면 라우트 테이블 생성 자체가 실패해
  // 배포된 사이트 전체가 500을 낸다(실제로 이 버그로 한 번 장애가 났다).
  // 이 화면에서 실제로 받는 값은 위치 코드가 아니라 랙 이름이라
  // rack으로 바로 재구조분해한다.
  const { code: rack } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("locations")
    .select("code, tier, position")
    .eq("rack", rack)
    .order("tier", { ascending: false })
    .order("position", { ascending: true })
    .limit(4); // 랙 1개 = 2단 × 좌우 2칸 = 항상 4자리

  const locations = (data ?? []) as LocationRow[];
  if (locations.length === 0) {
    return (
      <div className="print-page-margin">
        <p className="erp-grid-empty">{rack} 랙을 찾을 수 없습니다.</p>
        <div className="erp-toolbar">
          <Link href="/inventory/locations" className="erp-btn erp-btn-danger">
            ESC 목록으로
          </Link>
        </div>
      </div>
    );
  }

  const byKey = new Map(locations.map((l) => [`${l.tier}-${l.position}`, l]));

  // A4 한 장(용지 여백 18mm 제외 시 실사용 높이 약 261mm)에 헤더+2단
  // 슬롯 2줄+안내문까지 전부 들어가야 한다 — QR을 190px로 크게 뽑았을 때
  // 실제 인쇄에서 2페이지로 넘어가는 문제가 있어(사용자 확인), 한 장에
  // 여유 있게 들어가도록 QR과 각 블록의 크기/여백을 줄였다.
  const qrByCode: Record<string, string> = {};
  for (const loc of locations) {
    const url = await buildLocationUrl(loc.code);
    qrByCode[loc.code] = await QRCode.toString(url, { type: "svg", width: 148, margin: 1 });
  }

  function renderSlot(tier: number, position: number) {
    const loc = byKey.get(`${tier}-${position}`);
    if (!loc) return <div key={`${tier}-${position}`} />;
    return (
      <div
        key={loc.code}
        style={{
          border: "1px solid var(--erp-border)",
          borderRadius: 6,
          padding: "10px 8px",
          textAlign: "center",
          background: "#fff",
        }}
      >
        <div
          style={{
            fontSize: 19,
            fontWeight: 800,
            letterSpacing: 0.5,
            color: "var(--erp-primary-dark)",
            marginBottom: 8,
          }}
        >
          {loc.code}
        </div>
        <div
          style={{ display: "flex", justifyContent: "center" }}
          dangerouslySetInnerHTML={{ __html: qrByCode[loc.code] }}
        />
        <div style={{ marginTop: 8, fontSize: 10.5, color: "var(--erp-text-muted)" }}>QR 스캔 → 재고조회</div>
      </div>
    );
  }

  return (
    <div className="mx-auto p-8 print-page-margin" style={{ maxWidth: 560 }}>
      <div className="mb-3 flex items-center justify-between print:hidden">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">{rack}랙 QR 위치 현황판 (A4)</h1>
      </div>
      <PageGuide className="print:hidden">
        인쇄해서 상단 펀칭 구멍으로 랙에 고정하세요. 품목/수량이 바뀌어도 QR은 위치에 고정이라 다시
        인쇄할 필요가 없습니다.
      </PageGuide>
      <div className="erp-toolbar print:hidden">
        <PrintButton autoPrint={false} />
        <Link href="/inventory/locations" className="erp-btn erp-btn-danger">
          ESC 목록으로
        </Link>
      </div>

      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          background: "#fff",
          border: "1px solid var(--erp-border)",
          borderRadius: 8,
          padding: 16,
          boxShadow: "var(--erp-shadow-sm)",
        }}
      >
        {/* 자석/고정장치용 펀칭 구멍 2개 */}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 24px", marginBottom: 4 }}>
          <span
            style={{
              display: "inline-block",
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: "2px solid var(--erp-border)",
            }}
          />
          <span
            style={{
              display: "inline-block",
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: "2px solid var(--erp-border)",
            }}
          />
        </div>

        <div
          style={{
            background: "var(--erp-primary-dark)",
            color: "#fff",
            borderRadius: 6,
            padding: "12px 14px",
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 1 }}>{rack} RACK</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>재고 실사 현황</div>
          <div style={{ fontSize: 10.5, marginTop: 4, opacity: 0.85 }}>
            QR을 스캔하면 해당 위치의 현재 재고를 확인할 수 있습니다.
          </div>
        </div>

        <div style={{ marginBottom: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#fff",
              background: "var(--erp-primary)",
              borderRadius: 4,
              padding: "2px 8px",
            }}
          >
            2단 · 상단
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          {renderSlot(2, 1)}
          {renderSlot(2, 2)}
        </div>

        <div style={{ marginBottom: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--erp-primary-dark)",
              background: "var(--erp-bg-subtle)",
              border: "1px solid var(--erp-primary)",
              borderRadius: 4,
              padding: "2px 8px",
            }}
          >
            1단 · 하단
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {renderSlot(1, 1)}
          {renderSlot(1, 2)}
        </div>

        <div
          style={{
            borderTop: "1px solid var(--erp-border)",
            paddingTop: 10,
            fontSize: 10.5,
            color: "var(--erp-text-muted)",
          }}
        >
          <div style={{ fontWeight: 700, color: "var(--erp-text)", marginBottom: 4 }}>QR 실사 방법</div>
          <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
            <li>QR 스캔</li>
            <li>해당 위치의 현재 재고 확인</li>
            <li>실제 수량 확인 및 수정</li>
            <li>실사 완료</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
