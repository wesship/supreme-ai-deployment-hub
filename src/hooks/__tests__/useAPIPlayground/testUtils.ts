
import { vi, beforeEach } from 'vitest';

// NOTE: vi.mock for '@/hooks/use-toast' must be declared in each test file
// that needs it (for proper hoisting). Do NOT declare it here.

// Setup mock fetch
export const setupMockFetch = () => {
  // Mock fetch
  global.fetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockClear();
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
export const createErrorResponseMock = (status = 400, statusText = 'Bad Request', data: any = { error: 'Error' }) => ({
  json: vi.fn().mockResolvedValue(data),
  text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  ok: false,
  status,
  statusText
});
