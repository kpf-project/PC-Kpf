import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { join } from "node:path";

type LogLevel = "debug" | "info" | "warn" | "error";

export type LogAttributes = Record<string, unknown>;

export interface TelemetrySpan {
  id: string;
  name: string;
  attributes: LogAttributes;
  setAttribute: (key: string, value: unknown) => void;
  addEvent: (message: string, attributes?: LogAttributes) => Promise<void>;
  addMetric: (name: string, value: number, attributes?: LogAttributes) => Promise<void>;
  markError: (error: unknown, attributes?: LogAttributes) => Promise<void>;
}

const LOG_DIR =
  process.env.OBSERVABILITY_LOG_DIR ?? join(process.cwd(), "data", "logs");
const APP_LOG_FILE =
  process.env.OBSERVABILITY_APP_LOG ?? "app.log";
const METRIC_LOG_FILE =
  process.env.OBSERVABILITY_METRIC_LOG ?? "metrics.log";
const TRACE_LOG_FILE =
  process.env.OBSERVABILITY_TRACE_LOG ?? "traces.log";

const APP_LOG_PATH = join(LOG_DIR, APP_LOG_FILE);
const METRIC_LOG_PATH = join(LOG_DIR, METRIC_LOG_FILE);
const TRACE_LOG_PATH = join(LOG_DIR, TRACE_LOG_FILE);

const LOG_TO_STDOUT = process.env.OBSERVABILITY_STDOUT !== "false";

let ensureLogDirectoryPromise: Promise<void> | null = null;

async function ensureLogDirectory(): Promise<void> {
  if (!ensureLogDirectoryPromise) {
    ensureLogDirectoryPromise = mkdir(LOG_DIR, { recursive: true }).then(() => undefined);
  }
  await ensureLogDirectoryPromise;
}

function sanitizeValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const sanitized = sanitizeValue(val);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    }
    return result;
  }
  return value;
}

function sanitizeAttributes(attributes?: LogAttributes): LogAttributes | undefined {
  if (!attributes) {
    return undefined;
  }
  const sanitized: LogAttributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    const sanitizedValue = sanitizeValue(value);
    if (sanitizedValue !== undefined) {
      sanitized[key] = sanitizedValue;
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

async function writeLogLine(
  path: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await ensureLogDirectory();
    await appendFile(path, `${JSON.stringify(payload)}\n`, "utf8");
  } catch (error) {
    // เราไม่ควร throw จากระบบสังเกตการณ์ ป้องกันการล้มของ biz flow
    const safeError =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    const message = `[Observability] ไม่สามารถบันทึกไฟล์ ${path}: ${safeError}`;
    if (LOG_TO_STDOUT) {
      console.error(message);
    }
  }
}

function emitToConsole(level: LogLevel, message: string, attributes?: LogAttributes) {
  if (!LOG_TO_STDOUT) {
    return;
  }
  const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
  const serializedAttributes = attributes ? ` ${JSON.stringify(attributes)}` : "";
  if (level === "error") {
    console.error(`${prefix}${serializedAttributes}`);
  } else if (level === "warn") {
    console.warn(`${prefix}${serializedAttributes}`);
  } else {
  }
}

export async function logEvent(
  level: LogLevel,
  message: string,
  attributes?: LogAttributes,
): Promise<void> {
  const sanitizedAttributes = sanitizeAttributes(attributes);
  const payload = {
    type: "log",
    timestamp: new Date().toISOString(),
    level,
    message,
    attributes: sanitizedAttributes,
  };
  emitToConsole(level, message, sanitizedAttributes);
  await writeLogLine(APP_LOG_PATH, payload);
}

export async function recordMetric(
  name: string,
  value: number,
  attributes?: LogAttributes,
): Promise<void> {
  const sanitizedAttributes = sanitizeAttributes(attributes);
  const payload = {
    type: "metric",
    timestamp: new Date().toISOString(),
    name,
    value,
    attributes: sanitizedAttributes,
  };
  await writeLogLine(METRIC_LOG_PATH, payload);
}

async function recordTraceEvent(
  spanId: string,
  name: string,
  event: "start" | "end" | "exception" | "event",
  attributes?: LogAttributes,
): Promise<void> {
  const sanitizedAttributes = sanitizeAttributes(attributes);
  const payload = {
    type: "trace",
    timestamp: new Date().toISOString(),
    spanId,
    name,
    event,
    attributes: sanitizedAttributes,
  };
  await writeLogLine(TRACE_LOG_PATH, payload);
}

export async function withTelemetrySpan<T>(
  name: string,
  operation: (span: TelemetrySpan) => Promise<T>,
  baseAttributes?: LogAttributes,
): Promise<T> {
  const spanId = randomUUID();
  const attributes: LogAttributes = {
    ...(sanitizeAttributes(baseAttributes) ?? {}),
    spanId,
    spanName: name,
  };

  const span: TelemetrySpan = {
    id: spanId,
    name,
    attributes,
    setAttribute: (key: string, value: unknown) => {
      if (value === undefined) {
        delete attributes[key];
        return;
      }
      const sanitized = sanitizeValue(value);
      if (sanitized === undefined) {
        delete attributes[key];
        return;
      }
      attributes[key] = sanitized;
    },
    addEvent: async (message: string, eventAttributes?: LogAttributes) => {
      const mergedAttributes = {
        ...attributes,
        ...(sanitizeAttributes(eventAttributes) ?? {}),
      };
      await logEvent("debug", message, mergedAttributes);
      await recordTraceEvent(spanId, name, "event", mergedAttributes);
    },
    addMetric: (metricName: string, value: number, metricAttributes?: LogAttributes) => {
      const mergedAttributes = {
        ...attributes,
        ...(sanitizeAttributes(metricAttributes) ?? {}),
      };
      return recordMetric(metricName, value, mergedAttributes);
    },
    markError: async (error: unknown, errorAttributes?: LogAttributes) => {
      const mergedAttributes = {
        ...attributes,
        ...(sanitizeAttributes(errorAttributes) ?? {}),
        error: sanitizeValue(error),
      };
      attributes.spanStatus = "error";
      await logEvent("error", "span.marked_error", mergedAttributes);
    },
  };

  await logEvent("info", "span.start", attributes);
  await recordTraceEvent(spanId, name, "start", attributes);

  const startTime = performance.now();

  try {
    const result = await operation(span);
    const durationMs = performance.now() - startTime;
    const completionAttributes = {
      ...attributes,
      durationMs: Math.round(durationMs * 1000) / 1000,
    };
    await recordMetric(`${name}.duration_ms`, durationMs, completionAttributes);
    if (attributes.spanStatus === "error") {
      await logEvent("error", "span.error", completionAttributes);
      await recordTraceEvent(spanId, name, "exception", completionAttributes);
    } else {
      await logEvent("info", "span.success", completionAttributes);
      await recordTraceEvent(spanId, name, "end", completionAttributes);
    }
    return result;
  } catch (error) {
    const durationMs = performance.now() - startTime;
    const errorAttributes = {
      ...attributes,
      durationMs: Math.round(durationMs * 1000) / 1000,
      error: sanitizeValue(error),
    };
    await logEvent("error", "span.error", errorAttributes);
    await recordTraceEvent(spanId, name, "exception", errorAttributes);
    throw error;
  }
}

export const telemetry = {
  logEvent,
  recordMetric,
  withTelemetrySpan,
};
