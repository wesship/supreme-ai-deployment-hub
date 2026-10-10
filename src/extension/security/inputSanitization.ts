/**
 * Utilities for sanitizing user input to prevent security vulnerabilities
 */

const URL_PARSE_BASE = 'https://sanitizer.invalid';
const SAFE_HREF_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const SAFE_SRC_PROTOCOLS = new Set(['http:', 'https:']);

function hasExplicitScheme(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value.trim());
}

function isSafeUrlValue(value: string, allowedProtocols: Set<string>): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed, URL_PARSE_BASE);
    if (!hasExplicitScheme(trimmed)) {
      return parsed.origin === URL_PARSE_BASE;
    }
    return allowedProtocols.has(parsed.protocol);
  } catch {
    return false;
  }
}

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

  // Remove potentially dangerous elements.
  tempDiv.querySelectorAll('script, iframe, object, embed').forEach((element) => element.remove());

  // Remove event handlers and reject every URL protocol except an explicit allowlist.
  tempDiv.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.toLowerCase().startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });

    if (el.hasAttribute('href')) {
      const href = el.getAttribute('href') || '';
      if (!isSafeUrlValue(href, SAFE_HREF_PROTOCOLS)) {
        el.removeAttribute('href');
      }
    }

    if (el.hasAttribute('src')) {
      const src = el.getAttribute('src') || '';
      if (!isSafeUrlValue(src, SAFE_SRC_PROTOCOLS)) {
        el.removeAttribute('src');
      }
    }
  });

  return tempDiv.innerHTML;
}

/**
 * Sanitize a URL by accepting only HTTP(S) and relative URLs.
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';

  const trimmed = url.trim();
  return isSafeUrlValue(trimmed, SAFE_SRC_PROTOCOLS) ? trimmed : '';
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
