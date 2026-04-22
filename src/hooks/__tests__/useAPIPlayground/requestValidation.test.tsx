
import { renderHook, act } from '@testing-library/react';
import { useAPIPlayground } from '../../useAPIPlayground';
import { toast } from 'sonner';
import { setupMockFetch } from './testUtils';

setupMockFetch();

describe('useAPIPlayground request validation', () => {
  it('should validate request body JSON for non-GET requests', async () => {
    const { result } = renderHook(() => useAPIPlayground());
    
    act(() => {
      result.current.setMethod('POST');
      result.current.setEndpoint('https://api.test.com');
      result.current.setRequestBody('invalid json');
    });
    
    act(() => {
      result.current.sendRequest();
    });
    
    expect(toast.error).toHaveBeenCalledWith('Invalid request body JSON format');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should validate headers JSON', async () => {
    const { result } = renderHook(() => useAPIPlayground());
    
    act(() => {
      result.current.setEndpoint('https://api.test.com');
      result.current.setHeaders('invalid json');
    });
    
    act(() => {
      result.current.sendRequest();
    });
    
    expect(toast.error).toHaveBeenCalledWith('Invalid headers JSON format');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
