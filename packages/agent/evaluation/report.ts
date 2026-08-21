import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type ModelEvaluationCaseResult = {
  id: string;
  status: "passed" | "failed";
  kind?: string;
};

export type ModelEvaluationReport = {
  schemaVersion: 1;
  suite: "xuanshu-agent-model-evaluation-v1";
  total: number;
  passed: number;
  failed: number;
  failures: Array<{ id: string; kind: string }>;
  startedAt: string;
  completedAt: string;
};

export function createModelEvaluationReport(input: {
  results: readonly ModelEvaluationCaseResult[];
  startedAt: string;
  completedAt: string;
}): ModelEvaluationReport {
  const failures = input.results
    .filter((result): result is ModelEvaluationCaseResult & { status: "failed" } => result.status === "failed")
    .map((result) => ({ id: result.id, kind: result.kind ?? "unknown" }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return {
    schemaVersion: 1,
    suite: "xuanshu-agent-model-evaluation-v1",
    total: input.results.length,
    passed: input.results.length - failures.length,
    failed: failures.length,
    failures,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  };
}

export async function writeModelEvaluationReport(path: string, report: ModelEvaluationReport) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
