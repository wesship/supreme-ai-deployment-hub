
import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';

// Mock sonner toast since useResponseHandler uses it
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

import { useAPIPlayground } from '../../useAPIPlayground';
import { setupMockFetch } from './testUtils';
import { toast as sonnerToast } from 'sonner';
const mockToastError = (sonnerToast as any).error as ReturnType<typeof vi.fn>;

setupMockFetch();

describe('useAPIPlayground response saving', () => {
  it('should show error when trying to save without a response', () => {
    const { result } = renderHook(() => useAPIPlayground());

    act(() => {
      result.current.handleSaveResponse();
    });

    // useResponseHandler calls toast.error('No response to save') from sonner
    expect(mockToastError).toHaveBeenCalledWith('No response to save');
  });

  it('should not save when no API is selected', () => {
    const saveResponseMock = vi.fn();
    const { result } = renderHook(() => useAPIPlayground({
      onSaveResponse: saveResponseMock
    }));

    act(() => {
      result.current.handleSaveResponse();
    });

    expect(saveResponseMock).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalled();
  });
});
