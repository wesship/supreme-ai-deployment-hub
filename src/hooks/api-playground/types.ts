
export interface APIPlaygroundState {
  selectedAPI: string;
  method: string;
  endpoint: string;
  requestBody: string;
  headers: string;
  response: string;
  status: string;
  loading: boolean;
}

export interface UseAPIPlaygroundProps {
  onSaveResponse?: (
    apiName: string,
    method: string,
    endpoint: string,
    status: string,
    response: string
  ) => void;
}
