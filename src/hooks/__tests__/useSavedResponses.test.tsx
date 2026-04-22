
import { renderHook, act } from '@testing-library/react';
import { useSavedResponses } from '../useSavedResponses';
import { toast } from 'sonner';

// Mock dependencies
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn(),
  },
});

describe('useSavedResponses hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with empty saved responses', () => {
    const { result } = renderHook(() => useSavedResponses());
    
    expect(result.current.savedResponses).toEqual([]);
  });

  it('should save a new response', () => {
    const { result } = renderHook(() => useSavedResponses());
    
    act(() => {
      result.current.saveResponse(
        'Test API',
        'GET',
        'https://api.test.com',
        '200 OK',
        '{"data": "test"}'
      );
    });
    
    expect(result.current.savedResponses).toHaveLength(1);
    expect(result.current.savedResponses[0].apiName).toBe('Test API');
    expect(result.current.savedResponses[0].method).toBe('GET');
    expect(result.current.savedResponses[0].endpoint).toBe('https://api.test.com');
    expect(result.current.savedResponses[0].status).toBe('200 OK');
    expect(result.current.savedResponses[0].response).toBe('{"data": "test"}');
    expect(toast.success).toHaveBeenCalledWith('Response saved successfully');
  });

  it('should delete a response by id', () => {
    const { result } = renderHook(() => useSavedResponses());
    
    // Add a response first
    act(() => {
      result.current.saveResponse(
        'Test API',
        'GET',
        'https://api.test.com',
        '200 OK',
        '{"data": "test"}'
      );
    });
    
    const savedResponseId = result.current.savedResponses[0].id;
    
    // Delete the response
    act(() => {
      result.current.deleteResponse(savedResponseId);
    });
    
    expect(result.current.savedResponses).toHaveLength(0);
    expect(toast.success).toHaveBeenCalledWith('Response deleted');
  });

  it('should copy text to clipboard', () => {
    const { result } = renderHook(() => useSavedResponses());
    const testText = '{"data": "test"}';
    
    act(() => {
      result.current.copyToClipboard(testText);
    });
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testText);
    expect(toast.success).toHaveBeenCalledWith('Copied to clipboard');
  });

  it('should add new responses to the beginning of the list', () => {
    const { result } = renderHook(() => useSavedResponses());
    
    // Add first response
    act(() => {
      result.current.saveResponse(
        'First API',
        'GET',
        'https://api.first.com',
        '200 OK',
        '{"data": "first"}'
      );
    });
    
    // Add second response
    act(() => {
      result.current.saveResponse(
        'Second API',
        'POST',
        'https://api.second.com',
        '201 Created',
        '{"data": "second"}'
      );
    });
    
    expect(result.current.savedResponses).toHaveLength(2);
    expect(result.current.savedResponses[0].apiName).toBe('Second API');
    expect(result.current.savedResponses[1].apiName).toBe('First API');
  });
});
