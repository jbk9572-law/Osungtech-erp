import { portalLoginUrl } from "@/lib/portal-path";
import { PortalLinkActions } from "@/components/portal-link-actions";

// 거래처·하청업체가 접속하는 포털 사이트의 주소와 바로가기 — 거래처 상세·하청업체 상세의 "포털 계정" 카드와 거래처 발주 승인 화면이 같은 부품을 쓴다.
export async function PortalLinkBar({ audience }: { audience: "거래처" | "하청업체" }) {
  const { url, dedicated } = await portalLoginUrl();
  return (
    <div className="erp-portal-link">
      <div className="erp-portal-link-main">
        <span className="erp-portal-link-label">{audience} 포털 주소</span>
        <code className="erp-portal-link-url">{url}</code>
        <PortalLinkActions url={url} />
      </div>
      {!dedicated && <p className="erp-portal-link-note">전용 포털 주소가 아직 설정되지 않아 기본 주소로 표시됩니다. 이 주소도 그대로 열립니다.</p>}
    </div>
  );
}
