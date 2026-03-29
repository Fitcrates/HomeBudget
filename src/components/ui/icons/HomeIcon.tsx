export function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M10.875 3.375L3.375 9.75C2.625 10.375 2.25 11 2.25 12C2.25 12.625 2.625 13.25 3.375 13.875C3.75 14.125 4.125 14.25 4.5 14.25V20.25C4.5 21.0625 5.1875 21.75 6 21.75H9V16.5H15V21.75H18C18.8125 21.75 19.5 21.0625 19.5 20.25V14.25C19.875 14.25 20.25 14.125 20.625 13.875C21.375 13.25 21.75 12.625 21.75 12C21.75 11 21.375 10.375 20.625 9.75L13.125 3.375C12.5 2.875 11.5 2.875 10.875 3.375Z" fill="currentColor" fillOpacity="0.4" />
      <path d="M10.875 3.375L3.375 9.75C2.625 10.375 2.25 11 2.25 12M10.875 3.375C11.5 2.875 12.5 2.875 13.125 3.375L20.625 9.75C21.375 10.375 21.75 11 21.75 12M10.875 3.375V2.25M17.25 11.25V5.25H19.5V10.125" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 12V20.25C4.5 21.0625 5.1875 21.75 6 21.75H18C18.8125 21.75 19.5 21.0625 19.5 20.25V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 21.75V16.5H15V21.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="15.5" cy="5.5" r="1.5" fill="currentColor" opacity="0.6"/>
      <circle cx="17.5" cy="3.5" r="1" fill="currentColor" opacity="0.4"/>
    </svg>
  );
}
