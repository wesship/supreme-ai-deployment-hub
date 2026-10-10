
export interface APIConfig {
  name: string;
  endpoint: string;
  apiKey?: string;
  description: string;
  isConnected: boolean;
  lastConnected?: Date;
}

export type NewAPIConfig = Omit<APIConfig, 'isConnected' | 'lastConnected'>;

export interface SavedAPIResponse {
  id: string;
  timestamp: Date;
  apiName: string;
  method: string;
  endpoint: string;
  status: string;
  response: string;
}
