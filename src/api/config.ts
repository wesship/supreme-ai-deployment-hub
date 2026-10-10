
import axios from "axios";

// Set base URL for API endpoints
export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Configure axios instance with defaults
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 second timeout
});

// Error handler helper
export const handleApiError = (error: unknown, customMessage: string): never => {
  if (axios.isAxiosError(error)) {
    console.error(`${customMessage}: ${error.message}`, error.response?.data);
  } else {
    console.error(`${customMessage}:`, error);
  }
  throw error;
};
