import { describe, expect, it } from "vitest";
import { IN_FILTER_CHUNK, chunkIds, fetchAllRowsIn, selectInChunks } from "./fetch-all-rows";

describe("id 목록 나눠 조회(.in() 주소 길이 방지)", () => {
  it("중복을 없애고 정해진 크기로 나눈다", () => {
    const ids = Array.from({ length: IN_FILTER_CHUNK * 2 + 5 }, (_, i) => `id-${i % (IN_FILTER_CHUNK * 2 + 1)}`);
    const chunks = chunkIds(ids);
    expect(chunks.every((c) => c.length <= IN_FILTER_CHUNK)).toBe(true);
    expect(chunks.flat().length).toBe(IN_FILTER_CHUNK * 2 + 1);
    expect(chunkIds([])).toEqual([]);
  });

  it("selectInChunks: 조각마다 한 번씩 부르고 결과를 합친다(주소에 들어가는 id 가 조각 크기를 넘지 않는다)", async () => {
    const ids = Array.from({ length: 1000 }, (_, i) => `id-${i}`);
    let maxInUrl = 0;
    const res = await selectInChunks<{ id: string }, string>(ids, async (chunk) => {
      maxInUrl = Math.max(maxInUrl, chunk.length);
      return { data: chunk.map((id) => ({ id })), error: null };
    });
    expect(res.data).toHaveLength(1000);
    expect(res.error).toBeNull();
    expect(maxInUrl).toBeLessThanOrEqual(IN_FILTER_CHUNK);
  });

  it("selectInChunks: 한 조각이라도 실패하면 오류를 돌려준다", async () => {
    const ids = Array.from({ length: 200 }, (_, i) => `id-${i}`);
    let n = 0;
    const res = await selectInChunks<{ id: string }, string>(ids, async () =>
      ++n === 2 ? { data: null, error: { message: "boom" } } : { data: [{ id: "x" }], error: null },
    );
    expect(res.error?.message).toBe("boom");
  });

  it("fetchAllRowsIn: 조각별로 페이지를 끝까지 받아 합친다", async () => {
    const ids = Array.from({ length: 300 }, (_, i) => `id-${i}`);
    const rows = await fetchAllRowsIn<{ id: string }, string>(ids, async (chunk, from, to) => {
      const all = chunk.map((id) => ({ id }));
      return { data: all.slice(from, to + 1), error: null };
    });
    expect(rows).toHaveLength(300);
  });

  it("빈 목록은 요청 없이 빈 결과", async () => {
    let called = 0;
    const res = await selectInChunks<{ id: string }, string>([], async () => {
      called++;
      return { data: [], error: null };
    });
    expect(res.data).toEqual([]);
    expect(called).toBe(0);
  });
});
