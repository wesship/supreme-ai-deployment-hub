import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useAPIPlayground } from '../../useAPIPlayground';
import { setupMockFetch, createSuccessResponseMock, mockToast } from './testUtils';

setupMockFetch();

describe('useAPIPlayground request handling', () => {
  it('should send a GET request successfully', async () => {
    const mockResponse = createSuccessResponseMock();
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

    const { result } = renderHook(() => useAPIPlayground());

    act(() => {
      result.current.setEndpoint('https://api.test.com');
    });

    await act(async () => {
      await result.current.sendRequest();
    });

    expect(global.fetch).toHaveBeenCalledWith('https://api.test.com', expect.any(Object));
    expect(result.current.state.response).toContain('success');
    expect(result.current.state.status).toContain('200');
    expect(mockToast).toHaveBeenCalled();
  });

  it('should handle fetch errors', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAPIPlayground());

    act(() => {
      result.current.setEndpoint('https://api.test.com');
    });

    await act(async () => {
      await result.current.sendRequest();
    });

    expect(result.current.state.status).toBe('Request failed');
    expect(result.current.state.response).toContain('Network error');
    expect(mockToast).toHaveBeenCalled();
  });
});
