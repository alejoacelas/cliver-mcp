import { z } from "zod";

// Configuration
export interface NIHConfig {
  apiKey?: string;
  timeout: number;
  baseUrl: string;
}

export const defaultNIHConfig: NIHConfig = {
  timeout: 30000,
  baseUrl: "https://api.reporter.nih.gov/v2"
};

// Schema definitions for NIH API responses
const NIHPrincipalInvestigatorSchema = z.object({
  profile_id: z.number().optional(),
  first_name: z.string().optional(),
  middle_name: z.string().optional(),
  last_name: z.string().optional(),
  full_name: z.string().optional(),
  title: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  is_contact_pi: z.boolean().optional(),
});

const NIHOrganizationSchema = z.object({
  org_name: z.string().optional(),
  org_city: z.string().optional(),
  org_state: z.string().optional(),
  org_country: z.string().optional(),
  org_zipcode: z.string().optional(),
  org_duns: z.union([z.string(), z.array(z.string())]).optional(), // Can be string or array
  org_fips: z.string().optional(),
  dept_type: z.string().optional().nullable(), // Can be null
  org_department: z.string().optional(),
});

const NIHAgencySchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  abbreviation: z.string().optional(),
});

const NIHProjectSchema = z.object({
  appl_id: z.number().optional(),
  project_num: z.string(),
  project_serial_num: z.string().optional(),
  project_title: z.string().optional(),
  project_start_date: z.string().optional(),
  project_end_date: z.string().optional(),
  budget_start: z.string().optional(),
  budget_end: z.string().optional(),
  fiscal_year: z.number().optional(),
  award_amount: z.number().optional().nullable(), // Can be null
  award_notice_date: z.string().optional(),
  is_active: z.boolean().optional(),
  project_num_split: z.object({
    appl_type_code: z.string().optional(),
    activity_code: z.string().optional(),
    ic_code: z.string().optional(),
    serial_num: z.string().optional(),
    support_year: z.string().optional(),
  }).optional(),
  principal_investigators: z.array(NIHPrincipalInvestigatorSchema).optional(),
  contact_pi_name: z.string().optional(),
  other_pi_names: z.array(z.string()).optional(),
  organization: NIHOrganizationSchema.optional(),
  agency_ic_admin: NIHAgencySchema.optional(),
  agency_ic_fundings: z.array(NIHAgencySchema).optional().nullable(), // Can be null
  cong_dist: z.string().optional(),
  project_terms: z.string().optional(),
  pref_terms: z.string().optional().nullable(), // Can be null
  abstract_text: z.string().optional(),
  phr_text: z.string().optional().nullable(), // Can be null
  spending_cats: z.array(z.object({
    code: z.string().optional(),
    name: z.string().optional(),
  })).optional(),
  covid_response: z.array(z.string()).optional().nullable(), // Can be null
  arra_funded: z.string().optional(),
  is_new: z.boolean().optional(),
  mechanism_code_dc: z.string().optional(),
  core_project_num: z.string().optional(),
  full_study_section: z.object({
    srgCode: z.string().optional(),
    srgFlex: z.string().optional(),
    srgName: z.string().optional(),
  }).optional(),
  subproject_id: z.union([z.number(), z.string()]).optional().nullable(), // Can be number, string, or null
  total_cost: z.number().optional(),
  total_cost_sub_project: z.number().optional(),
});

const NIHSearchResponseSchema = z.object({
  meta: z.object({
    search_id: z.string().optional(),
    total: z.number(),
    offset: z.number(),
    limit: z.number(),
    sort_field: z.string().optional().nullable(), // Can be null
    sort_order: z.string().optional().nullable(), // Can be null
  }),
  results: z.array(NIHProjectSchema),
});

export type NIHProject = z.infer<typeof NIHProjectSchema>;
export type NIHSearchResponse = z.infer<typeof NIHSearchResponseSchema>;

// Grant Record for standardized output
export interface GrantRecord {
  id: string;
  title?: string;
  funder?: string;
  year?: number;
  amount?: number;
  currency?: string;
  start_date?: string;
  end_date?: string;
  recipient?: string;
  principal_investigators: Array<{
    given_name?: string;
    family_name?: string;
    credit_name?: string;
  }>;
  abstract?: string;
  keywords: string[];
  description?: string;
  is_active?: boolean;
  award_type?: string;
}

