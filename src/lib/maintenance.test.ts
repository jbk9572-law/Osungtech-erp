import { afterEach, describe, expect, it, vi } from "vitest";
import { decideMaintenance, getMaintenanceFlag, resetMaintenanceCacheForTest } from "./maintenance";

const h = (map: Record<string, string> = {}) => ({ get: (n: string) => map[n.toLowerCase()] ?? null });

describe("decideMaintenance", () => {
  it("점검 중이 아니거나 플랫폼 운영자면 항상 통과", () => {
    expect(decideMaintenance({ on: false, isPlatformAdmin: false, pathname: "/sales", headers: h() })).toBe("allow");
    expect(decideMaintenance({ on: true, isPlatformAdmin: true, pathname: "/sales", headers: h() })).toBe("allow");
  });
  it("점검 중에는 화면·화면이동·저장 요청을 각각 다르게 막는다", () => {
    expect(decideMaintenance({ on: true, isPlatformAdmin: false, pathname: "/sales", headers: h() })).toBe("page");
    expect(decideMaintenance({ on: true, isPlatformAdmin: false, pathname: "/sales", headers: h({ rsc: "1" }) })).toBe("fetch");
    expect(decideMaintenance({ on: true, isPlatformAdmin: false, pathname: "/sales", headers: h({ "next-action": "abc" }) })).toBe("action");
    expect(decideMaintenance({ on: true, isPlatformAdmin: false, pathname: "/api/sales/export", headers: h() })).toBe("page");
    expect(decideMaintenance({ on: true, isPlatformAdmin: false, pathname: "/portal/orders", headers: h() })).toBe("page");
  });
  it("안내 화면·로그인·크론은 점검 중에도 열려 있다(운영자가 로그인해서 꺼야 하므로)", () => {
    for (const pathname of ["/maintenance", "/login", "/auth/callback", "/api/cron/warmup"]) {
      expect(decideMaintenance({ on: true, isPlatformAdmin: false, pathname, headers: h() }), pathname).toBe("allow");
    }
  });
});

describe("getMaintenanceFlag", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetMaintenanceCacheForTest();
  });
  const stub = (impl: () => Promise<Response>) => vi.stubGlobal("fetch", vi.fn(impl));

  it("켜짐 값을 읽고 5초 동안은 다시 조회하지 않는다", async () => {
    stub(async () => new Response(JSON.stringify([{ maintenance_mode: true, maintenance_message: "배포 중" }]), { status: 200 }));
    expect(await getMaintenanceFlag(1000)).toEqual({ on: true, message: "배포 중" });
    await getMaintenanceFlag(3000);
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    await getMaintenanceFlag(7000);
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
  });
  it("조회가 실패하면 점검 아님으로 두어 DB 순단에 모두를 막지 않는다", async () => {
    stub(async () => {
      throw new Error("down");
    });
    expect(await getMaintenanceFlag(1000)).toEqual({ on: false, message: null });
  });
});
