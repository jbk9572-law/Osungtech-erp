import { describe, expect, it } from "vitest";
import { checkMonthlyQuota, remainingMonthlyQuota } from "./monthly-quota";

type Fake = Parameters<typeof checkMonthlyQuota>[0];
const fake = (result: { data: unknown; error: { message: string } | null }) =>
  ({ rpc: async () => result }) as unknown as Fake;
const status = (over: Partial<Record<string, number | boolean>> = {}) => ({
  data: { exempt: false, email_used: 0, email_quota: 100, invoice_used: 0, invoice_quota: 100, ...over },
  error: null,
});

describe("월 한도 확인", () => {
  it("한도 안이면 통과(null)", async () => {
    expect(await checkMonthlyQuota(fake(status({ email_used: 99 })), "email")).toBeNull();
  });
  it("한도에 도달하면 안내 문구로 막는다", async () => {
    const msg = await checkMonthlyQuota(fake(status({ email_used: 100 })), "email");
    expect(msg).toContain("이메일 발송 한도(100건)");
  });
  it("여러 건을 한 번에 처리할 때 남은 건수보다 많으면 막는다", async () => {
    expect(await checkMonthlyQuota(fake(status({ invoice_used: 98 })), "invoice", 3)).toContain("세금계산서 발행 한도");
    expect(await checkMonthlyQuota(fake(status({ invoice_used: 98 })), "invoice", 2)).toBeNull();
  });
  it("운영 회사·샌드박스(exempt)는 한도 없음", async () => {
    expect(await checkMonthlyQuota(fake(status({ exempt: true, email_used: 999 })), "email")).toBeNull();
  });
  it("조회가 실패하면 업무를 막지 않는다(통과)", async () => {
    expect(await remainingMonthlyQuota(fake({ data: null, error: { message: "boom" } }), "email")).toBeNull();
  });
});
