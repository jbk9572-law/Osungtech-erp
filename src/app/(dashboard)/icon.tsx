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
// 으로 실패했다(Cloudflare Workers Logs에서 반복 확인). next/og 공식
// 문서가 권장하는 fetch(new URL("./icon.png", import.meta.url)) 방식도
// 시도해봤지만, Cloudflare Workers의 fetch는 번들러가 만들어내는
// file:// 경로를 아예 못 읽어 "Fetch API cannot load: file://..."로
// 실패했다(역시 로그로 확인). 파일이나 네트워크를 아예 안 쓰고 순수
// JSX/CSS로 직접 그리면 이 런타임 문제 자체가 생길 수 없다.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  const supabase = await createClient();
  const { data: company } = await supabase.from("company_profile").select("logo_mark_url").maybeSingle();

  if (company?.logo_mark_url) {
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
            src={company.logo_mark_url}
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

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#132944",
          color: "#fff",
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        E
      </div>
    ),
    size
  );
}
