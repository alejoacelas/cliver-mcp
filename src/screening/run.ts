import Anthropic from "@anthropic-ai/sdk";
import { SCREENING_GUIDANCE } from "./prompt.js";

export interface CustomerData {
  name: string;
  email: string;
  institution?: string;
  orcid?: string;
  address?: string;
  is_end_user?: boolean;
  institution_type?: string;
}

export interface ScreeningResult {
  raw_report: string;
  tools_called: string[];
}

export async function runScreening(
  customer: CustomerData,
  mcpBaseUrl: string
): Promise<ScreeningResult> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    defaultHeaders: {
      "anthropic-beta": "mcp-client-2025-04-04",
    },
  });

  // Format customer info for the prompt
  const customerInfoParts: string[] = [];
  customerInfoParts.push(`Name: ${customer.name}`);
  customerInfoParts.push(`Email: ${customer.email}`);
  if (customer.institution) {
    customerInfoParts.push(`Institution: ${customer.institution}`);
  }
  if (customer.orcid) {
    customerInfoParts.push(`ORCID: ${customer.orcid}`);
  }
  if (customer.address) {
    customerInfoParts.push(`Address: ${customer.address}`);
  }
  if (customer.is_end_user !== undefined) {
    customerInfoParts.push(`End User: ${customer.is_end_user ? "Yes" : "No"}`);
  }
  if (customer.institution_type) {
    customerInfoParts.push(`Institution Type: ${customer.institution_type}`);
  }

  const customerInfo = customerInfoParts.join("\n");

  // Cast to any to support beta features (thinking, mcp_servers, web_search)
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 60000,
    thinking: {
      type: "enabled",
      budget_tokens: 40000,
    },
    messages: [
      {
        role: "user",
        content: `<guidance>${SCREENING_GUIDANCE}</guidance>\n\n${customerInfo}`,
      },
    ],
    mcp_servers: [
      {
        type: "url",
        url: `${mcpBaseUrl}/sse`,
        name: "screening_tools",
        tool_configuration: {
          enabled: true,
          allowed_tools: [
            "search_nih_grants_by_pi_name",
            "get_orcid_profile",
            "calculate_distance",
            "search_screening_list",
          ],
        },
      },
    ],
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 5,
      },
    ],
  } as any);

  // Extract text from response
  let text = "";
  const toolsCalled: Set<string> = new Set();

  if (response.content) {
    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
      } else if (block.type === "tool_use") {
        toolsCalled.add(block.name);
      }
    }
  }

  return {
    raw_report: text,
    tools_called: Array.from(toolsCalled),
  };
}
