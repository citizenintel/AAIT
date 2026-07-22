/**
 * Renders the project contact address in a scrape-resistant way:
 * - the address is never a single contiguous literal in source or in the rendered DOM text
 *   (it's split into parts and the "@"/"." are shown as [at]/[dot]);
 * - there is no static `mailto:` in the markup — it's assembled only on click.
 * Bulk email harvesters (which read source/`mailto:` and match user@domain) get nothing;
 * a human reads it fine and one click opens their mail client.
 */
const U = 'altafrikaner';
const D1 = 'outlook';
const D2 = 'com';

export function ContactEmail({ className }: { className?: string }) {
  const open = () => { window.location.href = `mailto:${U}@${D1}.${D2}`; };
  return (
    <button type="button" className={`contact-email${className ? ` ${className}` : ''}`} onClick={open} title="Click to email us">
      {U}<span className="ce-sep"> [at] </span>{D1}<span className="ce-sep"> [dot] </span>{D2}
    </button>
  );
}
