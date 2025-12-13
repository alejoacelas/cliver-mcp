import { Context, Next } from "hono";

export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    return c.json(
      {
        error: {
          message: "Missing Authorization header",
          code: "UNAUTHORIZED",
        },
      },
      401
    );
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return c.json(
      {
        error: {
          message: "Invalid Authorization header format. Expected: Bearer <token>",
          code: "UNAUTHORIZED",
        },
      },
      401
    );
  }

  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    console.error("API_KEY environment variable not set");
    return c.json(
      {
        error: {
          message: "Server configuration error",
          code: "INTERNAL_ERROR",
        },
      },
      500
    );
  }

  if (token !== apiKey) {
    return c.json(
      {
        error: {
          message: "Invalid API key",
          code: "UNAUTHORIZED",
        },
      },
      401
    );
  }

  await next();
}
