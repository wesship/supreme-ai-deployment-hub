
/**
 * Utilities for handling CPU-intensive operations in a web worker
 */

/**
 * Process data in a web worker to avoid blocking the main thread
 */
export function processWithWorker<T, R>(
  processingFunction: (data: T) => R,
  data: T,
  onComplete: (result: R) => void,
  onError: (error: Error) => void
): void {
  try {
    // Convert function to string to pass to worker
    const functionStr = processingFunction.toString();
    const dataStr = JSON.stringify(data);
    
    // Create a blob containing the worker code
    const blob = new Blob([
      `
      // Worker script
      const processingFunction = ${functionStr};
      
      // Parse the input data
      const data = JSON.parse('${dataStr.replace(/'/g, "\\'")}');
      
      // Process the data
      try {
        const result = processingFunction(data);
        self.postMessage({ success: true, result });
      } catch (error) {
        self.postMessage({ 
          success: false, 
          error: { 
            message: error.message,
            stack: error.stack,
            name: error.name
          } 
        });
      }
      `
    ], { type: 'application/javascript' });
    
    // Create URL from blob
    const blobURL = URL.createObjectURL(blob);
    
    // Create worker
    const worker = new Worker(blobURL);
    
    // Handle worker messages
    worker.onmessage = (e) => {
      // Clean up
      URL.revokeObjectURL(blobURL);
      worker.terminate();
      
      if (e.data.success) {
        onComplete(e.data.result);
      } else {
        onError(new Error(e.data.error.message));
      }
    };
    
    // Handle worker errors
    worker.onerror = (e) => {
      // Clean up
      URL.revokeObjectURL(blobURL);
      worker.terminate();
      
      onError(new Error(`Worker error: ${e.message}`));
    };
    
  } catch (error) {
    // Fall back to synchronous processing if worker creation fails
    console.error('Worker creation failed, falling back to synchronous processing:', error);
    try {
      const result = processingFunction(data);
      onComplete(result);
    } catch (processingError) {
      onError(processingError as Error);
    }
  }
}

/**
 * Example usage:
 * 
 * ```
 * processWithWorker(
 *   (data) => { 
 *     // CPU intensive work here
 *     return data.map(item => complexCalculation(item));
 *   },
 *   largeDataArray,
 *   (result) => {
 *     // Handle successful result
 *     displayResults(result);
 *   },
 *   (error) => {
 *     // Handle error
 *     showError(error.message);
 *   }
 * );
 * ```
 */
