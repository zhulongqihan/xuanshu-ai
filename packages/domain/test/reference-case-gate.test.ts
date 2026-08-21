import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  countReviewedReferenceCases,
  validateReferenceCaseSet,
} from "../src";

const referencePath = process.env.XUANSHU_REFERENCE_CASES_PATH;

describe.skipIf(!referencePath)("M4/M5 独立参考案例发布闸门", () => {
  it("requires 100 reviewed cases for both ziwei and liuyao", async () => {
    const raw = await readFile(referencePath as string, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const cases = validateReferenceCaseSet(Array.isArray(parsed) ? parsed : []);
    const counts = countReviewedReferenceCases(cases);
    expect(counts.ziwei).toBeGreaterThanOrEqual(100);
    expect(counts.liuyao).toBeGreaterThanOrEqual(100);
  });
});
