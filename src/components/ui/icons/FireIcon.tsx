export function FireIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Outer flame body */}
      <path d="M12 22C16 22 19.5 18.6 19.5 14.5C19.5 11 17.5 8.8 15.5 7C15 9 14 10.5 12.5 11.5C12.5 9.5 12 7 10 5C10 7.5 9 9 7.5 10C6 10.9 4.5 12.5 4.5 14.5C4.5 18.6 8 22 12 22Z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Inner flame — hotter core */}
      <path d="M12 21C13.9 21 15.5 19.4 15.5 17.5C15.5 15.8 14.5 14.5 13.5 13.5C13.3 14.8 12.8 15.8 12 16.5C11.7 15.3 11 14.2 10 13.5C9 14.5 8.5 15.8 8.5 17.5C8.5 19.4 10.1 21 12 21Z" fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Tiny core glow */}
      <path d="M12 20C12.8 20 13.5 19.3 13.5 18.5C13.5 17.8 13 17.2 12.5 16.8C12.4 17.3 12.2 17.7 12 18C11.8 17.7 11.6 17.3 11.5 16.8C11 17.2 10.5 17.8 10.5 18.5C10.5 19.3 11.2 20 12 20Z" fill="currentColor" opacity="0.8" />
    </svg>
  );
}