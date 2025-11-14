import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: {
    "anthropic-beta": "mcp-client-2025-04-04"
  }
});

const GUIDANCE = readFileSync("./SCREENING_GUIDANCE.txt", "utf-8");

export async function screenCustomer(customerInfo: string) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514", // later models have too stringent biosecurity safeguards
    max_tokens: 60000,
    thinking: {
      type: "enabled",
      budget_tokens: 40000
    },
    messages: [
      {
        role: "user",
        content: `<guidance>${GUIDANCE}</guidance>\n\n${customerInfo}`
      }
    ],
    mcp_servers: [
      {
        type: "url",
        url: "https://cf-template.alejoacelas.workers.dev/sse",
        name: "custom_screening_tools",
        tool_configuration: {
          enabled: true,
          allowed_tools: [
            "search_nih_grants_by_pi_name",
            "get_orcid_profile",
            "calculate_distance",
            "search_screening_list",
           
            // Too many tools can eat the context window and distract the model
            // "search_epmc_by_orcid",
            // "get_publication_details",
            // "search_nih_grants_by_organization",
            // "get_nih_grant_by_number",
            // "get_coordinates",
          ]
        }
      }
    ],
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 5
      }
    ]
  });

  // Extract text from response
  let text = "";
  if (response.content) {
    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text;
      }
    }
  }

  console.log(text);
}


// Example customer info
const customerInfo = `Name: Hanna Palya
Institution: University of Warwick
Email: Hanna.palya@warwick.ac.uk
ORCID: 0000-0001-6890-2906`;

screenCustomer(customerInfo).catch(console.error);