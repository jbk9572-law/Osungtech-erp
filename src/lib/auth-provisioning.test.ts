import { describe, expect, it } from "vitest";
import { provisionMetadata } from "./auth-provisioning";

describe("provisionMetadata", () => {
  it("권한을 정하는 값만 app_metadata 로 복사하고 user_metadata 는 그대로 둔다", () => {
    const r = provisionMetadata({ full_name: "홍길동", username: "hong", tenant_id: "t-1" });
    expect(r.app_metadata).toEqual({ tenant_id: "t-1" });
    expect(r.user_metadata).toEqual({ full_name: "홍길동", username: "hong", tenant_id: "t-1" });
  });
  it("신규 회사·포털 계정 키도 복사한다", () => {
    expect(provisionMetadata({ new_tenant_name: "엘보닉스", new_tenant_slug: "elvonix" }).app_metadata).toEqual({
      new_tenant_name: "엘보닉스",
      new_tenant_slug: "elvonix",
    });
    expect(provisionMetadata({ portal_customer_id: "c-1", username: "u" }).app_metadata).toEqual({ portal_customer_id: "c-1" });
  });
  it("값이 비어 있으면 복사하지 않는다", () => {
    expect(provisionMetadata({ tenant_id: "", full_name: "a" }).app_metadata).toEqual({});
  });
});
