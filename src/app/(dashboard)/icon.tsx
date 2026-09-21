import { headers } from "next/headers";
import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

// 로그인 화면(테넌트 구분 전)은 계속 기본 ELVONIX 아이콘(app/favicon.ico)을
// 쓰고, 로그인 후 이 라우트 그룹 안에서만 각 회사가 설정 > 회사정보에서
// 올린 로고(company_profile.logo_mark_url)로 브라우저 탭 아이콘을
// 바꿔준다 — RLS가 이미 로그인한 사용자의 테넌트 행만 돌려주므로 별도
// 필터가 필요 없다. cookies를 읽는 요청 시점 API를 쓰므로 사용자마다
// 다시 계산된다(정적 캐시되지 않음).
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  const supabase = await createClient();
  const { data: company } = await supabase.from("company_profile").select("logo_mark_url").maybeSingle();

  const h = await headers();
  const host = h.get("host");
  const defaultLogoUrl = `https://${host}/branding/logo-mark.png`;
  const logoUrl = company?.logo_mark_url || defaultLogoUrl;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={logoUrl}
          width={size.width}
          height={size.height}
          style={{ objectFit: "contain" }}
          alt=""
        />
      </div>
    ),
    size
  );
}
