// PostgREST는 supabase/config.toml의 max_rows(1000)를 넘으면 별도 에러
// 없이 결과를 그 값까지만 잘라서 돌려준다 — .order()+.limit(N)만 걸어두면
// N이 1000보다 커도 조용히 1000건에서 잘리고, 오름차순 정렬이면 최신
// 데이터부터 빠진다. 정확도가 중요한 화면(월별 집계 등)에서는 .range()로
// 직접 페이지를 넘기며 끝까지 받아와야 한다(src/app/api/backup/export의
// 페이지네이션과 동일한 방식).
const PAGE_SIZE = 1000;

// Cloudflare Workers 런타임에서 Supabase REST(PostgREST)로 나가는 fetch가
// 아주 가끔(네트워크 순단, 콜드스타트 등) 정상적으로 { error } 값을 담은
// 응답이 아니라 fetch 자체가 reject되는 경우가 있다 — supabase-js가 모든
// 네트워크 실패를 항상 { data: null, error }로 감싸주는 게 아니라, 이
// runtime의 fetch 구현에 따라 그대로 예외로 새어나올 수 있다. 예전 코드는
// 성공적으로 resolve된 응답의 error 필드만 확인했지, await 자체가
// reject되는 경우는 그대로 호출부까지 예외가 전파돼(재고실사처럼 이
// 함수를 한 페이지에서 여러 번 병렬로 부르는 화면일수록 그만큼 걸릴
// 확률이 높아진다) 그 요청의 화면 렌더링 전체가 죽었다 — 재고실사에서
// "일시적인 오류로 화면을 불러오지 못했습니다"가 반복되던 것 중 상당수가
// 이 경로였던 것으로 보인다. 한 번 실패했다고 바로 포기하지 않고,
// 순단성 실패를 걸러내기 위해 짧은 대기 후 몇 번 더 시도한다.
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 300;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPageWithRetry<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  from: number,
  to: number
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await fetchPage(from, to);
      if (!result.error) return result;
      lastError = new Error(result.error.message);
    } catch (err) {
      lastError = err;
    }
    if (attempt < MAX_ATTEMPTS) {
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchAllRows<T>(
  // Supabase의 쿼리 빌더(.range() 호출 결과)는 진짜 Promise가 아니라
  // PromiseLike(thenable)라서, 매개변수 타입을 Promise로 두면 구조가 안
  // 맞아 제네릭 T가 unknown으로 추론돼버린다.
  fetchPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; ; page++) {
    const from = page * PAGE_SIZE;
    const { data } = await fetchPageWithRetry(fetchPage, from, from + PAGE_SIZE - 1);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

// "최신 N건까지, 더 있으면 더보기" 화면(변경 이력 등)에서 쓴다.
// fetchAllRows와 같은 이유로 PAGE_SIZE 단위로 나눠 받아서, limit이
// 1000을 넘어가도 중간에서 조용히 잘리지 않게 한다. 끝에 1건을 더
// 조회해 "정말 더 있는지"를 정확히 판별한다 — rows.length >= limit
// 같은 근사치는 limit이 정확히 전체 건수와 같을 때도 "더 있다"고
// 잘못 판단한다.
export async function fetchLimitedRows<T>(
  fetchPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  limit: number
): Promise<{ rows: T[]; hasMore: boolean }> {
  const rows: T[] = [];
  let from = 0;
  while (rows.length < limit) {
    const want = Math.min(PAGE_SIZE, limit - rows.length);
    const { data } = await fetchPageWithRetry(fetchPage, from, from + want - 1);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < want) {
      return { rows, hasMore: false };
    }
    from += want;
  }
  const { data: probe } = await fetchPageWithRetry(fetchPage, from, from);
  return { rows, hasMore: (probe ?? []).length > 0 };
}
