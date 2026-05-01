
import { showConnectionStatus, showErrorMessage, showSuccessMessage, showWarningMessage } from '../settingsUI';
import { vi, Mock } from 'vitest';

// Mock DOM elements
function setupDomElements() {
  // Create test elements
  document.body.innerHTML = `
    <div class="settings-form">
      <div id="connection-status"></div>
    </div>
  `;
  
  return {
    connectionStatus: document.getElementById('connection-status') as HTMLDivElement,
    settingsForm: document.querySelector('.settings-form') as Element
  };
}

describe('settingsUI', () => {
  beforeEach(() => {
    // Reset DOM before each test
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('showConnectionStatus', () => {
    it('should set successful connection status', () => {
      const { connectionStatus } = setupDomElements();
      showConnectionStatus('Connected successfully', true, connectionStatus);
      
      expect(connectionStatus.textContent).toBe('Connected successfully');
      expect(connectionStatus.classList.contains('success')).toBe(true);
      expect(connectionStatus.classList.contains('error')).toBe(false);
    });

    it('should set error connection status', () => {
      const { connectionStatus } = setupDomElements();
      showConnectionStatus('Connection failed', false, connectionStatus);
      
      expect(connectionStatus.textContent).toBe('Connection failed');
      expect(connectionStatus.classList.contains('error')).toBe(true);
      expect(connectionStatus.classList.contains('success')).toBe(false);
    });
  });

  describe('message display functions', () => {
    it('should display error message and remove it after timeout', () => {
      const { settingsForm } = setupDomElements();
      showErrorMessage('Error message', settingsForm);
      
      const errorElement = document.querySelector('.error-message');
      expect(errorElement).not.toBeNull();
      expect(errorElement?.textContent).toBe('Error message');
      
      // Fast-forward timeout
      vi.advanceTimersByTime(5000);
      
      // Message should be removed
      expect(document.querySelector('.error-message')).toBeNull();
    });

    it('should display success message and remove it after timeout', () => {
      const { settingsForm } = setupDomElements();
      showSuccessMessage('Success message', settingsForm);
      
      const successElement = document.querySelector('.success-message');
      expect(successElement).not.toBeNull();
      expect(successElement?.textContent).toBe('Success message');
      
      // Fast-forward timeout
      vi.advanceTimersByTime(3000);
      
      // Message should be removed
      expect(document.querySelector('.success-message')).toBeNull();
    });

    it('should display warning message and remove it after timeout', () => {
      const { settingsForm } = setupDomElements();
      showWarningMessage('Warning message', settingsForm);
      
      const warningElement = document.querySelector('.warning-message');
      expect(warningElement).not.toBeNull();
      expect(warningElement?.textContent).toBe('Warning message');
      
      // Fast-forward timeout
      vi.advanceTimersByTime(4000);
      
      // Message should be removed
      expect(document.querySelector('.warning-message')).toBeNull();
    });

    it('should remove existing messages before adding a new one', () => {
      const { settingsForm } = setupDomElements();
      
      // Add an error message
      showErrorMessage('First error', settingsForm);
      expect(document.querySelectorAll('.status-message').length).toBe(1);
      
      // Add a success message - should replace error
      showSuccessMessage('Success message', settingsForm);
      expect(document.querySelectorAll('.status-message').length).toBe(1);
      expect(document.querySelector('.success-message')).not.toBeNull();
      expect(document.querySelector('.error-message')).toBeNull();
    });
  });
});
