import { z } from "zod";

// Configuration for Europe PMC API
export interface EpmcConfig {
  timeout: number;
  baseUrl: string;
}

export const defaultEpmcConfig: EpmcConfig = {
  timeout: 30000,
  baseUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest"
};

// Schema definitions based on the Python code
export const EpmcAuthorIdSchema = z.object({
  type: z.string().optional(),
  value: z.string().optional()
});

export const EpmcAuthorAffiliationSchema = z.object({
  affiliation: z.string().optional()
});

export const EpmcAuthorSchema = z.object({
  fullName: z.string().optional(),
  lastName: z.string().optional(),
  firstName: z.string().optional(),
  initials: z.string().optional(),
  authorId: EpmcAuthorIdSchema.optional(),
  collectiveName: z.string().optional(),
  authorAffiliationDetailsList: z.object({
    authorAffiliation: z.array(EpmcAuthorAffiliationSchema).optional()
  }).optional()
});

export const EpmcJournalSchema = z.object({
  title: z.string().optional(),
  medlineAbbreviation: z.string().optional(),
  nlmid: z.string().optional(),
  isoabbreviation: z.string().optional(),
  issn: z.string().optional(),
  essn: z.string().optional()
});

export const EpmcJournalInfoSchema = z.object({
  issue: z.string().optional(),
  volume: z.string().optional(),
  journalIssueId: z.number().optional(),
  dateOfPublication: z.string().optional(),
  monthOfPublication: z.number().optional(),
  yearOfPublication: z.number().optional(),
  printPublicationDate: z.string().optional(),
  journal: EpmcJournalSchema.optional()
});

export const EpmcGrantSchema = z.object({
  grantId: z.string().optional(),
  agency: z.string().optional(),
  acronym: z.string().optional(),
  orderIn: z.number().optional()
});

export const EpmcMeshQualifierSchema = z.object({
  abbreviation: z.string().optional(),
  qualifierName: z.string().optional(),
  majorTopic_YN: z.string().optional()
});

export const EpmcMeshHeadingSchema = z.object({
  majorTopic_YN: z.string().optional(),
  descriptorName: z.string().optional(),
  meshQualifierList: z.object({
    meshQualifier: z.array(EpmcMeshQualifierSchema).optional()
  }).optional()
});

export const EpmcFullTextUrlSchema = z.object({
  availability: z.string().optional(),
  availabilityCode: z.string().optional(),
  documentStyle: z.string().optional(),
  site: z.string().optional(),
  url: z.string().optional()
});

export const EpmcResultSchema = z.object({
  id: z.string().optional(),
  source: z.string().optional(),
  pmid: z.string().optional(),
  pmcid: z.string().optional(),
  doi: z.string().optional(),
  title: z.string().optional(),
  authorString: z.string().optional(),
  authorList: z.object({
    author: z.array(EpmcAuthorSchema).optional()
  }).optional(),
  authorIdList: z.object({
    authorId: z.array(EpmcAuthorIdSchema).optional()
  }).optional(),
  journalInfo: EpmcJournalInfoSchema.optional(),
  pubYear: z.string().optional(),
  pageInfo: z.string().optional(),
  abstractText: z.string().optional(),
  affiliation: z.string().optional(),
  language: z.string().optional(),
  pubTypeList: z.object({
    pubType: z.array(z.string()).optional()
  }).optional(),
  keywordList: z.object({
    keyword: z.array(z.string()).optional()
  }).optional(),
  grantsList: z.object({
    grant: z.array(EpmcGrantSchema).optional()
  }).optional(),
  meshHeadingList: z.object({
    meshHeading: z.array(EpmcMeshHeadingSchema).optional()
  }).optional(),
  fullTextUrlList: z.object({
    fullTextUrl: z.array(EpmcFullTextUrlSchema).optional()
  }).optional(),
  isOpenAccess: z.string().optional(),
  citedByCount: z.number().optional(),
  hasReferences: z.string().optional(),
  hasTextMinedTerms: z.string().optional(),
  firstPublicationDate: z.string().optional()
});

export const EpmcResponseSchema = z.object({
  version: z.string().optional(),
  hitCount: z.number().optional(),
  resultList: z.object({
    result: z.array(EpmcResultSchema).optional()
  }).optional()
});

export type EpmcResponse = z.infer<typeof EpmcResponseSchema>;
export type EpmcResult = z.infer<typeof EpmcResultSchema>;

// Simplified publication record for MCP output
export interface PublicationRecord {
  title: string;
  abstract?: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  publicationDate?: string;
  journalName?: string;
  journalIssn?: string;
  authors: Author[];
  source: string;
  fullTextUrl?: string;
  citationCount?: number;
  keywords: string[];
  subjects: string[];
  grants: Grant[];
  isOpenAccess?: boolean;
}

export interface Author {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  initials?: string;
  orcid?: string;
  affiliations: string[];
}

export interface Grant {
  grantId?: string;
  agency?: string;
  acronym?: string;
}

export class EpmcAPIError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'EpmcAPIError';
  }
}

export class EpmcValidationError extends Error {
  constructor(message: string, public validationError?: any, public details?: any) {
    super(message);
    this.name = 'EpmcValidationError';
  }
}

