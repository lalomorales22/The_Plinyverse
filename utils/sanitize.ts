import DOMPurify from 'dompurify';

/**
 * SECURITY: Sanitize HTML content to prevent XSS attacks
 *
 * This utility uses DOMPurify to clean potentially malicious HTML/script content
 * before rendering it in the application.
 */

/**
 * Sanitize a string to prevent XSS attacks
 * @param dirty - The potentially unsafe string
 * @returns Sanitized safe string
 */
export const sanitizeHtml = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href'],
    ALLOW_DATA_ATTR: false,
  });
};

/**
 * Sanitize a URL to prevent javascript: and data: URLs
 * @param url - The URL to sanitize
 * @returns Safe URL or empty string if dangerous
 */
export const sanitizeUrl = (url: string): string => {
  const trimmedUrl = url.trim().toLowerCase();

  // Block dangerous URL schemes
  const dangerousSchemes = [
    'javascript:',
    'data:text/html',
    'vbscript:',
    'file:',
  ];

  for (const scheme of dangerousSchemes) {
    if (trimmedUrl.startsWith(scheme)) {
      console.warn('[SECURITY] Blocked dangerous URL:', url);
      return '';
    }
  }

  // Allow only http, https, and data: URLs for images/videos
  if (!trimmedUrl.startsWith('http://') &&
      !trimmedUrl.startsWith('https://') &&
      !trimmedUrl.startsWith('data:image/') &&
      !trimmedUrl.startsWith('data:video/')) {
    console.warn('[SECURITY] Blocked non-http(s) URL:', url);
    return '';
  }

  return url;
};

/**
 * Sanitize file name to prevent path traversal
 * @param filename - The filename to sanitize
 * @returns Safe filename
 */
export const sanitizeFilename = (filename: string): string => {
  // Remove path traversal attempts
  let safe = filename.replace(/\.\./g, '');
  safe = safe.replace(/[\/\\]/g, '');

  // Limit length
  if (safe.length > 255) {
    safe = safe.substring(0, 255);
  }

  return safe;
};

/**
 * Validate and sanitize user input text
 * @param input - User input string
 * @param maxLength - Maximum allowed length (default 10000)
 * @returns Sanitized input
 */
export const sanitizeInput = (input: string, maxLength: number = 10000): string => {
  let safe = input.trim();

  // Limit length
  if (safe.length > maxLength) {
    safe = safe.substring(0, maxLength);
  }

  // Remove null bytes
  safe = safe.replace(/\0/g, '');

  return safe;
};
