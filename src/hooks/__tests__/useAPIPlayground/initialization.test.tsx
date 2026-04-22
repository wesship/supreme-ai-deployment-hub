
import { renderHook, act } from '@testing-library/react';
import { useAPIPlayground } from '../../useAPIPlayground';
import { setupMockFetch } from './testUtils';

setupMockFetch();

describe('useAPIPlayground initialization and state updates', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useAPIPlayground());
    
    expect(result.current.state).toEqual({
      selectedAPI: '',
      method: 'GET',
      endpoint: '',
      requestBody: '',
      headers: '{\n  "Content-Type": "application/json"\n}',
      response: '',
      status: '',
      loading: false,
    });
  });

  it('should update state when selecting an API', () => {
    const { result } = renderHook(() => useAPIPlayground());
    
    act(() => {
      result.current.handleSelectAPI('Test API', 'https://api.test.com', 'test-api-key');
    });
    
    expect(result.current.state.selectedAPI).toBe('Test API');
    expect(result.current.state.endpoint).toBe('https://api.test.com');
    expect(result.current.state.headers).toContain('test-api-key');
  });

  it('should update method state', () => {
    const { result } = renderHook(() => useAPIPlayground());
    
    act(() => {
      result.current.setMethod('POST');
    });
    
    expect(result.current.state.method).toBe('POST');
  });

  it('should update endpoint state', () => {
    const { result } = renderHook(() => useAPIPlayground());
    
    act(() => {
      result.current.setEndpoint('https://new-endpoint.com');
    });
    
    expect(result.current.state.endpoint).toBe('https://new-endpoint.com');
  });

  it('should update request body', () => {
    const { result } = renderHook(() => useAPIPlayground());
    
    act(() => {
      result.current.setRequestBody('{"test": "value"}');
    });
    
    expect(result.current.state.requestBody).toBe('{"test": "value"}');
  });

  it('should update headers', () => {
    const { result } = renderHook(() => useAPIPlayground());
    
    act(() => {
      result.current.setHeaders('{"Authorization": "Bearer token"}');
    });
    
    expect(result.current.state.headers).toBe('{"Authorization": "Bearer token"}');
  });
});