/**
 * Generic function to fetch data from Europe PMC API
 */
export async function fetchEpmcData(
  payload: Record<string, any>,
  config: EpmcConfig = defaultEpmcConfig,
  endpoint: string = 'search'
): Promise<any> {
  const url = new URL(`${config.baseUrl}/${endpoint}`);
  
  // Add query parameters
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(config.timeout)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new EpmcAPIError(
      `Failed to fetch ${endpoint} data`,
      {
        endpoint,
        params: payload,
        error: error instanceof Error ? error.message : String(error)
      }
    );
  }
}

/**
 * Parse publication data from Europe PMC API response
 */
export function parsePublications(data: any): PublicationRecord[] {
  try {
    const epmcResponse = EpmcResponseSchema.parse(data);
    return convertEpmcResponseToPublications(epmcResponse);
  } catch (error) {
    throw new EpmcValidationError(
      "Failed to validate Europe PMC publication data",
      error,
      { rawData: data }
    );
  }
}

/**
 * Convert EpmcResponse to PublicationRecord array
 */
function convertEpmcResponseToPublications(epmcResponse: EpmcResponse): PublicationRecord[] {
  if (!epmcResponse.resultList?.result) {
    return [];
  }

  const publications: PublicationRecord[] = [];

  for (const result of epmcResponse.resultList.result) {
    if (!result.title || !result.abstractText) {
      continue; // Skip publications without title or abstract
    }

    // Convert authors
    const authors: Author[] = [];
    if (result.authorList?.author) {
      for (const author of result.authorList.author) {
        if (!author.fullName) continue;

        const affiliations: string[] = [];
        if (author.authorAffiliationDetailsList?.authorAffiliation) {
          for (const affDetail of author.authorAffiliationDetailsList.authorAffiliation) {
            if (affDetail.affiliation) {
              affiliations.push(affDetail.affiliation);
            }
          }
        }

        let orcid: string | undefined;
        if (author.authorId?.type?.toUpperCase() === "ORCID" && author.authorId.value) {
          orcid = author.authorId.value;
        }

        authors.push({
          fullName: author.fullName,
          firstName: author.firstName,
          lastName: author.lastName,
          initials: author.initials,
          orcid,
          affiliations
        });
      }
    }

    // Convert grants
    const grants: Grant[] = [];
    if (result.grantsList?.grant) {
      for (const grant of result.grantsList.grant) {
        if (grant.grantId) {
          grants.push({
            grantId: grant.grantId,
            agency: grant.agency,
            acronym: grant.acronym
          });
        }
      }
    }

    // Get full text URL
    let fullTextUrl: string | undefined;
    if (result.fullTextUrlList?.fullTextUrl) {
      for (const url of result.fullTextUrlList.fullTextUrl) {
        if (url.url) {
          fullTextUrl = url.url;
          break;
        }
      }
    }

    // Prepare subjects with qualifiers
    const subjects: string[] = [];
    if (result.meshHeadingList?.meshHeading) {
      for (const mesh of result.meshHeadingList.meshHeading) {
        if (!mesh.descriptorName) continue;

        let subjectStr = mesh.descriptorName;
        
        // Add asterisk for major topics
        if (mesh.majorTopic_YN === 'Y') {
          subjectStr = `*${subjectStr}`;
        }

        // Add qualifiers
        if (mesh.meshQualifierList?.meshQualifier) {
          for (const qualifier of mesh.meshQualifierList.meshQualifier) {
            if (qualifier.qualifierName) {
              subjectStr += `/${qualifier.qualifierName}`;
            }
          }
        }

        subjects.push(subjectStr);
      }
    }

    const publication: PublicationRecord = {
      title: result.title,
      abstract: result.abstractText,
      doi: result.doi,
      pmid: result.pmid,
      pmcid: result.pmcid,
      publicationDate: result.firstPublicationDate,
      journalName: result.journalInfo?.journal?.title,
      journalIssn: result.journalInfo?.journal?.issn,
      authors,
      source: "Europe PMC",
      fullTextUrl,
      citationCount: result.citedByCount,
      keywords: result.keywordList?.keyword || [],
      subjects,
      grants,
      isOpenAccess: result.isOpenAccess === 'Y'
    };

    publications.push(publication);
  }

  return publications;
}

/**
 * Fetch and parse publications from Europe PMC using ORCID ID
 */
export async function getEpmcPublicationsByOrcid(
  orcidId: string,
  maxResults: number = 20,
  config: EpmcConfig = defaultEpmcConfig
): Promise<PublicationRecord[]> {
  try {
    const payload = {
      query: `AUTHORID:"${orcidId}"`,
      resultType: 'core',
      pageSize: maxResults,
      format: 'json'
    };

    const data = await fetchEpmcData(payload, config);
    return parsePublications(data);
  } catch (error) {
    if (error instanceof EpmcAPIError || error instanceof EpmcValidationError) {
      throw error;
    }
    throw new EpmcAPIError(
      "Failed to process publications",
      {
        orcidId,
        error: error instanceof Error ? error.message : String(error)
      }
    );
  }
}