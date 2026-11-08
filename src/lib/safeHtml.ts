// Rich text from notes is shared between people: always sanitize before putting it in the DOM
// (removes scripts, event handlers like onerror=, javascript: links, iframes...).
import DOMPurify from 'dompurify';

export const sanitizeHtml = (html: string) => DOMPurify.sanitize(html || '', {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['data-mention', 'data-mention-id', 'data-id', 'data-type', 'contenteditable', 'target'],
  FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
});

/** Plain text of an HTML string without ever executing it (DOMParser documents are inert). */
export const htmlToText = (html: string) => new DOMParser().parseFromString(html || '', 'text/html').body.textContent || '';
