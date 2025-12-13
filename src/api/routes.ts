import { randomUUID } from "crypto";
import { Hono } from "hono";
import { z } from "zod";
import { runScreening, type CustomerData } from "../screening/run.js";
import { logScreeningResult } from "../logging/axiom.js";
import { authMiddleware } from "./auth.js";

// Request validation schema
const CustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  institution: z.string().optional(),
  orcid: z.string().optional(),
  address: z.string().optional(),
  is_end_user: z.boolean().optional(),
  institution_type: z.string().optional(),
});

const ScreeningRequestSchema = z.object({
  customer: CustomerSchema,
});

type ErrorCode = "SCREENING_FAILED" | "TIMEOUT" | "INVALID_INPUT";

interface ScreeningResponse {
  job_id: string;
  status: "complete" | "error";
  raw_report?: string;
  error?: {
    message: string;
    code: ErrorCode;
  };
  metadata: {
    duration_ms: number;
    tools_called: string[];
  };
}

export function createApiRoutes(mcpBaseUrl: string): Hono {
  const api = new Hono();

  // Health check endpoint (no auth required)
  api.get("/health", (c) => {
    return c.json({ status: "ok" });
  });

  // Screenings endpoint (auth required)
  api.post("/screenings", authMiddleware, async (c) => {
    const jobId = randomUUID();
    const startTime = Date.now();
    let toolsCalled: string[] = [];

    try {
      // Parse and validate request body
      const body = await c.req.json();
      const parseResult = ScreeningRequestSchema.safeParse(body);

      if (!parseResult.success) {
        const durationMs = Date.now() - startTime;
        const errorMessage = parseResult.error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ");

        // Log the error
        await logScreeningResult({
          job_id: jobId,
          timestamp: new Date().toISOString(),
          duration_ms: durationMs,
          outcome: "error",
          tools_called: [],
          error_message: errorMessage,
          customer: body?.customer || {},
        });

        const response: ScreeningResponse = {
          job_id: jobId,
          status: "error",
          error: {
            message: errorMessage,
            code: "INVALID_INPUT",
          },
          metadata: {
            duration_ms: durationMs,
            tools_called: [],
          },
        };

        return c.json(response, 400);
      }

      const { customer } = parseResult.data;

      // Run the screening
      const result = await runScreening(customer as CustomerData, mcpBaseUrl);
      toolsCalled = result.tools_called;

      const durationMs = Date.now() - startTime;

      // Log successful result
      await logScreeningResult({
        job_id: jobId,
        timestamp: new Date().toISOString(),
        duration_ms: durationMs,
        outcome: "complete",
        tools_called: toolsCalled,
        error_message: null,
        customer: customer as Record<string, unknown>,
      });

      const response: ScreeningResponse = {
        job_id: jobId,
        status: "complete",
        raw_report: result.raw_report,
        metadata: {
          duration_ms: durationMs,
          tools_called: toolsCalled,
        },
      };

      return c.json(response);
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Determine error code
      let errorCode: ErrorCode = "SCREENING_FAILED";
      if (errorMessage.includes("timeout") || errorMessage.includes("Timeout")) {
        errorCode = "TIMEOUT";
      }

      // Log the error
      let customerData = {};
      try {
        const body = await c.req.json();
        customerData = body?.customer || {};
      } catch {
        // Ignore parse errors for logging
      }

      await logScreeningResult({
        job_id: jobId,
        timestamp: new Date().toISOString(),
        duration_ms: durationMs,
        outcome: "error",
        tools_called: toolsCalled,
        error_message: errorMessage,
        customer: customerData,
      });

      const response: ScreeningResponse = {
        job_id: jobId,
        status: "error",
        error: {
          message: errorMessage,
          code: errorCode,
        },
        metadata: {
          duration_ms: durationMs,
          tools_called: toolsCalled,
        },
      };

      return c.json(response, 500);
    }
  });

  return api;
}
