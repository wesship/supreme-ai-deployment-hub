
import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';

// Must be hoisted before other imports
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
  _registerToast: vi.fn(),
}));

import { useAPIPlayground } from '../../useAPIPlayground';
import { setupMockFetch } from './testUtils';
import { toast } from '@/hooks/use-toast';
const mockToast = toast as ReturnType<typeof vi.fn>;

setupMockFetch();

describe('useAPIPlayground request validation', () => {
  it('should validate request body JSON for non-GET requests', async () => {
    const { result } = renderHook(() => useAPIPlayground());

    act(() => {
      result.current.setMethod('POST');
      result.current.setEndpoint('https://api.test.com');
      result.current.setRequestBody('invalid json');
    });

    await act(async () => {
      await result.current.sendRequest();
    });

    // Toast should be called with validation error
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Invalid request body JSON format',
      })
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should validate headers JSON', async () => {
    const { result } = renderHook(() => useAPIPlayground());

    act(() => {
      result.current.setEndpoint('https://api.test.com');
      result.current.setHeaders('invalid json');
    });

    await act(async () => {
      await result.current.sendRequest();
    });

    // Toast should be called with validation error
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Invalid headers JSON format',
      })
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
