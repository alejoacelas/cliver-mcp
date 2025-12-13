import http from "http";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { createMCPServer } from "./mcp/server.js";
import { createApiRoutes } from "./api/routes.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const MCP_BASE_URL = process.env.MCP_BASE_URL || `http://localhost:${PORT}`;

async function main() {
  // Create the main Hono app for API routes
  const app = new Hono();

  // Add request logging
  app.use("*", logger());

  // Add API routes
  const apiRoutes = createApiRoutes(MCP_BASE_URL);
  app.route("/", apiRoutes);

  // Create MCP server
  const mcpServer = createMCPServer();

  // Start MCP server with HTTP stream mode
  // FastMCP will handle /sse and /mcp endpoints on the same port
  mcpServer.start({
    transportType: "httpStream",
    httpStream: {
      port: PORT,
      endpoint: "/mcp",
    },
  });

  // Give FastMCP a moment to start, then add our routes
  // Note: This is a workaround because FastMCP starts its own Hono server
  // We'll use a different port for our API if needed
  setTimeout(() => {
    // Check if we can access FastMCP's internal app
    const mcpApp = (mcpServer as any).hono;
    if (mcpApp && typeof mcpApp.route === "function") {
      mcpApp.route("/", apiRoutes);
      console.log(`API routes mounted on FastMCP server`);
      console.log(`API endpoint: http://localhost:${PORT}/screenings`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    } else {
      // FastMCP doesn't expose its app, start a separate server
      console.log(`Starting API server on alternate port ${PORT + 1}`);
      serve({
        fetch: app.fetch,
        port: PORT + 1,
      });
      console.log(`API endpoint: http://localhost:${PORT + 1}/screenings`);
      console.log(`Health check: http://localhost:${PORT + 1}/health`);
    }
  }, 100);

  console.log(`Cliver Screening API starting...`);
  console.log(`MCP endpoint: http://localhost:${PORT}/sse`);
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
