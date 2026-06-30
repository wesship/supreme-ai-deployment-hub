
/**
 * Utilities for sanitizing user input to prevent security vulnerabilities
 */

/**
 * Sanitize a string to prevent XSS attacks
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

/**
 * Sanitize HTML content
 * Use this when you need to allow some HTML tags but want to remove potentially dangerous ones
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Remove potentially dangerous elements
  const scripts = tempDiv.querySelectorAll('script');
  scripts.forEach(script => script.remove());
  
  const iframes = tempDiv.querySelectorAll('iframe');
  iframes.forEach(iframe => iframe.remove());
  
  const objects = tempDiv.querySelectorAll('object');
  objects.forEach(object => object.remove());
  
  const embeds = tempDiv.querySelectorAll('embed');
  embeds.forEach(embed => embed.remove());
  
  // Remove on* attributes from all elements
  const allElements = tempDiv.querySelectorAll('*');
  allElements.forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.toLowerCase().startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });
    
    // Remove javascript: URLs
    if (el.hasAttribute('href')) {
      const href = el.getAttribute('href') || '';
      if (href.toLowerCase().startsWith('javascript:')) {
        el.setAttribute('href', '#');
      }
    }
    
    if (el.hasAttribute('src')) {
      const src = el.getAttribute('src') || '';
      if (src.toLowerCase().startsWith('javascript:')) {
        el.removeAttribute('src');
      }
    }
  });
  
  return tempDiv.innerHTML;
}

/**
 * Sanitize a URL to prevent javascript: protocol and other potentially dangerous URLs
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';
  
  const urlLower = url.toLowerCase().trim();
  
  // Check for dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  if (dangerousProtocols.some(protocol => urlLower.startsWith(protocol))) {
    return '';
  }
  
  return url;
}

/**
 * Sanitize JSON input before parsing to prevent prototype pollution
 */
export function sanitizeJSON(jsonString: string): any {
  try {
    const parsed = JSON.parse(jsonString);
    
    // Simple protection against prototype pollution
    if (parsed && typeof parsed === 'object') {
      if (parsed.__proto__ !== undefined || parsed.constructor !== undefined ||
          parsed.prototype !== undefined) {
        throw new Error('Potential prototype pollution detected');
      }
    }
    
    return parsed;
  } catch (error) {
    console.error('Error sanitizing JSON:', error);
    return null;
  }
}
