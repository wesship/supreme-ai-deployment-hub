import axios from 'axios';

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const defaultApiUrl = import.meta.env.PROD
  ? 'https://api.d3vonn.io'
  : 'http://localhost:8000';

// Keep one canonical origin-only API base. Individual services own their /api paths.
export const API_BASE_URL = (configuredApiUrl || defaultApiUrl).replace(/\/+$/, '');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30_000,
});

export const handleServiceError = (error: unknown, message: string): never => {
  if (axios.isAxiosError(error)) {
    console.error(`${message}:`, error.response?.data || error.message);
  } else {
    console.error(`${message}:`, error);
  }
  throw error;
};
