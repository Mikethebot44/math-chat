import { registerOTel } from "@vercel/otel";
import { config } from "@/lib/config";

const OTEL_TRACING_ENABLED = process.env.ENABLE_OTEL_TRACING === "true";

export async function register() {
  if (!OTEL_TRACING_ENABLED) {
    return;
  }

  const { LangfuseExporter } = await import("langfuse-vercel");

  registerOTel({
    serviceName: config.appPrefix,
    traceExporter: new LangfuseExporter(),
  });
}
