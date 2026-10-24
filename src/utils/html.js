// Escapes text for interpolating into an HTML template string - as element
// text or as a quoted attribute value (double or single quotes). Use it for
// every value that comes from config/config.json or from user input: a
// label like `Children's "quiet" time` or `R&R` is ordinary, and would
// otherwise end an attribute early or produce malformed markup.
//
// undefined/null render as empty text; anything else as its string.
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
