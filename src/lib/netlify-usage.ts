export type NetlifyUsage = {
  usedBytes: number;
  // 2025년 9월 이후 넷리파이 무료 플랜은 대역폭 전용 고정 한도가 없고
  // 빌드/함수/대역폭이 공유하는 크레딧제로 바뀌면서, API가 이 값을
  // null로 내려준다(레거시 계정만 숫자로 옴). null이면 화면에서도
  // 퍼센트 막대 없이 사용량만 보여준다 — 없는 한도를 지어내지 않는다.
  includedBytes: number | null;
  periodEndDate: string | null;
};

export type NetlifyUsageResult = {
  usage: NetlifyUsage | null;
  // 토큰이 설정돼 있는데(즉 이 기능을 켜려고 시도했는데) 뭔가 실패했을
  // 때만 채워진다. 토큰 자체를 안 넣은 경우(Vultr 등 이 기능을 안 쓰는
  // 배포본)는 error도 null로 둬서 화면에 아무것도 안 보이게 한다.
  // 넷리파이 로그를 뒤져야만 실패 이유를 알 수 있던 문제를 해결하려고,
  // 이 이유를 사이드바에 직접(작게) 보여준다.
  error: string | null;
};

// 넷리파이 배포본에서는 실제 서버 디스크 개념이 없어서(vps-usage.ts 참고),
// 대신 넷리파이 계정의 대역폭(bandwidth) 사용량을 보여준다. 빌드 시간(분)
// 사용량은 넷리파이가 공개 API로 제공하지 않아서(대시보드 Billing >
// Account usage insights에서만 확인 가능) 여기서는 다루지 않는다 —
// 확인 안 되는 값을 그럴듯하게 지어내는 것보다, 실제로 검증된 지표
// 하나만 정확히 보여주는 쪽을 택했다.
//
// 필요한 환경변수:
// - NETLIFY_API_TOKEN: 넷리파이 User settings > Applications >
//   Personal access tokens에서 발급
// - NETLIFY_TEAM_SLUG: (선택) 팀 슬러그. 안 넣으면 토큰으로 접근 가능한
//   첫 번째 계정을 자동으로 찾는다.
export async function getNetlifyUsage(): Promise<NetlifyUsageResult> {
  const token = process.env.NETLIFY_API_TOKEN;
  if (!token) return { usage: null, error: null };

  try {
    let slug = process.env.NETLIFY_TEAM_SLUG;

    if (!slug) {
      const accountsRes = await fetch("https://api.netlify.com/api/v1/accounts", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!accountsRes.ok) {
        return {
          usage: null,
          error: `/accounts 조회 실패: HTTP ${accountsRes.status} ${accountsRes.statusText}`,
        };
      }

      const accounts = (await accountsRes.json()) as unknown;
      if (!Array.isArray(accounts) || accounts.length === 0) {
        return { usage: null, error: "토큰으로 접근 가능한 계정이 없습니다." };
      }

      const first = accounts[0] as { slug?: unknown };
      if (typeof first.slug !== "string") {
        return { usage: null, error: "계정 응답에 slug가 없습니다." };
      }
      slug = first.slug;
    }

    const res = await fetch(`https://api.netlify.com/api/v1/accounts/${slug}/bandwidth`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        usage: null,
        error: `/accounts/${slug}/bandwidth 조회 실패: HTTP ${res.status} ${res.statusText}`,
      };
    }

    const data = (await res.json()) as {
      used?: unknown;
      included?: unknown;
      period_end_date?: unknown;
    };
    if (typeof data.used !== "number") {
      // 실제 응답 모양을 넷리파이 로그 없이도 바로 알 수 있도록, 받은
      // 원문을 그대로 에러 메시지에 담아 사이드바에 보여준다.
      const preview = JSON.stringify(data).slice(0, 300);
      return {
        usage: null,
        error: `bandwidth 응답 형식이 예상과 다릅니다. 받은 값: ${preview}`,
      };
    }

    return {
      usage: {
        usedBytes: data.used,
        // 크레딧제 계정은 included가 null로 온다 - 그대로 둔다.
        includedBytes: typeof data.included === "number" ? data.included : null,
        periodEndDate: typeof data.period_end_date === "string" ? data.period_end_date : null,
      },
      error: null,
    };
  } catch (err) {
    return { usage: null, error: `조회 중 예외 발생: ${err instanceof Error ? err.message : String(err)}` };
  }
}