// Helper function to convert NIH project to GrantRecord
function convertNIHProjectToGrantRecord(project: NIHProject): GrantRecord {
  const principal_investigators = [];
  
  if (project.principal_investigators) {
    for (const pi of project.principal_investigators) {
      principal_investigators.push({
        given_name: pi.first_name,
        family_name: pi.last_name,
        credit_name: pi.full_name
      });
    }
  } else if (project.contact_pi_name) {
    const nameParts = project.contact_pi_name.split(',', 2);
    if (nameParts.length === 2) {
      principal_investigators.push({
        given_name: nameParts[1].trim(),
        family_name: nameParts[0].trim(),
        credit_name: project.contact_pi_name
      });
    } else {
      principal_investigators.push({
        given_name: "",
        family_name: project.contact_pi_name,
        credit_name: project.contact_pi_name
      });
    }
  }

  const org = project.organization;
  const recipientParts = [];
  if (org?.org_name) recipientParts.push(org.org_name);
  if (org?.org_department) recipientParts.push(org.org_department);
  if (org?.org_country) recipientParts.push(org.org_country);
  
  const keywords = project.pref_terms 
    ? project.pref_terms.split(';').map(term => term.trim()).filter(term => term)
    : [];

  return {
    id: project.project_num,
    title: project.project_title,
    funder: project.agency_ic_admin?.name || 'NIH',
    year: project.fiscal_year,
    amount: project.award_amount || undefined,
    currency: "USD",
    start_date: project.project_start_date,
    end_date: project.project_end_date,
    recipient: recipientParts.join(", ") || undefined,
    principal_investigators,
    abstract: project.abstract_text,
    keywords,
    description: project.phr_text ? `### Public Health Relevance: \n${project.phr_text}` : undefined,
    is_active: project.is_active,
    award_type: project.mechanism_code_dc || 'research'
  };
}

// Core API functions
async function fetchNIHData(
  payload: any,
  endpoint: string = 'projects/search',
  config: NIHConfig = defaultNIHConfig
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const response = await fetch(`${config.baseUrl}/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw new Error(`Failed to fetch ${endpoint} data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function getNIHGrantsByPIName(
  piName: string,
  maxResults: number = 20,
  config: NIHConfig = defaultNIHConfig
): Promise<GrantRecord[]> {
  const payload = {
    criteria: {
      pi_names: [{ any_name: piName }],
      advanced_text_search: {
        operator: "AND",
        search_field: "all",
        search_text: piName
      }
    },
    limit: maxResults,
    offset: 0,
    sort_field: "project_start_date",
    sort_order: "desc"
  };

  const rawData = await fetchNIHData(payload, 'projects/search', config);
  if (!rawData) return [];

  const response = NIHSearchResponseSchema.parse(rawData);
  
  return response.results.map(project => convertNIHProjectToGrantRecord(project));
}

export async function getNIHGrantsByOrganization(
  orgName: string,
  maxResults: number = 20,
  config: NIHConfig = defaultNIHConfig
): Promise<GrantRecord[]> {
  const payload = {
    criteria: {
      org_names: [orgName],
      advanced_text_search: {
        operator: "AND",
        search_field: "all",
        search_text: orgName
      }
    },
    limit: maxResults,
    offset: 0,
    sort_field: "project_start_date",
    sort_order: "desc"
  };

  const rawData = await fetchNIHData(payload, 'projects/search', config);
  if (!rawData) return [];

  const response = NIHSearchResponseSchema.parse(rawData);
  
  return response.results.map(project => convertNIHProjectToGrantRecord(project));
}

export async function getNIHGrantByNumber(
  projectNumber: string,
  config: NIHConfig = defaultNIHConfig
): Promise<GrantRecord | null> {
  if (!projectNumber || !projectNumber.trim()) {
    return null;
  }

  const payload = {
    criteria: {
      project_nums: [projectNumber.trim()]
    },
    limit: 1,
    offset: 0
  };

  const rawData = await fetchNIHData(payload, 'projects/search', config);
  if (!rawData) return null;

  const response = NIHSearchResponseSchema.parse(rawData);
  
  if (!response.results || response.results.length === 0) {
    return null;
  }

  return convertNIHProjectToGrantRecord(response.results[0]);
}