import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { sweepOrphanR2Files } from "./sweep-orphans";
import type { R2ObjectSummary } from "./client";

function fakeSupabaseReturning(paths: string[]): SupabaseClient<Database> {
  return {
    from: () => ({
      select: () => ({
        like: () => ({
          range: (from: number) =>
            Promise.resolve({
              data: from === 0 ? paths.map((storage_path) => ({ storage_path })) : [],
              error: null,
            }),
        }),
      }),
    }),
  } as unknown as SupabaseClient<Database>;
}

const R2_ENV_KEYS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"] as const;
let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const key of R2_ENV_KEYS) {
    savedEnv[key] = process.env[key];
    process.env[key] = `fake-${key}`;
  }
});

afterEach(() => {
  for (const key of R2_ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("sweepOrphanR2Files", () => {
  it("DB에서 참조하지 않고 유예 기간이 지난 객체만 지운다", async () => {
    const now = Date.now();
    const objects: R2ObjectSummary[] = [
      { key: "r2/mail-attachments/referenced.pdf", lastModified: new Date(now - 48 * 60 * 60 * 1000), size: 100 },
      { key: "r2/mail-attachments/orphan-old.pdf", lastModified: new Date(now - 48 * 60 * 60 * 1000), size: 200 },
      { key: "r2/mail-attachments/orphan-recent.pdf", lastModified: new Date(now - 1 * 60 * 60 * 1000), size: 300 },
    ];
    const deleted: string[] = [];

    const result = await sweepOrphanR2Files({
      supabase: fakeSupabaseReturning(["r2/mail-attachments/referenced.pdf"]),
      listObjects: () => Promise.resolve(objects),
      deleteObject: (key) => {
        deleted.push(key);
        return Promise.resolve();
      },
    });

    expect(result.scanned).toBe(3);
    expect(result.referenced).toBe(1);
    expect(result.skippedRecent).toBe(1); // orphan-recent는 유예 기간 안이라 보류
    expect(result.deleted).toEqual(["r2/mail-attachments/orphan-old.pdf"]);
    expect(deleted).toEqual(["r2/mail-attachments/orphan-old.pdf"]);
  });

  it("dryRun이면 삭제 대상 목록만 반환하고 실제로 지우지 않는다", async () => {
    const now = Date.now();
    const objects: R2ObjectSummary[] = [
      { key: "r2/mail-attachments/orphan.pdf", lastModified: new Date(now - 48 * 60 * 60 * 1000), size: 100 },
    ];
    const deleteObject = vi.fn(() => Promise.resolve());

    const result = await sweepOrphanR2Files({
      supabase: fakeSupabaseReturning([]),
      dryRun: true,
      listObjects: () => Promise.resolve(objects),
      deleteObject,
    });

    expect(result.deleted).toEqual(["r2/mail-attachments/orphan.pdf"]);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("참조 중인 객체는 유예 기간과 무관하게 절대 지우지 않는다", async () => {
    const now = Date.now();
    const objects: R2ObjectSummary[] = [
      { key: "r2/mail-attachments/referenced-old.pdf", lastModified: new Date(now - 365 * 24 * 60 * 60 * 1000), size: 100 },
    ];
    const deleteObject = vi.fn(() => Promise.resolve());

    const result = await sweepOrphanR2Files({
      supabase: fakeSupabaseReturning(["r2/mail-attachments/referenced-old.pdf"]),
      listObjects: () => Promise.resolve(objects),
      deleteObject,
    });

    expect(result.deleted).toEqual([]);
    expect(deleteObject).not.toHaveBeenCalled();
  });
});
