
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MethodSelector from '../MethodSelector';
import { vi, Mock } from 'vitest';

describe('MethodSelector component styling and classes', () => {
  const mockOnMethodChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should apply the correct class for GET method', () => {
    render(<MethodSelector method="GET" onMethodChange={mockOnMethodChange} />);
    
    const trigger = screen.getByRole('combobox');
    expect(trigger.className).toContain('method-get');
  });

  it('should apply the correct class for POST method', () => {
    render(<MethodSelector method="POST" onMethodChange={mockOnMethodChange} />);
    
    const trigger = screen.getByRole('combobox');
    expect(trigger.className).toContain('method-post');
  });

  it('should apply the correct class for PUT method', () => {
    render(<MethodSelector method="PUT" onMethodChange={mockOnMethodChange} />);
    
    const trigger = screen.getByRole('combobox');
    expect(trigger.className).toContain('method-put');
  });

  it('should apply the correct class for DELETE method', () => {
    render(<MethodSelector method="DELETE" onMethodChange={mockOnMethodChange} />);
    
    const trigger = screen.getByRole('combobox');
    expect(trigger.className).toContain('method-delete');
  });

  it('should apply the correct class for PATCH method', () => {
    render(<MethodSelector method="PATCH" onMethodChange={mockOnMethodChange} />);
    
    const trigger = screen.getByRole('combobox');
    expect(trigger.className).toContain('method-patch');
  });

  it('should update classes when changing methods', () => {
    const { rerender } = render(<MethodSelector method="GET" onMethodChange={mockOnMethodChange} />);
    
    let trigger = screen.getByRole('combobox');
    expect(trigger.className).toContain('method-get');
    
    // Rerender with different method
    rerender(<MethodSelector method="POST" onMethodChange={mockOnMethodChange} />);
    
    trigger = screen.getByRole('combobox');
    expect(trigger.className).toContain('method-post');
    expect(trigger.className).not.toContain('method-get');
  });

  it('should have the correct animation properties', () => {
    render(<MethodSelector method="GET" onMethodChange={mockOnMethodChange} />);
    
    // Check if the motion div has animation properties
    const motionDiv = screen.getByText('HTTP Method').parentElement;
    expect(motionDiv?.tagName.toLowerCase()).toBe('div');
    
    // Test for framer-motion attributes (this is a simplified check)
    expect(motionDiv).toHaveAttribute('style');
  });
});
