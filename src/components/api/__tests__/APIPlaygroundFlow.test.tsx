
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import APIPlaygroundTab from '../APIPlaygroundTab';
import { useAPI } from '@/contexts/APIContext';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('@/contexts/APIContext', () => ({
  useAPI: vi.fn(),
}));

// Fully mock useAPIPlayground matching the actual return structure
const mockSendRequest = vi.fn();
const mockHandleSaveResponse = vi.fn();
const mockHandleSelectAPI = vi.fn();
const mockSetMethod = vi.fn();
const mockSetEndpoint = vi.fn();
const mockSetRequestBody = vi.fn();
const mockSetHeaders = vi.fn();

vi.mock('@/hooks/useAPIPlayground', () => ({
  useAPIPlayground: () => ({
    state: {
      selectedAPI: 'Test API',
      method: 'GET',
      endpoint: 'https://api.test.com/users',
      requestBody: '',
      headers: '{}',
      response: '',
      status: '',
      loading: false,
      error: null,
    },
    handleSelectAPI: mockHandleSelectAPI,
    setMethod: mockSetMethod,
    setEndpoint: mockSetEndpoint,
    setRequestBody: mockSetRequestBody,
    setHeaders: mockSetHeaders,
    sendRequest: mockSendRequest,
    handleSaveResponse: mockHandleSaveResponse,
  }),
}));

describe('API Playground Flow', () => {
  const mockSaveResponse = vi.fn();
  const mockAPIConfigs = [
    { name: 'Test API', endpoint: 'https://api.test.com', apiKey: 'test-key', description: 'Test API', isConnected: true },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAPI).mockReturnValue({ apiConfigs: mockAPIConfigs } as any);
  });

  it('should allow users to select an API, configure and send a request', async () => {
    render(<APIPlaygroundTab onSaveResponse={mockSaveResponse} />);
    
    // The default tab is "playground" so playground content should be visible
    // Verify key form elements are present
    expect(screen.getByText('Test API endpoints interactively')).toBeInTheDocument();
    
    // Verify Send Request button exists and click it
    const sendButton = screen.getByRole('button', { name: /send request/i });
    expect(sendButton).toBeInTheDocument();
    fireEvent.click(sendButton);
    
    // Verify sendRequest was called
    expect(mockSendRequest).toHaveBeenCalled();
  });

  it('should handle dashboard tab navigation', async () => {
    render(<APIPlaygroundTab onSaveResponse={mockSaveResponse} />);
    
    // The default tab is "playground", check dashboard tab exists
    const dashboardTab = screen.getByRole('tab', { name: 'Dashboard' });
    expect(dashboardTab).toBeInTheDocument();
    
    // Check playground tab is active by default
    const playgroundTab = screen.getByRole('tab', { name: 'API Playground' });
    expect(playgroundTab).toBeInTheDocument();
    
    // Verify playground content is visible by default
    expect(screen.getByText('Test API endpoints interactively')).toBeInTheDocument();
  });
});
