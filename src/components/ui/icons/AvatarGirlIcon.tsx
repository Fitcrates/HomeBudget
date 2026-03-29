export function AvatarGirlIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="50" cy="50" r="48" fill="#dfa591" />
      {/* Body */}
      <path d="M30 90C30 80 40 70 50 70C60 70 70 80 70 90H30Z" fill="#ed8b68" />
      <circle cx="50" cy="48" r="18" fill="#fbcda8" />
      {/* Hair pigtails */}
      <circle cx="28" cy="45" r="10" fill="#8c512d" />
      <circle cx="72" cy="45" r="10" fill="#8c512d" />
      {/* Hair top */}
      <path d="M32 45C32 25 45 25 50 25C55 25 68 25 68 45C68 35 55 35 50 35C45 35 32 35 32 45Z" fill="#8c512d" />
      {/* Eyes */}
      <circle cx="43" cy="45" r="2" fill="#3a2212" />
      <circle cx="57" cy="45" r="2" fill="#3a2212" />
      {/* Mouth */}
      <path d="M45 52Q50 55 55 52" stroke="#c95856" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Cheeks */}
      <circle cx="38" cy="48" r="3" fill="#ffb8b8" opacity="0.6" />
      <circle cx="62" cy="48" r="3" fill="#ffb8b8" opacity="0.6" />
    </svg>
  );
}
