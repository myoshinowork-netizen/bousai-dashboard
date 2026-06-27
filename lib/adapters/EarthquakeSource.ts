import type { DisasterEvent } from '../model';

export interface EarthquakeSource {
  fetchRecent(limit?: number): Promise<DisasterEvent[]>;
}
