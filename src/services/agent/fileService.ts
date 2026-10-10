
import { apiClient, handleServiceError } from '../config';

export const AgentFileService = {
  // Upload a task file
  uploadTaskFile: async (file: File, token: string) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await apiClient.post('/upload-task-file', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      return handleServiceError(error, 'Error uploading task file');
    }
  }
};
