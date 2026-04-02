export function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Chimney */}
      <rect x="15" y="4" width="3" height="6" rx="0.8" fill="currentColor" fillOpacity="0.35" />
      {/* Smoke wisps */}
      <path d="M15.5 4C15.8 3.2 16.8 3.2 16.5 2.2C16.2 1.2 17.2 0.8 17.5 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.45" />
      <path d="M17.8 3.5C18 2.8 18.8 2.5 18.5 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.25" />
      {/* House body fill */}
      <path d="M4.5 11.5V20C4.5 20.28 4.72 20.5 5 20.5H9.5V16.5C9.5 15.95 9.95 15.5 10.5 15.5H13.5C14.05 15.5 14.5 15.95 14.5 16.5V20.5H19C19.28 20.5 19.5 20.28 19.5 20V11.5" fill="currentColor" fillOpacity="0.12" />
      {/* Roof fill */}
      <path d="M2.5 11.5L12 4.5L19.5 10V11.5L12 6L4.5 11.5Z" fill="currentColor" fillOpacity="0.25" />
      {/* Roof outline */}
      <path d="M2 12L12 4.2L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* House walls */}
      <path d="M4.5 11.5V20C4.5 20.28 4.72 20.5 5 20.5H9.5M19.5 11.5V20C19.5 20.28 19.28 20.5 19 20.5H14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Door */}
      <path d="M9.5 21V17C9.5 16.17 10.17 15.5 11 15.5H13C13.83 15.5 14.5 16.17 14.5 17V21" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      {/* Door knob */}
      <circle cx="13.8" cy="18.5" r="0.6" fill="currentColor" opacity="0.7" />
      {/* Window */}
      <rect x="5.5" y="13.5" width="4" height="3.5" rx="0.8" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" />
      {/* Window cross */}
      <line x1="7.5" y1="13.5" x2="7.5" y2="17" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
      <line x1="5.5" y1="15.25" x2="9.5" y2="15.25" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
    </svg>
  );
}