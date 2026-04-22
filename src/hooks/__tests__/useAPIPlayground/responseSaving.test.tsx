
import { renderHook, act } from '@testing-library/react';
import { useAPIPlayground } from '../../useAPIPlayground';
import { toast } from 'sonner';
import { setupMockFetch } from './testUtils';

setupMockFetch();

describe('useAPIPlayground response saving', () => {
  it('should handle response saving', () => {
    const saveResponseMock = jest.fn();
    const { result } = renderHook(() => useAPIPlayground({ 
      onSaveResponse: saveResponseMock 
    }));
    
    // Setup state for a valid response
    act(() => {
      result.current.handleSelectAPI('Test API', 'https://api.test.com');
      result.current.setMethod('GET');
      // Manually update the response and status
      result.current.state.response = '{"data": "test"}';
      result.current.state.status = '200 OK';
    });
    
    act(() => {
      result.current.handleSaveResponse();
    });
    
    expect(saveResponseMock).toHaveBeenCalledWith(
      'Test API',
      'GET',
      'https://api.test.com',
      '200 OK',
      '{"data": "test"}'
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it('should show error toast when trying to save without a response', () => {
    const { result } = renderHook(() => useAPIPlayground());
    
    act(() => {
      result.current.handleSaveResponse();
    });
    
    expect(toast.error).toHaveBeenCalledWith('No response to save');
  });
});
