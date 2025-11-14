// ORCID API integration service
// Based on the Python implementation in code-samples/orcid/

export interface OrcidConfig {
  apiKey?: string;
  timeout: number;
  baseUrl: string;
}

export const defaultOrcidConfig: OrcidConfig = {
  timeout: 30000,
  baseUrl: "https://pub.orcid.org/v3.0",
};

export interface OrcidName {
  givenNames?: string;
  familyName?: string;
  creditName?: string;
}

export interface OrcidEmail {
  email: string;
  verified: boolean;
  primary: boolean;
}

export interface OrcidExternalId {
  name: string;
  value?: string;
  url?: string;
  source?: string;
}

export interface OrcidUrl {
  name?: string;
  url: string;
}

export interface OrcidKeyword {
  content: string;
  source?: string;
}

export interface OrcidOtherName {
  content: string;
  source?: string;
}

export interface OrcidOrganizationAddress {
  city?: string;
  region?: string;
  country?: string;
}

export interface OrcidOrganization {
  name: string;
  address?: OrcidOrganizationAddress;
  disambiguationSource?: string;
}

export interface OrcidAffiliation {
  organization: OrcidOrganization;
  departmentName?: string;
  roleTitle?: string;
  startDate?: any;
  endDate?: any;
  sourceName?: string;
}

export interface OrcidWorkSummary {
  title?: string;
  type?: string;
  publicationDate?: any;
  journalTitle?: string;
  url?: string;
  source?: string;
}

export interface OrcidWorkExternalId {
  name: string;
  value?: string;
  url?: string;
  source?: string;
}

export interface OrcidWork {
  workSummaries: OrcidWorkSummary[];
  externalIds: OrcidWorkExternalId[];
}

export interface OrcidWorks {
  works: OrcidWork[];
}

export interface OrcidProfile {
  name: OrcidName;
  biography?: string;
  keywords: OrcidKeyword[];
  otherNames: OrcidOtherName[];
  emails: OrcidEmail[];
  externalIds: OrcidExternalId[];
  researcherUrls: OrcidUrl[];
  lastModified?: Date;
}

export interface CustomerProfile {
  researcherId: {
    orcid?: string;
    givenName?: string;
    familyName?: string;
    creditName?: string;
    emails: Array<{ address: string; primary: boolean }>;
  };
  description: {
    sections: Array<{ title: string; content: string }>;
  };
  externalReferences: Array<{ url?: string; name?: string; source?: string }>;
  educations: OrcidAffiliation[];
  employments: OrcidAffiliation[];
  publications: Array<{
    title?: string;
    publicationDate?: Date;
    journalName?: string;
    source?: string;
    doi?: string;
  }>;
}

class OrcidAPIError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'OrcidAPIError';
  }
}

class OrcidNotFoundError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'OrcidNotFoundError';
  }
}

class OrcidValidationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'OrcidValidationError';
  }
}

export async function fetchOrcidData(
  orcidId: string,
  endpoint: string,
  config: OrcidConfig = defaultOrcidConfig
): Promise<any> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.orcid+json'
  };
  
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const response = await fetch(`${config.baseUrl}/${orcidId}/${endpoint}`, {
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        throw new OrcidNotFoundError(
          "The requested researcher profile could not be found. Please verify the ORCID ID is correct.",
          { orcidId, endpoint }
        );
      }
      throw new OrcidAPIError(
        `Failed to fetch ${endpoint} data`,
        { orcidId, endpoint, status: response.status, statusText: response.statusText }
      );
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof OrcidAPIError || error instanceof OrcidNotFoundError) {
      throw error;
    }
    throw new OrcidAPIError(
      `Failed to fetch ${endpoint} data`,
      { orcidId, error: error instanceof Error ? error.message : String(error) }
    );
  }
}

