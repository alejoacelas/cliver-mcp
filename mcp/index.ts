import { FastMCP } from "fastmcp";
import { z } from "zod";
import {
  getEpmcPublicationsByOrcid,
  type PublicationRecord,
} from "./epmc.js";
import {
  getNIHGrantsByPIName,
  getNIHGrantsByOrganization,
  getNIHGrantByNumber,
  type GrantRecord,
} from "./nih.js";
import {
  getOrcidProfile,
  type CustomerProfile,
} from "./orcid.js";
import {
  GoogleMapsService,
  type CoordinatesResult,
  type DistanceResult,
} from "./maps.js";
import {
  ScreeningListService,
  type ScreeningResult,
} from "./screening.js";

// Create FastMCP server
const server = new FastMCP({
  name: "RoseScout",
  version: "1.0.0",
  instructions: "Research and compliance tools for accessing academic publications, grants, researcher profiles, and screening lists.",
});

// Europe PMC Tools
server.addTool({
  name: "search_epmc_by_orcid",
  description: "Search for publications by ORCID ID in Europe PMC database",
  parameters: z.object({
    orcid_id: z.string().describe("The ORCID identifier of the researcher"),
    max_results: z.number().default(20).describe("Maximum number of results to return"),
  }),
  execute: async (args) => {
    try {
      const publications = await getEpmcPublicationsByOrcid(args.orcid_id, args.max_results);
      return JSON.stringify(publications, null, 2);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

server.addTool({
  name: "get_publication_details",
  description: "Get detailed information about a specific publication from Europe PMC",
  parameters: z.object({
    orcid_id: z.string().describe("The ORCID identifier of the researcher"),
    publication_index: z.number().describe("The index of the publication in the search results (0-based)"),
  }),
  execute: async (args) => {
    try {
      const publications = await getEpmcPublicationsByOrcid(args.orcid_id, 100);
      if (args.publication_index >= publications.length) {
        return `Error: Publication index ${args.publication_index} is out of range. Found ${publications.length} publications.`;
      }
      return JSON.stringify(publications[args.publication_index], null, 2);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// NIH Reporter Tools
server.addTool({
  name: "search_nih_grants_by_pi_name",
  description: "Search for NIH grants by principal investigator name",
  parameters: z.object({
    pi_name: z.string().describe("Name of the principal investigator"),
    max_results: z.number().default(20).describe("Maximum number of results to return"),
  }),
  execute: async (args) => {
    try {
      const grants = await getNIHGrantsByPIName(args.pi_name, args.max_results);
      return JSON.stringify(grants, null, 2);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

server.addTool({
  name: "search_nih_grants_by_organization",
  description: "Search for NIH grants by organization name",
  parameters: z.object({
    org_name: z.string().describe("Name of the organization"),
    max_results: z.number().default(20).describe("Maximum number of results to return"),
  }),
  execute: async (args) => {
    try {
      const grants = await getNIHGrantsByOrganization(args.org_name, args.max_results);
      return JSON.stringify(grants, null, 2);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

server.addTool({
  name: "get_nih_grant_by_number",
  description: "Get detailed information about a specific NIH grant by project number",
  parameters: z.object({
    project_number: z.string().describe("The NIH project/grant number"),
  }),
  execute: async (args) => {
    try {
      const grant = await getNIHGrantByNumber(args.project_number);
      if (!grant) {
        return `Error: Grant ${args.project_number} not found.`;
      }
      return JSON.stringify(grant, null, 2);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// ORCID Tools
server.addTool({
  name: "get_orcid_profile",
  description: "Get comprehensive researcher profile from ORCID including publications, employment, and education",
  parameters: z.object({
    orcid_id: z.string().describe("The ORCID identifier of the researcher"),
  }),
  execute: async (args) => {
    try {
      const profile = await getOrcidProfile(args.orcid_id);
      return JSON.stringify(profile, null, 2);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// Google Maps Tools
server.addTool({
  name: "get_coordinates",
  description: "Get latitude and longitude coordinates for an address using Google Maps Geocoding API",
  parameters: z.object({
    address: z.string().describe("The address to geocode"),
  }),
  execute: async (args) => {
    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return "Error: GOOGLE_MAPS_API_KEY environment variable is not set.";
      }
      const service = new GoogleMapsService(apiKey);
      const result = await service.getCoordinates(args.address);
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

server.addTool({
  name: "calculate_distance",
  description: "Calculate distance between two addresses using Google Maps Distance Matrix API",
  parameters: z.object({
    origin_address: z.string().describe("The starting address"),
    destination_address: z.string().describe("The destination address"),
  }),
  execute: async (args) => {
    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return "Error: GOOGLE_MAPS_API_KEY environment variable is not set.";
      }
      const service = new GoogleMapsService(apiKey);
      const result = await service.calculateDistance(args.origin_address, args.destination_address);
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// Consolidated Screening List Tool
server.addTool({
  name: "search_screening_list",
  description: "Search the U.S. Consolidated Screening List for sanctioned entities, denied parties, and other restricted organizations",
  parameters: z.object({
    name: z.string().optional().describe("Name of person or entity to search for"),
    countries: z.string().optional().describe("Comma-separated list of country codes (e.g., 'RU,CN')"),
    city: z.string().optional().describe("City name to filter results"),
    state: z.string().optional().describe("State or province to filter results"),
  }),
  execute: async (args) => {
    try {
      const apiKey = process.env.CONSOLIDATED_SCREENING_LIST_API_KEY;
      if (!apiKey) {
        return "Error: CONSOLIDATED_SCREENING_LIST_API_KEY environment variable is not set.";
      }
      const service = new ScreeningListService(apiKey);
      const result = await service.search(args);
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// Start the server
const transportType = process.argv.includes("--http") ? "httpStream" : "stdio";

if (transportType === "httpStream") {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
  server.start({
    transportType: "httpStream",
    httpStream: {
      port: PORT,
      endpoint: "/mcp",
    },
  });
  console.log(`RoseScout MCP server running at http://localhost:${PORT}/mcp`);
  console.log(`SSE endpoint available at http://localhost:${PORT}/sse`);
} else {
  server.start({
    transportType: "stdio",
  });
  console.error("RoseScout MCP server started in stdio mode");
}
