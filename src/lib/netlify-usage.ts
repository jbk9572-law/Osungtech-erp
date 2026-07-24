export type NetlifyUsage = {
  usedBytes: number;
  includedBytes: number;
  periodEndDate: string | null;
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
//
// 토큰이 없거나 조회에 실패하면 null을 반환해 위젯을 숨긴다.
export async function getNetlifyUsage(): Promise<NetlifyUsage | null> {
  const token = process.env.NETLIFY_API_TOKEN;
  if (!token) return null;

  try {
    let slug = process.env.NETLIFY_TEAM_SLUG;

    if (!slug) {
      const accountsRes = await fetch("https://api.netlify.com/api/v1/accounts", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!accountsRes.ok) return null;

      const accounts = (await accountsRes.json()) as unknown;
      if (!Array.isArray(accounts) || accounts.length === 0) return null;

      const first = accounts[0] as { slug?: unknown };
      if (typeof first.slug !== "string") return null;
      slug = first.slug;
    }

    const res = await fetch(`https://api.netlify.com/api/v1/accounts/${slug}/bandwidth`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      used?: unknown;
      included?: unknown;
      period_end_date?: unknown;
    };
    if (typeof data.used !== "number" || typeof data.included !== "number") return null;

    return {
      usedBytes: data.used,
      includedBytes: data.included,
      periodEndDate: typeof data.period_end_date === "string" ? data.period_end_date : null,
    };
  } catch {
    return null;
  }
}
