/**
 * Google Maps API integration service
 */

export interface CoordinatesResult {
  latitude: number;
  longitude: number;
  formatted_address: string;
  address: string;
}

export interface DistanceResult {
  origin_address: string;
  destination_address: string;
  distance_km: number;
  distance_text: string;
  duration: string;
  duration_seconds: number;
}

export class GoogleMapsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleMapsError';
  }
}

export class GoogleMapsService {
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new GoogleMapsError('Google Maps API key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Get latitude and longitude coordinates for an address
   */
  async getCoordinates(address: string): Promise<CoordinatesResult> {
    try {
      const url = `${this.baseUrl}/geocode/json?address=${encodeURIComponent(address)}&key=${this.apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json() as any;

      if (!response.ok || data.status !== 'OK') {
        throw new GoogleMapsError(`Geocoding failed: ${data.error_message || data.status}`);
      }

      if (!data.results || data.results.length === 0) {
        throw new GoogleMapsError(`No results found for address: ${address}`);
      }

      const result = data.results[0];
      const location = result.geometry.location;

      return {
        latitude: location.lat,
        longitude: location.lng,
        formatted_address: result.formatted_address,
        address: address
      };
    } catch (error) {
      if (error instanceof GoogleMapsError) {
        throw error;
      }
      throw new GoogleMapsError(`Failed to geocode address '${address}': ${error}`);
    }
  }

  /**
   * Calculate distance between two addresses
   */
  async calculateDistance(originAddress: string, destinationAddress: string): Promise<DistanceResult> {
    try {
      const url = `${this.baseUrl}/distancematrix/json?origins=${encodeURIComponent(originAddress)}&destinations=${encodeURIComponent(destinationAddress)}&units=metric&key=${this.apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json() as any;

      if (!response.ok || data.status !== 'OK') {
        throw new GoogleMapsError(`Distance calculation failed: ${data.error_message || data.status}`);
      }

      if (!data.rows || data.rows.length === 0 || !data.rows[0].elements || data.rows[0].elements.length === 0) {
        throw new GoogleMapsError(`No results found for distance calculation`);
      }

      const element = data.rows[0].elements[0];
      
      if (element.status !== 'OK') {
        throw new GoogleMapsError(`Could not calculate distance between '${originAddress}' and '${destinationAddress}': ${element.status}`);
      }

      return {
        origin_address: data.origin_addresses[0],
        destination_address: data.destination_addresses[0],
        distance_km: element.distance.value / 1000, // Convert meters to kilometers
        distance_text: element.distance.text,
        duration: element.duration.text,
        duration_seconds: element.duration.value
      };
    } catch (error) {
      if (error instanceof GoogleMapsError) {
        throw error;
      }
      throw new GoogleMapsError(`Failed to calculate distance: ${error}`);
    }
  }
}