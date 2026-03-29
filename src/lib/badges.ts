export interface Badge {
  id: string;
  emoji: string;
  name: string;
  description: string;
  condition: (stats: UserStats) => boolean;
  tier: "bronze" | "silver" | "gold" | "platinum";
}

export interface UserStats {
  totalExpenses: number;
  ocrExpenses: number;
  manualExpenses: number;
  totalAmount: number;
  streak: number;
}

export const ALL_BADGES: Badge[] = [
  // --- TOTAL EXPENSES ---
  {
    id: "first_blood",
    emoji: "🩸",
    name: "Pierwsze Cięcie",
    description: "Dodałeś swój pierwszy wydatek. Portfel już płacze.",
    condition: (s) => s.totalExpenses >= 1,
    tier: "bronze",
  },
  {
    id: "rookie",
    emoji: "🐣",
    name: "Świeżak",
    description: "10 wydatków. Dopiero zaczynasz rozumieć, gdzie idą pieniądze.",
    condition: (s) => s.totalExpenses >= 10,
    tier: "bronze",
  },
  {
    id: "regular",
    emoji: "📝",
    name: "Skrupulatny",
    description: "50 wydatków. Twój księgowy byłby z Ciebie dumny.",
    condition: (s) => s.totalExpenses >= 50,
    tier: "silver",
  },
  {
    id: "addict",
    emoji: "🤑",
    name: "Uzależniony",
    description: "100 wydatków. Czy Ty w ogóle śpisz, czy tylko wydajesz?",
    condition: (s) => s.totalExpenses >= 100,
    tier: "silver",
  },
  {
    id: "kardashian",
    emoji: "💅",
    name: "Kardashian",
    description: "250 wydatków. Twój styl życia wymaga osobnego budżetu.",
    condition: (s) => s.totalExpenses >= 250,
    tier: "gold",
  },
  {
    id: "bezos",
    emoji: "🚀",
    name: "Mini Bezos",
    description: "500 wydatków. Może czas na własną rakietę?",
    condition: (s) => s.totalExpenses >= 500,
    tier: "gold",
  },
  {
    id: "legend",
    emoji: "🏆",
    name: "Legenda Budżetu",
    description: "1000 wydatków. Jesteś żywą encyklopedią finansów domowych.",
    condition: (s) => s.totalExpenses >= 1000,
    tier: "platinum",
  },

  // --- OCR / RECEIPTS ---
  {
    id: "scanner_rookie",
    emoji: "📷",
    name: "Fotograf Paragonów",
    description: "Zeskanowałeś 5 paragonów. Aparat już wie, co robić.",
    condition: (s) => s.ocrExpenses >= 5,
    tier: "bronze",
  },
  {
    id: "scanner_pro",
    emoji: "🔍",
    name: "Detektyw Kasy",
    description: "25 zeskanowanych paragonów. Żaden paragon Ci nie umknie.",
    condition: (s) => s.ocrExpenses >= 25,
    tier: "silver",
  },
  {
    id: "scanner_god",
    emoji: "🤖",
    name: "Cyborg Fiskalny",
    description: "100 paragonów przez OCR. Jesteś bardziej maszyną niż człowiekiem.",
    condition: (s) => s.ocrExpenses >= 100,
    tier: "gold",
  },
  {
    id: "scanner_obsessed",
    emoji: "🧾",
    name: "Kolekcjoner Paragonów",
    description: "250 paragonów. Twoja szuflada jest pusta, ale baza danych pełna.",
    condition: (s) => s.ocrExpenses >= 250,
    tier: "platinum",
  },

  // --- MANUAL ENTRIES ---
  {
    id: "manual_hero",
    emoji: "✍️",
    name: "Pisarz Wydatków",
    description: "20 ręcznych wpisów. Stara szkoła, szacunek.",
    condition: (s) => s.manualExpenses >= 20,
    tier: "bronze",
  },
  {
    id: "manual_monk",
    emoji: "🧘",
    name: "Mnich Budżetowy",
    description: "100 ręcznych wpisów. Medytujesz nad każdą złotówką.",
    condition: (s) => s.manualExpenses >= 100,
    tier: "silver",
  },

  // --- AMOUNT ---
  {
    id: "spender_light",
    emoji: "💸",
    name: "Lekka Ręka",
    description: "Wydałeś łącznie ponad 1 000 zł. Zaczyna się robić poważnie.",
    condition: (s) => s.totalAmount >= 100000,
    tier: "bronze",
  },
  {
    id: "spender_medium",
    emoji: "🛍️",
    name: "Shopaholic",
    description: "Ponad 10 000 zł w systemie. Sklepy Cię kochają.",
    condition: (s) => s.totalAmount >= 1000000,
    tier: "silver",
  },
  {
    id: "spender_heavy",
    emoji: "🏦",
    name: "Bankier Domowy",
    description: "Ponad 50 000 zł. Może czas na własny bank?",
    condition: (s) => s.totalAmount >= 5000000,
    tier: "gold",
  },
  {
    id: "spender_whale",
    emoji: "🐋",
    name: "Wieloryb",
    description: "Ponad 100 000 zł. Jesteś wielorybem domowych finansów.",
    condition: (s) => s.totalAmount >= 10000000,
    tier: "platinum",
  },

  // --- STREAK ---
  {
    id: "streak_3",
    emoji: "🔥",
    name: "Rozgrzany",
    description: "3 dni z rzędu z wydatkami. Ogień w portfelu!",
    condition: (s) => s.streak >= 3,
    tier: "bronze",
  },
  {
    id: "streak_7",
    emoji: "⚡",
    name: "Tygodniowy Maniak",
    description: "7 dni z rzędu. Tydzień bez przerwy — imponujące.",
    condition: (s) => s.streak >= 7,
    tier: "silver",
  },
  {
    id: "streak_30",
    emoji: "🌙",
    name: "Miesięczny Obsesjonat",
    description: "30 dni z rzędu. Czy Ty w ogóle masz wolne?",
    condition: (s) => s.streak >= 30,
    tier: "gold",
  },
  {
    id: "streak_100",
    emoji: "💯",
    name: "Sto Dni Chwały",
    description: "100 dni z rzędu. Psychiatra na linii.",
    condition: (s) => s.streak >= 100,
    tier: "platinum",
  },

  // --- FUNNY SPECIAL ---
  {
    id: "ocr_lover",
    emoji: "😍",
    name: "Zakochany w OCR",
    description: "Ponad 80% Twoich wydatków to skany. Aparat to Twój najlepszy przyjaciel.",
    condition: (s) =>
      s.totalExpenses >= 10 && s.ocrExpenses / s.totalExpenses > 0.8,
    tier: "silver",
  },
  {
    id: "manual_purist",
    emoji: "🖊️",
    name: "Purytanin",
    description: "Ponad 80% wpisów ręcznie. Technologia? Nie, dziękuję.",
    condition: (s) =>
      s.totalExpenses >= 10 && s.manualExpenses / s.totalExpenses > 0.8,
    tier: "silver",
  },
  {
    id: "night_owl",
    emoji: "🦉",
    name: "Nocna Sowa",
    description: "Pierwsze kroki w aplikacji. Sowa budżetowa.",
    condition: (s) => s.totalExpenses >= 5,
    tier: "bronze",
  },
  {
    id: "big_spender_day",
    emoji: "🎰",
    name: "Hazardzista",
    description: "Łącznie ponad 5 000 zł. Kasyno domowe otwarte.",
    condition: (s) => s.totalAmount >= 500000,
    tier: "silver",
  },
];

