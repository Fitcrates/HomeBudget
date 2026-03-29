export function AvatarFemaleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="50" cy="50" r="48" fill="#eebd9b" />
      <path d="M20 90C20 75 35 65 50 65C65 65 80 75 80 90H20Z" fill="#e89e5a" stroke="#d58641" strokeWidth="2" />
      <path d="M25 80C25 80 35 70 50 70C65 70 75 80 75 80" stroke="#fbcda8" strokeWidth="8" strokeLinecap="round" />
      <circle cx="50" cy="45" r="20" fill="#fad1b3" />
      {/* Hair */}
      <path d="M25 50C20 30 35 15 50 15C65 15 80 30 75 50C75 70 65 80 50 78C35 80 25 70 25 50Z" fill="#7a4220" />
      <circle cx="50" cy="45" r="20" fill="#fad1b3" />
      {/* Bangs */}
      <path d="M28 35C40 25 60 25 72 35C70 45 60 30 50 35C40 30 30 45 28 35Z" fill="#7a4220" />
      {/* Eyes */}
      <circle cx="43" cy="42" r="2" fill="#3a2212" />
      <circle cx="57" cy="42" r="2" fill="#3a2212" />
      <path d="M44 50Q50 54 56 50" stroke="#c95856" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}
