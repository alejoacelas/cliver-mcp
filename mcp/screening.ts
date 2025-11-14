/**
 * Consolidated Screening List API integration service
 */

export interface ScreeningSearchParams {
  name?: string;
  countries?: string;
  city?: string;
  state?: string;
}

export interface ScreeningResult {
  total: number;
  results: ScreeningEntity[];
  sources?: Array<{
    value: string;
    count: number;
  }>;
}

export interface ScreeningEntity {
  name: string;
  alt_names?: string[];
  addresses?: Address[];
  source?: string;
  source_list_url?: string;
  source_information_url?: string;
  federal_register_notice?: string;
  start_date?: string;
  end_date?: string;
  standard_order?: string;
  license_requirement?: string;
  license_policy?: string;
  call_sign?: string;
  vessel_type?: string;
  gross_tonnage?: string;
  gross_registered_tonnage?: string;
  vessel_flag?: string;
  vessel_owner?: string;
  remarks?: string;
  title?: string;
  programs?: string[];
  ids?: EntityId[];
}

export interface Address {
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export interface EntityId {
  type?: string;
  number?: string;
  country?: string;
}

export class ScreeningListError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScreeningListError';
  }
}

export class ScreeningListService {
  private apiKey: string;
  private baseUrl = 'https://data.trade.gov/consolidated_screening_list/v1';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new ScreeningListError('Consolidated Screening List API key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Search the Consolidated Screening List
   */
  async search(params: ScreeningSearchParams): Promise<ScreeningResult> {
    try {
      const searchParams = new URLSearchParams({
        'subscription-key': this.apiKey
      });

      if (params.name) {
        searchParams.append('name', params.name);
      }
      if (params.countries) {
        searchParams.append('countries', params.countries);
      }
      if (params.city) {
        searchParams.append('city', params.city);
      }
      if (params.state) {
        searchParams.append('state', params.state);
      }

      const url = `${this.baseUrl}/search?${searchParams.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MCP-RoseScout/1.0'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ScreeningListError(`API returned status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data as ScreeningResult;
    } catch (error) {
      if (error instanceof ScreeningListError) {
        throw error;
      }
      throw new ScreeningListError(`Failed to search screening list: ${error}`);
    }
  }
}