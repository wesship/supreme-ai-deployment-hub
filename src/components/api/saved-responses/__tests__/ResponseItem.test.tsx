
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ResponseItem from '../ResponseItem';
import { SavedAPIResponse } from '@/types/api';
import { vi, Mock } from 'vitest';

describe('ResponseItem component', () => {
  const mockResponse: SavedAPIResponse = {
    id: 'test-id',
    timestamp: new Date('2023-06-15T12:00:00Z'),
    apiName: 'Test API',
    method: 'GET',
    endpoint: 'https://api.test.com',
    status: '200 OK',
    response: '{"data": "test"}'
  };
  
  const mockOnCopy = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render response details correctly', () => {
    render(
      <ResponseItem 
        response={mockResponse} 
        onCopy={mockOnCopy} 
        onDelete={mockOnDelete} 
      />
    );
    
    expect(screen.getByText('Test API')).toBeInTheDocument();
    expect(screen.getByText('GET')).toBeInTheDocument();
    expect(screen.getByText('https://api.test.com')).toBeInTheDocument();
    expect(screen.getByText('Status: 200 OK')).toBeInTheDocument();
    expect(screen.getByText('{"data": "test"}')).toBeInTheDocument();
  });

  it('should call onCopy when copy button is clicked', () => {
    render(
      <ResponseItem 
        response={mockResponse} 
        onCopy={mockOnCopy} 
        onDelete={mockOnDelete} 
      />
    );
    
    const copyButton = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyButton);
    
    expect(mockOnCopy).toHaveBeenCalledWith('{"data": "test"}');
  });

  it('should call onDelete when delete button is clicked', () => {
    render(
      <ResponseItem 
        response={mockResponse} 
        onCopy={mockOnCopy} 
        onDelete={mockOnDelete} 
      />
    );
    
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);
    
    expect(mockOnDelete).toHaveBeenCalledWith('test-id');
  });

  it('should use green status style for 2xx status codes', () => {
    render(
      <ResponseItem 
        response={mockResponse} 
        onCopy={mockOnCopy} 
        onDelete={mockOnDelete} 
      />
    );
    
    const statusElement = screen.getByText('Status: 200 OK');
    expect(statusElement.className).toContain('bg-green');
  });

  it('should use red status style for non-2xx status codes', () => {
    const errorResponse = { 
      ...mockResponse, 
      status: '404 Not Found' 
    };
    
    render(
      <ResponseItem 
        response={errorResponse} 
        onCopy={mockOnCopy} 
        onDelete={mockOnDelete} 
      />
    );
    
    const statusElement = screen.getByText('Status: 404 Not Found');
    expect(statusElement.className).toContain('bg-red');
  });

  it('should apply correct color styles for different methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    const expectedClasses = [
      'bg-blue', 'bg-green', 'bg-yellow', 'bg-red', 'bg-gray'
    ];
    
    methods.forEach((method, index) => {
      const response = { ...mockResponse, method };
      const { unmount } = render(
        <ResponseItem 
          response={response} 
          onCopy={mockOnCopy} 
          onDelete={mockOnDelete} 
        />
      );
      
      const methodElement = screen.getByText(method);
      expect(methodElement.className).toContain(expectedClasses[index]);
      
      unmount();
    });
  });
});
