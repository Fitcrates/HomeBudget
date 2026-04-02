export function ScannerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Receipt paper body */}
      <path d="M6 2.5H18C18.28 2.5 18.5 2.72 18.5 3V18.5L17 17.5L15.5 18.5L14 17.5L12.5 18.5L11 17.5L9.5 18.5L8 17.5L6.5 18.5L5.5 17.8V3C5.5 2.72 5.72 2.5 6 2.5Z" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      {/* Receipt lines */}
      <line x1="8.5" y1="6.5" x2="15.5" y2="6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      <line x1="8.5" y1="9" x2="13" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <line x1="8.5" y1="11.5" x2="15.5" y2="11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <line x1="8.5" y1="14" x2="11.5" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.3" />
      {/* Scan frame corners */}
      <path d="M1.5 7V4C1.5 3.17 2.17 2.5 3 2.5H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 13V16C1.5 16.83 2.17 17.5 3 17.5H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 2.5H21C21.83 2.5 22.5 3.17 22.5 4V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 17.5H21C21.83 17.5 22.5 16.83 22.5 16V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Scan beam */}
      <line x1="1" y1="10" x2="23" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      {/* Beam glow dots */}
      <circle cx="5" cy="10" r="1.2" fill="currentColor" opacity="0.5" />
      <circle cx="19" cy="10" r="1.2" fill="currentColor" opacity="0.5" />
    </svg>
  );
}