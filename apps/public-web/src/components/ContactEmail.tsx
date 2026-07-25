const CONTACT = import.meta.env.VITE_CONTACT_EMAIL ?? '';

const parts = CONTACT.split('@');
const user = parts[0] ?? '';
const domain = parts[1] ?? '';

export function ContactEmail({ className }: { className?: string }) {
  if (!CONTACT) return <span className={className}>contact email not configured</span>;

  const open = () => { window.location.href = `mailto:${CONTACT}`; };
  return (
    <button type="button" className={`contact-email${className ? ` ${className}` : ''}`} onClick={open} title="Click to email us">
      {user}<span className="ce-sep"> [at] </span>{domain.replace('.', ' [dot] ')}
    </button>
  );
}
