
import axios from 'axios';

// Base URL for API endpoints - update this with your actual backend URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Configure axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const backendService = {
  // Agent Management
  createAgent: async (data: any) => {
    try {
      const response = await api.post('/agents/create', data);
      return response.data;
    } catch (error) {
      console.error('Error creating agent:', error);
      throw error;
    }
  },
  
  runAgent: async (data: any) => {
    try {
      const response = await api.post('/agents/run', data);
      return response.data;
    } catch (error) {
      console.error('Error running agent:', error);
      throw error;
    }
  },
  
  // YAML Management
  validateYaml: async (yaml: string) => {
    try {
      const response = await api.post('/yaml/validate', { yaml });
      return response.data;
    } catch (error) {
      console.error('Error validating YAML:', error);
      throw error;
    }
  },
  
  // LLM Tools
  extractSkills: async (text: string) => {
    try {
      const response = await api.post('/llm/skills', { text });
      return response.data;
    } catch (error) {
      console.error('Error extracting skills:', error);
      throw error;
    }
  }
};
