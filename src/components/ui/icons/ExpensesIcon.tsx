export function ExpensesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M19 19V20C19 20.5523 18.5523 21 18 21C17.4477 21 17 20.5523 17 20V19H7V20C7 20.5523 6.55228 21 6 21C5.44772 21 5 20.5523 5 20V18.1C3.8 17.2 3 15.7 3 14V13C3 10.2386 5.23858 8 8 8H16C18.7614 8 21 10.2386 21 13V14C21 15.7 20.2 17.2 19 18.1V19Z" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 8V5H10V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="16" cy="12" r="1.5" fill="currentColor"/>
      <path d="M21 12H21.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 12H3.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
