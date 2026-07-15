import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "@iarna/toml";
import { z } from "zod";

export const modelProviderSchema = z
  .object({
    type: z.literal("openai-compatible"),
    base_url: z.string().url().transform((value) => value.replace(/\/+$/, "")),
    api_mode: z.enum(["responses", "chat_completions"]),
    model: z.string().trim().min(1).max(120),
    reasoning_effort: z.enum(["none", "low", "medium", "high", "xhigh", "max"]),
    api_key_env: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
    store: z.literal(false),
    timeout_ms: z.number().int().min(1_000).max(600_000),
    max_retries: z.number().int().min(0).max(5),
  })
  .strict();

export const appConfigSchema = z
  .object({
    config_version: z.literal(1),
    provider: modelProviderSchema,
  })
  .strict();

export type AppConfig = z.infer<typeof appConfigSchema>;

export const defaultAppConfig: AppConfig = {
  config_version: 1,
  provider: {
    type: "openai-compatible",
    base_url: "https://api.openai.com/v1",
    api_mode: "responses",
    model: "gpt-5.6",
    reasoning_effort: "medium",
    api_key_env: "XUANSHU_AI_API_KEY",
    store: false,
    timeout_ms: 120_000,
    max_retries: 2,
  },
};

export function getDefaultConfigPath(homeDirectory = homedir()) {
  return join(homeDirectory, ".xuanshu-ai", "config.toml");
}

export function parseAppConfig(input: string): AppConfig {
  return appConfigSchema.parse(parse(input));
}

export async function loadAppConfig(configPath = getDefaultConfigPath()) {
  try {
    const contents = await readFile(configPath, "utf8");
    return { config: parseAppConfig(contents), path: configPath, source: "file" as const };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        config: defaultAppConfig,
        path: configPath,
        source: "defaults" as const,
      };
    }
    throw error;
  }
}

export function resolveApiKey(
  config: AppConfig,
  environment: NodeJS.ProcessEnv = process.env,
) {
  const key = environment[config.provider.api_key_env]?.trim();
  if (!key) {
    throw new Error(`缺少环境变量 ${config.provider.api_key_env}`);
  }
  return key;
}
