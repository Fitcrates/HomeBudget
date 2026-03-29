export function AvatarMaleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Background/Shadow */}
      <circle cx="50" cy="50" r="48" fill="#e5d0a1" />
      {/* Body */}
      <path d="M20 90C20 75 35 60 50 60C65 60 80 75 80 90H20Z" fill="#9d6446" />
      {/* Head */}
      <circle cx="50" cy="40" r="20" fill="#fbcda8" />
      {/* Hair */}
      <path d="M28 40C28 25 35 15 50 15C65 15 72 25 72 40C72 38 65 35 50 35C35 35 28 38 28 40Z" fill="#58311a" />
      <path d="M30 40C26 40 25 45 25 50C25 45 30 48 30 48L30 40Z" fill="#58311a" />
      <path d="M70 40C74 40 75 45 75 50C75 45 70 48 70 48L70 40Z" fill="#58311a" />
      {/* Eyes */}
      <circle cx="43" cy="38" r="2" fill="#3a2212" />
      <circle cx="57" cy="38" r="2" fill="#3a2212" />
      {/* Nose */}
      <path d="M50 42C48 42 49 45 50 45C51 45 52 42 50 42Z" fill="#e0a37e" />
      {/* Mouth */}
      <path d="M44 48Q50 52 56 48" stroke="#3a2212" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Beard */}
      <path d="M35 48Q50 65 65 48Q60 55 50 55Q40 55 35 48Z" fill="#58311a" />
    </svg>
  );
}
