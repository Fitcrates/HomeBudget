export function ExpensesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Piggy bank body */}
      <path d="M10.5 7C7 7 4 9.7 4 13C4 15.05 5.1 16.85 6.75 17.95V20C6.75 20.55 7.2 21 7.75 21H9.75C10.3 21 10.75 20.55 10.75 20V19.5H13.25V20C13.25 20.55 13.7 21 14.25 21H16.25C16.8 21 17.25 20.55 17.25 20V17.95C18.9 16.85 20 15.05 20 13C20 9.7 17 7 13.5 7H10.5Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      {/* Ear */}
      <path d="M13 7C13 5.8 13.6 5 14.5 5C15.4 5 16 5.6 16 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      {/* Coin slot */}
      <rect x="9.5" y="5.5" width="5" height="2" rx="1" fill="currentColor" fillOpacity="0.45" />
      <rect x="9.5" y="5.5" width="5" height="2" rx="1" stroke="currentColor" strokeWidth="1.4" />
      {/* Eye */}
      <circle cx="9.5" cy="11.5" r="1" fill="currentColor" opacity="0.7" />
      {/* Snout */}
      <ellipse cx="6" cy="13.5" rx="1.8" ry="1.4" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="5.4" cy="13.3" r="0.45" fill="currentColor" opacity="0.55" />
      <circle cx="6.6" cy="13.3" r="0.45" fill="currentColor" opacity="0.55" />
      {/* Tail */}
      <path d="M20 12C21.2 12 22 11.5 22 10.5C22 9.5 21.2 9 20.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
      {/* Coin */}
      <circle cx="19" cy="5" r="2.2" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.4" />
      <text x="19" y="5.8" textAnchor="middle" fontSize="3.5" fontWeight="600" fill="currentColor" opacity="0.7">$</text>
    </svg>
  );
}