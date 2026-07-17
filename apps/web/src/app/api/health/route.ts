import { loadAppConfig } from "@xuanshu/agent";
import { readDatabaseStatus } from "@/server/db";

const responseInit = {
  headers: {
    "Cache-Control": "no-store",
  },
};

export async function GET() {
  try {
    const [database, modelConfig] = await Promise.all([
      readDatabaseStatus(),
      loadAppConfig(),
    ]);
    const apiKeyPresent = Boolean(
      process.env[modelConfig.config.provider.api_key_env]?.trim(),
    );

    return Response.json({
      service: "xuanshu-ai",
      status: database.initialized ? "ok" : "degraded",
      version: "0.1.0",
      database: {
        initialized: database.initialized,
      },
      model: {
        configSource: modelConfig.source,
        configured: apiKeyPresent,
      },
    }, responseInit);
  } catch {
    return Response.json(
      {
        service: "xuanshu-ai",
        status: "error",
        version: "0.1.0",
      },
      { ...responseInit, status: 503 },
    );
  }
}
