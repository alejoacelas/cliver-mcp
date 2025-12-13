import { Axiom } from "@axiomhq/js";

interface LogData {
  job_id: string;
  timestamp: string;
  duration_ms: number;
  outcome: "complete" | "error";
  tools_called: string[];
  error_message: string | null;
  customer: Record<string, unknown>;
}

let axiomClient: Axiom | null = null;

function getAxiomClient(): Axiom | null {
  if (!axiomClient && process.env.AXIOM_TOKEN) {
    axiomClient = new Axiom({
      token: process.env.AXIOM_TOKEN,
    });
  }
  return axiomClient;
}

export async function logScreeningResult(data: LogData): Promise<void> {
  const dataset = process.env.AXIOM_DATASET || "ansa-data";
  const client = getAxiomClient();

  // Always log to console for debugging
  console.log("[Axiom Log]", JSON.stringify(data, null, 2));

  if (!client) {
    console.warn("AXIOM_TOKEN not set, skipping Axiom logging");
    return;
  }

  try {
    client.ingest(dataset, [data]);
    await client.flush();
  } catch (error) {
    console.error("Failed to log to Axiom:", error);
  }
}
