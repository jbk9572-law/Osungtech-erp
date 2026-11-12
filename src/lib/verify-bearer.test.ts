import { describe, expect, it } from "vitest";
import { isValidBearer } from "./verify-bearer";

describe("isValidBearer", () => {
  it("정확히 일치할 때만 통과한다", () => {
    expect(isValidBearer("Bearer s3cret", "s3cret")).toBe(true);
    expect(isValidBearer("Bearer s3cret ", "s3cret")).toBe(false);
    expect(isValidBearer("Bearer wrong!", "s3cret")).toBe(false);
    expect(isValidBearer("s3cret", "s3cret")).toBe(false);
    expect(isValidBearer(null, "s3cret")).toBe(false);
    expect(isValidBearer("", "s3cret")).toBe(false);
  });
});
