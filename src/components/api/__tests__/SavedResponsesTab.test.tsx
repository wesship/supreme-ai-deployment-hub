
import React from 'react';
import { render, screen } from '@testing-library/react';
import SavedResponsesTab from '../SavedResponsesTab';
import { SavedAPIResponse } from '@/types/api';
import { vi, Mock } from 'vitest';

describe('SavedResponsesTab component', () => {
  const mockResponses: SavedAPIResponse[] = [
    {
      id: 'test-id-1',
      timestamp: new Date('2023-06-15T12:00:00Z'),
      apiName: 'Test API 1',
      method: 'GET',
      endpoint: 'https://api.test.com/1',
      status: '200 OK',
      response: '{"data": "test1"}'
    },
    {
      id: 'test-id-2',
      timestamp: new Date('2023-06-16T12:00:00Z'),
      apiName: 'Test API 2',
      method: 'POST',
      endpoint: 'https://api.test.com/2',
      status: '201 Created',
      response: '{"data": "test2"}'
    }
  ];
  
  const mockOnDeleteResponse = vi.fn();
  const mockOnCopyToClipboard = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render empty state when no responses', () => {
    render(
      <SavedResponsesTab 
        savedResponses={[]} 
        onDeleteResponse={mockOnDeleteResponse}
        onCopyToClipboard={mockOnCopyToClipboard}
      />
    );
    
    expect(screen.getByText('Saved Responses')).toBeInTheDocument();
    expect(screen.getByText('No saved responses yet')).toBeInTheDocument();
    expect(screen.getByText('Use the API Playground to test endpoints and save responses for future reference')).toBeInTheDocument();
  });

  it('should render list of responses when available', () => {
    render(
      <SavedResponsesTab 
        savedResponses={mockResponses} 
        onDeleteResponse={mockOnDeleteResponse}
        onCopyToClipboard={mockOnCopyToClipboard}
      />
    );
    
    expect(screen.getByText('Saved Responses')).toBeInTheDocument();
    expect(screen.getByText('Test API 1')).toBeInTheDocument();
    expect(screen.getByText('Test API 2')).toBeInTheDocument();
    expect(screen.getByText('https://api.test.com/1')).toBeInTheDocument();
    expect(screen.getByText('https://api.test.com/2')).toBeInTheDocument();
    expect(screen.getByText('{"data": "test1"}')).toBeInTheDocument();
    expect(screen.getByText('{"data": "test2"}')).toBeInTheDocument();
  });

  it('should render responses with correct HTTP methods', () => {
    render(
      <SavedResponsesTab 
        savedResponses={mockResponses} 
        onDeleteResponse={mockOnDeleteResponse}
        onCopyToClipboard={mockOnCopyToClipboard}
      />
    );
    
    expect(screen.getByText('GET')).toBeInTheDocument();
    expect(screen.getByText('POST')).toBeInTheDocument();
  });

  it('should render responses with correct status codes', () => {
    render(
      <SavedResponsesTab 
        savedResponses={mockResponses} 
        onDeleteResponse={mockOnDeleteResponse}
        onCopyToClipboard={mockOnCopyToClipboard}
      />
    );
    
    expect(screen.getByText('Status: 200 OK')).toBeInTheDocument();
    expect(screen.getByText('Status: 201 Created')).toBeInTheDocument();
  });
});