export function parseAffiliations(data: any): OrcidAffiliation[] {
  const affiliations: OrcidAffiliation[] = [];
  
  if (!data || !data['affiliation-group']) {
    return affiliations;
  }

  for (const group of data['affiliation-group']) {
    const summaries = group.summaries || [];
    for (const summary of summaries) {
      let affiliationData = null;
      
      if (summary['education-summary']) {
        affiliationData = summary['education-summary'];
      } else if (summary['employment-summary']) {
        affiliationData = summary['employment-summary'];
      }
      
      if (affiliationData) {
        const affiliation: OrcidAffiliation = {
          organization: {
            name: affiliationData.organization?.name || '',
            address: affiliationData.organization?.address ? {
              city: affiliationData.organization.address.city?.value,
              region: affiliationData.organization.address.region?.value,
              country: affiliationData.organization.address.country?.value,
            } : undefined,
            disambiguationSource: affiliationData.organization?.['disambiguated-organization']?.['disambiguation-source']
          },
          departmentName: affiliationData['department-name'],
          roleTitle: affiliationData['role-title'],
          startDate: affiliationData['start-date'],
          endDate: affiliationData['end-date'],
          sourceName: affiliationData.source?.['source-name']?.value
        };
        
        affiliations.push(affiliation);
      }
    }
  }
  
  return affiliations;
}

function parseOrcidProfile(personData: any): OrcidProfile {
  const profile: OrcidProfile = {
    name: {
      givenNames: personData.name?.['given-names']?.value,
      familyName: personData.name?.['family-name']?.value,
      creditName: personData.name?.['credit-name']?.value
    },
    biography: personData.biography?.content,
    keywords: (personData.keywords?.keyword || []).map((k: any) => ({
      content: k.content,
      source: k.source?.['source-name']?.value
    })),
    otherNames: (personData['other-names']?.['other-name'] || []).map((n: any) => ({
      content: n.content,
      source: n.source?.['source-name']?.value
    })),
    emails: (personData.emails?.email || []).map((e: any) => ({
      email: e.email,
      verified: e.verified || false,
      primary: e.primary || false
    })),
    externalIds: (personData['external-identifiers']?.['external-identifier'] || []).map((id: any) => ({
      name: id['external-id-type'],
      value: id['external-id-value']?.value,
      url: id['external-id-url']?.value,
      source: id.source?.['source-name']?.value
    })),
    researcherUrls: (personData['researcher-urls']?.['researcher-url'] || []).map((url: any) => ({
      name: url['url-name'],
      url: url.url?.value
    })),
    lastModified: personData['last-modified-date']?.value ? new Date(personData['last-modified-date'].value) : undefined
  };
  
  return profile;
}

function parseOrcidWorks(worksData: any): OrcidWorks {
  const works: OrcidWork[] = [];
  
  if (!worksData || !worksData.group) {
    return { works };
  }

  for (const group of worksData.group) {
    const workSummaries = (group['work-summary'] || []).map((summary: any) => ({
      title: summary.title?.title?.value,
      type: summary.type,
      publicationDate: summary['publication-date'],
      journalTitle: summary['journal-title']?.value,
      url: summary.url?.value,
      source: summary.source?.['source-name']?.value
    }));

    const externalIds = (group['external-ids']?.['external-id'] || []).map((id: any) => ({
      name: id['external-id-type'],
      value: id['external-id-value'],
      url: id['external-id-url']?.value,
      source: id.source?.['source-name']?.value
    }));

    works.push({
      workSummaries,
      externalIds
    });
  }
  
  return { works };
}

function parseDate(dateObj: any): Date | undefined {
  if (!dateObj) return undefined;
  
  const year = dateObj.year?.value;
  const month = dateObj.month?.value || 1;
  const day = dateObj.day?.value || 1;
  
  if (year) {
    return new Date(year, month - 1, day);
  }
  
  return undefined;
}

