import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

// 로그인 화면(테넌트 구분 전)은 계속 기본 ELVONIX 아이콘(app/favicon.ico)을
// 쓰고, 로그인 후 이 라우트 그룹 안에서만 각 회사가 설정 > 회사정보에서
// 올린 로고(company_profile.logo_mark_url)로 브라우저 탭 아이콘을
// 바꿔준다 — RLS가 이미 로그인한 사용자의 테넌트 행만 돌려주므로 별도
// 필터가 필요 없다. cookies를 읽는 요청 시점 API를 쓰므로 사용자마다
// 다시 계산된다(정적 캐시되지 않음).
//
// 커스텀 로고가 없는 기본값은 예전엔 이 Worker 자신의 도메인으로 다시
// HTTP 요청(`https://${host}/branding/logo-mark.png`)을 보내 가져왔는데,
// Cloudflare Workers에서 자기 자신에게 되돌아오는 이런 자기참조 fetch가
// 가끔 정적 자산 대신 다른 응답을 받아 "Unsupported image type: unknown"
// 으로 실패했다(Cloudflare Workers Logs에서 반복 확인). next/og가 공식
// 권장하는 방식대로 로컬 번들 자산을 fetch(new URL(...))로 읽어 빌드
// 시점에 번들에 포함시키면, 요청마다 나가는 네트워크 왕복 자체가 없어
// 이 문제가 원천적으로 사라진다.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  const supabase = await createClient();
  const { data: company } = await supabase.from("company_profile").select("logo_mark_url").maybeSingle();

  const src = company?.logo_mark_url
    ? company.logo_mark_url
    : await fetch(new URL("../icon.png", import.meta.url))
        .then((res) => res.arrayBuffer())
        .then((buf) => `data:image/png;base64,${Buffer.from(buf).toString("base64")}`);

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
          src={src}
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
