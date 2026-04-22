
import { renderHook, act } from '@testing-library/react';
const waitForNextUpdate = async () => new Promise((r) => setTimeout(r, 0));
import { useAPIPlayground } from '../../useAPIPlayground';
import { toast } from 'sonner';
import { setupMockFetch, createSuccessResponseMock } from './testUtils';

setupMockFetch();

describe('useAPIPlayground request handling', () => {
  it('should send a GET request successfully', async () => {
    const mockResponse = createSuccessResponseMock();
    (global.fetch as jest.Mock).mockReturnValue(Promise.resolve(mockResponse));
    
    const { result, waitForNextUpdate } = renderHook(() => useAPIPlayground());
    
    act(() => {
      result.current.setEndpoint('https://api.test.com');
    });
    
    act(() => {
      result.current.sendRequest();
    });
    
    await waitForNextUpdate();
    
    expect(global.fetch).toHaveBeenCalledWith('https://api.test.com', expect.any(Object));
    expect(result.current.state.response).toContain('success');
    expect(result.current.state.status).toContain('200');
    expect(toast.success).toHaveBeenCalled();
  });

  it('should handle fetch errors', async () => {
    (global.fetch as jest.Mock).mockReturnValue(Promise.reject(new Error('Network error')));
    
    const { result, waitForNextUpdate } = renderHook(() => useAPIPlayground());
    
    act(() => {
      result.current.setEndpoint('https://api.test.com');
    });
    
    act(() => {
      result.current.sendRequest();
    });
    
    await waitForNextUpdate();
    
    expect(result.current.state.status).toBe('Request failed');
    expect(result.current.state.response).toContain('Network error');
    expect(toast.error).toHaveBeenCalled();
  });
});
