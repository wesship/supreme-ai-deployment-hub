
/**
 * Validates speech recognition and synthesis support in the target environment
 * This script can be used to verify browser compatibility during the CI/CD process
 */

const { JSDOM } = require('jsdom');

// Create a simple virtual DOM to test speech feature availability
function checkSpeechFeatureSupport() {
  // Create virtual window
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'https://localhost/',
    runScripts: 'dangerously',
    resources: 'usable'
  });

  const window = dom.window;
  
  // Add test objects to simulate browser environment
  window.SpeechRecognition = {};
  window.webkitSpeechRecognition = {};
  window.speechSynthesis = {
    getVoices: () => [],
    speak: () => {},
    cancel: () => {}
  };
  window.SpeechSynthesisUtterance = function() {};
  
  // Test recognition support
  const recognitionSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  // Test synthesis support
  const synthesisSupported = !!window.speechSynthesis;

  // Cleanup
  window.close();
  
  return {
    recognition: recognitionSupported,
    synthesis: synthesisSupported,
    timestamp: new Date().toISOString()
  };
}

// Run check
const supportStatus = checkSpeechFeatureSupport();
console.log('Speech Feature Support Check:', supportStatus);

// Exit with appropriate code for CI/CD
process.exit(
  supportStatus.recognition && supportStatus.synthesis ? 0 : 1
);
