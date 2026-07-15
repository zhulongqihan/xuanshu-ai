import { describe, expect, it } from "vitest";
import {
  defaultAppConfig,
  getDefaultConfigPath,
  parseAppConfig,
  resolveApiKey,
} from "../src/config";

const validToml = `
config_version = 1

[provider]
type = "openai-compatible"
base_url = "https://relay.example.com/v1/"
api_mode = "responses"
model = "gpt-5.6"
reasoning_effort = "medium"
api_key_env = "XUANSHU_AI_API_KEY"
store = false
timeout_ms = 120000
max_retries = 2
`;

describe("model configuration", () => {
  it("parses a Codex-style provider configuration", () => {
    const config = parseAppConfig(validToml);
    expect(config.provider.base_url).toBe("https://relay.example.com/v1");
    expect(config.provider.api_mode).toBe("responses");
  });

  it("rejects plaintext API keys and unknown fields", () => {
    expect(() =>
      parseAppConfig(validToml.replace("store = false", 'api_key = "secret"\nstore = false')),
    ).toThrow();
  });

  it("rejects storage being enabled", () => {
    expect(() => parseAppConfig(validToml.replace("store = false", "store = true"))).toThrow();
  });

  it("resolves secrets only through the configured environment variable", () => {
    expect(resolveApiKey(defaultAppConfig, { XUANSHU_AI_API_KEY: " test-key " })).toBe(
      "test-key",
    );
    expect(() => resolveApiKey(defaultAppConfig, {})).toThrow(
      "缺少环境变量 XUANSHU_AI_API_KEY",
    );
  });

  it("uses the user-home config location", () => {
    expect(getDefaultConfigPath("C:\\Users\\demo")).toContain(".xuanshu-ai");
    expect(getDefaultConfigPath("C:\\Users\\demo")).toContain("config.toml");
  });
});
