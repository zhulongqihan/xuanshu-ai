import { z } from "zod";
import { rawBirthInputSchema } from "./birth";
import { liuyaoCastSchema } from "./schemas";

const referenceSystemSchema = z.enum(["ziwei", "liuyao"]);
const referenceStatusSchema = z.enum(["candidate", "needs-review", "reviewed", "rejected"]);
const sourceTierSchema = z.enum(["S0", "S1", "S2", "S3", "manual"]);

const provenanceSchema = z.object({
  sourceId: z.string().min(1).max(120),
  sourceTier: sourceTierSchema,
  edition: z.string().trim().min(1).max(200).optional(),
  locator: z.string().trim().min(1).max(300),
  inputDerivation: z.enum(["direct", "transcribed", "derived"]),
  notes: z.string().trim().max(1_000).optional(),
}).strict();

const assertionSchema = z.object({
  path: z.string().trim().regex(/^[a-zA-Z0-9_.[\]-]+$/),
  expected: z.unknown(),
  actual: z.unknown().optional(),
  comparison: z.enum(["exact", "manual", "cross-implementation"]),
  notes: z.string().trim().max(1_000).optional(),
}).strict();

const reviewSchema = z.object({
  reviewer: z.string().trim().min(1).max(120),
  reviewedAt: z.string().datetime({ offset: true }),
  decision: z.enum(["reviewed", "needs-review", "rejected"]),
  notes: z.string().trim().min(1).max(2_000),
}).strict();

const commonReferenceCaseSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9][a-z0-9._:-]{2,119}$/),
  system: referenceSystemSchema,
  status: referenceStatusSchema,
  ruleSetId: z.string().trim().min(1).max(120),
  ruleSetVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  privacy: z.object({ containsPersonalData: z.literal(false) }).strict(),
  provenance: provenanceSchema,
  assertions: z.array(assertionSchema).min(1).max(200),
  review: reviewSchema.optional(),
}).strict();

type ReviewState = {
  status: z.infer<typeof referenceStatusSchema>;
  review?: z.infer<typeof reviewSchema>;
};

function refineReviewState(value: ReviewState, context: z.RefinementCtx) {
  if (value.status === "reviewed" && value.review?.decision !== "reviewed") {
    context.addIssue({
      code: "custom",
      path: ["review", "decision"],
      message: "reviewed 案例必须有 reviewed 复核结论",
    });
  }
  if (value.status !== "reviewed" && value.review?.decision === "reviewed") {
    context.addIssue({
      code: "custom",
      path: ["status"],
      message: "有 reviewed 复核结论的案例必须将状态设为 reviewed",
    });
  }
}

export const ziweiReferenceCaseSchema = commonReferenceCaseSchema.extend({
  system: z.literal("ziwei"),
  input: rawBirthInputSchema,
}).strict().superRefine(refineReviewState);

export const liuyaoReferenceCaseSchema = commonReferenceCaseSchema.extend({
  system: z.literal("liuyao"),
  input: liuyaoCastSchema,
}).strict().superRefine(refineReviewState);

export const referenceCaseSchema = z.discriminatedUnion("system", [
  ziweiReferenceCaseSchema,
  liuyaoReferenceCaseSchema,
]);

export type ReferenceCase = z.infer<typeof referenceCaseSchema>;

export function validateReferenceCaseSet(input: unknown[]): ReferenceCase[] {
  const cases = input.map((item) => referenceCaseSchema.parse(item));
  const ids = new Set<string>();
  for (const item of cases) {
    if (ids.has(item.id)) throw new TypeError(`参考案例 ID 重复：${item.id}`);
    ids.add(item.id);
  }
  return cases;
}

export function countReviewedReferenceCases(input: readonly ReferenceCase[]) {
  return input.reduce((counts, item) => {
    if (item.status === "reviewed") counts[item.system] += 1;
    return counts;
  }, { ziwei: 0, liuyao: 0 });
}
