
import { vi } from 'vitest';

// Use the global mock toast from setup.ts
const mockToast = (globalThis as any).__mockToast as ReturnType<typeof vi.fn>;

export { mockToast };

// Setup mock fetch
export const setupMockFetch = () => {
  // Mock fetch
  global.fetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockClear();
    mockToast.mockClear();
  });
};

// Create a successful response mock
export const createSuccessResponseMock = (data: any = { success: true }) => ({
  json: vi.fn().mockResolvedValue(data),
  text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  ok: true,
  status: 200,
  statusText: 'OK'
});

// Create an error response mock
export const createErrorResponseMock = (status = 400, statusText = 'Bad Request', data = { error: 'Error' }) => ({
  json: vi.fn().mockResolvedValue(data),
  text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  ok: false,
  status,
  statusText
});
