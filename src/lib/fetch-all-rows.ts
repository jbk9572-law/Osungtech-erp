// PostgREST는 supabase/config.toml의 max_rows(1000)를 넘으면 별도 에러
// 없이 결과를 그 값까지만 잘라서 돌려준다 — .order()+.limit(N)만 걸어두면
// N이 1000보다 커도 조용히 1000건에서 잘리고, 오름차순 정렬이면 최신
// 데이터부터 빠진다. 정확도가 중요한 화면(월별 집계 등)에서는 .range()로
// 직접 페이지를 넘기며 끝까지 받아와야 한다(src/app/api/backup/export의
// 페이지네이션과 동일한 방식).
const PAGE_SIZE = 1000;

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
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(error.message);
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}
