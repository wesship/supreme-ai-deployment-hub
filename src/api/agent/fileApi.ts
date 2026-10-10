
import { apiClient, handleApiError } from "../config";

// File upload operations
export const fileApi = {
  // Upload a task file
  uploadTaskFile: async (file: File, token: string): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const response = await apiClient.post("/upload-task-file", formData, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    } catch (error) {
      return handleApiError(error, "Error uploading task file");
    }
  }
};