function createCustomerProfile(
  orcidProfile: OrcidProfile,
  orcidId: string,
  educations: OrcidAffiliation[],
  employments: OrcidAffiliation[],
  works: OrcidWorks
): CustomerProfile {
  // Sort emails by primary and verified status
  const sortedEmails = [...orcidProfile.emails].sort((a, b) => {
    if (a.primary && !b.primary) return -1;
    if (!a.primary && b.primary) return 1;
    if (a.verified && !b.verified) return -1;
    if (!a.verified && b.verified) return 1;
    return 0;
  });

  const profile: CustomerProfile = {
    researcherId: {
      orcid: orcidId,
      givenName: orcidProfile.name.givenNames,
      familyName: orcidProfile.name.familyName,
      creditName: orcidProfile.name.creditName,
      emails: sortedEmails.map(email => ({
        address: email.email,
        primary: email.primary
      }))
    },
    description: {
      sections: []
    },
    externalReferences: [],
    educations: educations,
    employments: employments,
    publications: []
  };

  // Add biography to description
  if (orcidProfile.biography) {
    profile.description.sections.push({
      title: "ORCID Profile Biography",
      content: orcidProfile.biography
    });
  }

  // Add keywords to description
  if (orcidProfile.keywords.length > 0) {
    profile.description.sections.push({
      title: "ORCID Profile Keywords",
      content: orcidProfile.keywords.map(k => k.content).join(", ")
    });
  }

  // Add external references
  for (const extId of orcidProfile.externalIds) {
    profile.externalReferences.push({
      url: extId.url,
      name: extId.name,
      source: extId.source
    });
  }

  for (const url of orcidProfile.researcherUrls) {
    profile.externalReferences.push({
      url: url.url,
      name: url.name,
      source: "ORCID Profile"
    });
  }

  // Add publications from works
  for (const work of works.works) {
    const summaries = work.workSummaries;
    
    const title = summaries.find(s => s.title)?.title;
    const pubDate = summaries.find(s => s.publicationDate)?.publicationDate;
    const journal = summaries.find(s => s.journalTitle)?.journalTitle;
    const sources = summaries.filter(s => s.source).map(s => s.source);
    
    // Find DOI from external IDs
    const doi = work.externalIds.find(id => id.name === 'doi')?.value;
    
    if (title) {
      profile.publications.push({
        title,
        publicationDate: parseDate(pubDate),
        journalName: journal,
        source: sources.length > 0 ? sources.join(", ") : undefined,
        doi
      });
    }
  }

  return profile;
}

export async function getOrcidProfile(
  orcidId: string,
  config: OrcidConfig = defaultOrcidConfig
): Promise<CustomerProfile> {
  try {
    // Fetch all required data
    const [personData, worksData, educationData, employmentData] = await Promise.all([
      fetchOrcidData(orcidId, "person", config),
      fetchOrcidData(orcidId, "works", config),
      fetchOrcidData(orcidId, "educations", config),
      fetchOrcidData(orcidId, "employments", config)
    ]);

    if (!personData) {
      throw new OrcidAPIError(
        "No person data found",
        { orcidId }
      );
    }

    try {
      const orcidProfile = parseOrcidProfile(personData);
      const orcidWorks = parseOrcidWorks(worksData);
      const educations = parseAffiliations(educationData);
      const employments = parseAffiliations(employmentData);
      
      const profile = createCustomerProfile(
        orcidProfile,
        orcidId,
        educations,
        employments,
        orcidWorks
      );
      
      return profile;
      
    } catch (error) {
      throw new OrcidValidationError(
        "Failed to validate ORCID data",
        {
          orcidId,
          error: error instanceof Error ? error.message : String(error),
          rawData: {
            person: personData,
            works: worksData,
            education: educationData,
            employment: employmentData
          }
        }
      );
    }
    
  } catch (error) {
    if (error instanceof OrcidAPIError || error instanceof OrcidNotFoundError || error instanceof OrcidValidationError) {
      throw error;
    }
    throw new OrcidAPIError(
      "Failed to process author metadata",
      {
        orcidId,
        error: error instanceof Error ? error.message : String(error)
      }
    );
  }
}