export const TIER_COLORS: Record<Badge["tier"], string> = {
  bronze: "from-[#cd7f32] to-[#a0522d]",
  silver: "from-[#c0c0c0] to-[#808080]",
  gold: "from-[#ffd700] to-[#b8860b]",
  platinum: "from-[#e5e4e2] to-[#9e9e9e]",
};

export const TIER_BG: Record<Badge["tier"], string> = {
  bronze: "bg-[#fdf0e6]/70 backdrop-blur-sm border-[#e8b88a]/60",
  silver: "bg-[#f5f5f5]/70 backdrop-blur-sm border-[#c0c0c0]/60",
  gold: "bg-[#fffbe6]/70 backdrop-blur-sm border-[#ffd700]/60",
  platinum: "bg-[#f0f0f8]/70 backdrop-blur-sm border-[#b0b0d0]/60",
};

export const TIER_LABEL: Record<Badge["tier"], string> = {
  bronze: "Brąz",
  silver: "Srebro",
  gold: "Złoto",
  platinum: "Platyna",
};

export function getEarnedBadges(stats: UserStats): Badge[] {
  return ALL_BADGES.filter((b) => b.condition(stats));
}

export function getNextBadges(stats: UserStats): Badge[] {
  return ALL_BADGES.filter((b) => !b.condition(stats)).slice(0, 3);
}
