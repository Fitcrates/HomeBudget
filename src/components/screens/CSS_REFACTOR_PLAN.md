# 🎨 HomeBudget — Plan refaktoringu CSS / komponentów

> **Cel:** Wyciągnąć powtarzające się wzorce tailwind do reusable komponentów i klas CSS.  
> Każdą zmianę kolorystyczną / stylową będzie można zrobić w **jednym miejscu** zamiast edytować 15 plików.

---

## 📊 Audyt powtórzeń — mapy ciepła

### 🔴 Najczęściej powtarzane wzorce (10+ wystąpień)

| Wzorzec | Gdzie | Ile razy |
|---------|-------|----------|
| `bg-white/40 backdrop-blur-xl border border-white/50 ... shadow-[0_8px_32px_rgba(180,120,80,0.15)]` | Karta główna (app-card) | **~25x** w 14 plikach |
| `text-[11px] font-bold text-[#b89b87] uppercase tracking-wider` | Label formularza | **~30x** w 12 plikach |
| `w-full ... bg-white/70 ... border border-white/60 rounded-xl px-4 py-3 ... focus:border-[#cf833f] ... font-bold shadow-inner` | Text input | **~20x** w 8 plikach |
| `w-full py-3 bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white rounded-full font-medium ... shadow-... hover:scale-[1.02] active:scale-95 ... disabled:opacity-50` | Przycisk CTA | **~15x** w 10 plikach |
| `h-2 w-full bg-[#f5e5cf] rounded-full overflow-hidden` + child bar | Pasek postępu | **~8x** w 4 plikach |
| `text-[26px] font-medium tracking-tight text-[#2b180a]` | Nagłówek ekranu (h2) | **~10x** w 10 plikach |
| `flex bg-[#fdf9f1] rounded-xl p-1 shadow-[...] gap-1` + aktywny tab z gradientem | Tab bar | **~6x** w 5 plikach |
| `animate-spin rounded-full h-8 w-8 border-b-2 border-[#d87635]` | Spinner ładowania | **~8x** w 6 plikach |
| `rounded-xl border border-white/60 bg-white/50 p-3.5 shadow-sm` | Karta wewnętrzna (wiersz listy) | **~12x** w 5 plikach |
| `text-xs font-bold text-[#cf833f]` | Akcent link tekst | **~10x** w 7 plikach |
| `px-2 py-0.5 rounded-full border text-[10px] font-bold` | Badges roli finansowej | **~8x** w 3 plikach |
| `overflow-hidden rounded-xl border border-[#f2dfcb] bg-[#fff8f2]` | Tabela kompaktowa | **~6x** w 3 plikach |
| Lottie cat loading (cały blok ze spinnerami + DotLottieReact) | Loading overlay | **~4x** w 4 plikach |

### 🟡 Zduplikowane lokalne const (per-plik)

| Plik | Nazwa consta | Identyczny z |
|------|-------------|--------------|
| AddExpenseScreen | `cardStyle`, `labelStyle`, `inputStyle` | ProfileSettingsScreen, OcrScreen |
| OcrScreen | `labelStyle`, `inputStyle`, `shellCard`, `sectionTitle`, `compactTableShell`, `compactHeaderCell`, `compactBodyCell` | DashboardInsightsPanels, ProfileSettings |
| ProfileSettingsScreen | `cardStyle`, `labelStyle`, `inputStyle`, `btnPrimary` | AddExpenseScreen, BudgetSettings |
| BudgetSettingsScreen | `inputStyle`, `cardClass` | AddExpenseScreen |
| IncomeMonitorCard | `cardClass` | DashboardScreen |
| GoalsScreenV2 | `cardClass` | DashboardScreen, IncomeMonitorCard |
| DashboardInsightsPanels | `shellClass` | OcrScreen `shellCard` |
| InsightsCardV2 | `cardClass`, INSIGHT_CARD_STYLES | DashboardInsightsPanels (100% identyczne!) |

### 🔵 Zduplikowane helper functions

| Funkcja | Gdzie powtórzona |
|---------|-----------------|
| `financialRoleLabel()` | HouseholdScreen, BudgetSettingsScreen, ProfileSettingsScreen |
| `financialRoleBadge()` | HouseholdScreen, BudgetSettingsScreen |
| `getTypeLabel()` | InsightsCardV2, DashboardInsightsPanels |
| `INSIGHT_CARD_STYLES` | InsightsCardV2, DashboardInsightsPanels (identyczne!) |
| Progress bar component | BudgetAlertsCard, BudgetSettingsScreen, HouseholdScreen, IncomeMonitorCard, GoalsScreen |

---

## 🏗️ Plan: Nowe reusable komponenty

### 1. `AppCard` — główna karta

**Zastępuje:** `app-card` class + ~25 inline wariantów

```tsx
// components/ui/AppCard.tsx
interface AppCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg'; // p-3.5 | p-5 | p-6
}
```

**Warianty:**
- `AppCard` — standardowa karta (bg-white/40, blur, shadow, border)
- `AppCard.Inner` — karta wewnętrzna (bg-white/50, mniejszy cień)
- `AppCard.Highlight` — karta z kolorowym obramowaniem (np. edytowana pozycja OCR)

**Pliki do refaktoru:** Wszystkie 14 ekranów

---

### 2. `FormLabel` — etykieta formularza

**Zastępuje:** `text-[11px] font-bold text-[#b89b87] uppercase tracking-wider mb-2 ml-1`

```tsx
// components/ui/FormLabel.tsx
interface FormLabelProps {
  children: React.ReactNode;
  htmlFor?: string;
}
```

**Pliki do refaktoru:** AddExpenseScreen, OcrScreen, ProfileSettingsScreen, BudgetSettingsScreen, GoalsScreenV2, HouseholdSetup, IncomeMonitorCard

---

### 3. `FormInput` — pole tekstowe/numeryczne

**Zastępuje:** ~20 inline input className strings

```tsx
// components/ui/FormInput.tsx
interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  size?: 'sm' | 'md' | 'lg'; // text-sm | text-base | text-2xl
  error?: boolean;
}
```

**Pliki do refaktoru:** AddExpenseScreen, OcrScreen, ProfileSettingsScreen, BudgetSettingsScreen, GoalsScreenV2, HouseholdSetup, IncomeMonitorCard, ChatScreen

---

### 4. `FormSelect` — natywny select

**Zastępuje:** select className z OcrScreen

```tsx
// components/ui/FormSelect.tsx
interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  size?: 'sm' | 'md';
}
```

**Pliki do refaktoru:** OcrScreen

---

### 5. `ButtonPrimary` — przycisk główny (CTA)

**Zastępuje:** ~15 gradientowych buttons z shadow/scale

```tsx
// components/ui/ButtonPrimary.tsx
interface ButtonPrimaryProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'danger' | 'ghost';
  fullWidth?: boolean;
  rounded?: 'xl' | 'full';
}
```

**Warianty:**
| variant | Kolor |
|---------|-------|
| `primary` | `from-[#de9241] to-[#ca782a]` — gradient pomarańczowy |
| `danger` | `from-[#e86b58] to-[#d44f43]` — gradient czerwony |
| `ghost` | `bg-white/60 border text-[#6d4d38]` — transparentny z obramowaniem |

**Pliki do refaktoru:** Wszystkie 14 ekranów + HouseholdSetup

---

### 6. `ButtonSecondary` — przycisk drugorzędny

**Zastępuje:** dashed border buttons, outline link buttons

```tsx
// components/ui/ButtonSecondary.tsx
interface ButtonSecondaryProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  variant?: 'outline' | 'dashed' | 'text';
}
```

**Pliki do refaktoru:** OcrScreen, AddExpenseScreen, GoalsScreenV2

---

### 7. `ProgressBar` — pasek postępu

**Zastępuje:** 8 identycznych pasków progressu

```tsx
// components/ui/ProgressBar.tsx
interface ProgressBarProps {
  value: number;       // 0-100
  color?: 'auto' | 'green' | 'orange' | 'red';  // auto = zależy od value
  height?: 'sm' | 'md';  // h-2 | h-3
  showLabel?: boolean;
}
```

- `auto`: <80% = zielony, 80-99% = żółty, 100%+ = czerwony

**Pliki do refaktoru:** BudgetAlertsCard, BudgetSettingsScreen, HouseholdScreen, IncomeMonitorCard, GoalsScreen

---

### 8. `TabBar` — przełącznik zakładek

**Zastępuje:** 6 identyczne bloki tabów z gradientem aktywnym

```tsx
// components/ui/TabBar.tsx
interface TabBarProps<T extends string> {
  tabs: Array<{ key: T; label: string; icon?: React.ComponentType<any> }>;
  value: T;
  onChange: (key: T) => void;
}
```

**Pliki do refaktoru:** DashboardScreen, BadgesScreen, BudgetSettingsScreen, ChatScreen, HouseholdScreen

---

### 9. `ScreenHeader` — nagłówek ekranu

**Zastępuje:** powtarzany wzorzec `<Icon> + <h2 text-[26px]...>` + opcjonalny opis

```tsx
// components/ui/ScreenHeader.tsx
interface ScreenHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onBack?: () => void; // pokazuje strzałkę ←
  action?: React.ReactNode; // prawy narożnik
}
```

**Pliki do refaktoru:** Wszystkie 10 ekranów z nagłówkiem

---

### 10. `Spinner` — loader

**Zastępuje:** 8 identycznych animowanych kółek

```tsx
// components/ui/Spinner.tsx
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'; // h-6 | h-8 | h-12
}
```

**Pliki do refaktoru:** 6+ plików

---

### 11. `CatLoader` — loader z animacją kota Lottie

**Zastępuje:** 4 bloki ze spinnerami + DotLottieReact

```tsx
// components/ui/CatLoader.tsx
interface CatLoaderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg'; // h-24 | h-28 | h-32
}
```

**Pliki do refaktoru:** DashboardScreen, OcrScreen, DashboardInsightsPanels, InsightsCardV2

---

### 12. `StatusBadge` / `RoleBadge` — badge z kolorowym tłem

**Zastępuje:** badges ról finansowych + tagi statusu

```tsx
// components/ui/StatusBadge.tsx
interface StatusBadgeProps {
  variant: 'parent' | 'partner' | 'child' | 'warning' | 'success' | 'info' | 'error';
  children: React.ReactNode;
}
```

**Pliki do refaktoru:** HouseholdScreen, BudgetSettingsScreen, ProfileSettingsScreen, OcrScreen

---

### 13. `CompactTable` — tabela kompaktowa

**Zastępuje:** wzorzec `overflow-hidden rounded-xl border bg-[#fff8f2]` z `<table>`

```tsx
// components/ui/CompactTable.tsx
interface CompactTableProps {
  rows: Array<{ label: string; value: React.ReactNode }>;
}
```

**Pliki do refaktoru:** OcrScreen, DashboardInsightsPanels, InsightsCardV2

---

### 14. `AlertBanner` — banner informacyjny / ostrzegawczy

**Zastępuje:** inline bannery z `AlertTriangle` / `CheckCircle2`

```tsx
// components/ui/AlertBanner.tsx
interface AlertBannerProps {
  variant: 'success' | 'warning' | 'error' | 'info';
  icon?: React.ReactNode;
  children: React.ReactNode;
}
```

**Pliki do refaktoru:** OcrScreen (mismatch sumy), BudgetAlertsCard

---

### 15. `FilterChip` — chip filtra

**Zastępuje:** `FilterChip` z ExpensesScreen (wyciągnięcie do ui/) + chips PeriodSelector + scenariusz chips

```tsx
// components/ui/FilterChip.tsx
interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}
```

**Pliki do refaktoru:** ExpensesScreen, DashboardInsightsPanels, InsightsCardV2

---

## 🗑️ Pliki do **usunięcia / połączenia**

| Plik | Akcja | Powód |
|------|-------|-------|
| `InsightsCardV2.tsx` | **Usunąć** | 100% identyczny z `DashboardInsightsPanels.tsx` (oba eksportują tę samą logikę: InsightsOverviewCard + InsightsScenariosCard z identycznym kodem) |
| `BudgetAlertsCardV2.tsx` | Sprawdzić alias | Nazwa mówi V2, ale importy w DashboardScreen wskazują na `BudgetAlertsCard` — jeśli istnieje V1, usunąć |

---

## 📝 Zmiany w `index.css`

### Stan obecny (linia 35-37):
```css
.app-card {
  @apply w-full rounded-xl border border-white/50 bg-white/40 p-6 
         shadow-[0_8px_32px_rgba(180,120,80,0.15)] backdrop-blur-xl;
}
```

### Proponowane dodanie nowych klas bazowych:

```css
/* ========= DESIGN TOKENS ========= */
:root {
  /* Existing */
  --color-light: #fcf4e4;
  --color-app-top: #ebae69;
  --color-dark: #2e1e0f;
  
  /* NEW — text */
  --text-primary: #2b180a;
  --text-secondary: #6d4d38;
  --text-muted: #8a7262;
  --text-faint: #b89b87;
  
  /* NEW — accent */
  --accent: #cf833f;
  --accent-dark: #ca782a;
  --accent-gradient: linear-gradient(to right, #de9241, #ca782a);
  
  /* NEW — surfaces */
  --surface-card: rgba(255,255,255,0.4);
  --surface-card-inner: rgba(255,255,255,0.5);
  --surface-input: rgba(255,255,255,0.7);
  
  /* NEW — borders */
  --border-card: rgba(255,255,255,0.5);
  --border-input: rgba(255,255,255,0.6);
  --border-subtle: #f5e5cf;
  
  /* NEW — status */
  --color-success: #4aad6f;
  --color-warning: #f59e0b;
  --color-danger: #e86b58;
  
  /* NEW — shadows */
  --shadow-card: 0 8px 32px rgba(180,120,80,0.15);
  --shadow-card-sm: 0 4px 24px rgba(180,120,80,0.1);
  --shadow-cta: 0 4px 16px rgba(200,120,50,0.3);
  
  /* NEW — progress bar */
  --progress-bg: #f5e5cf;
  --progress-green: #67c48a;
  --progress-yellow: #f59e0b;
  --progress-red: #ef4444;
}

/* ========= BASE COMPONENT CLASSES ========= */

.app-card { /* existing - no change */ }

.app-card-inner {
  @apply rounded-xl border border-white/60 bg-white/50 p-3.5 shadow-sm;
}

.app-label {
  @apply block text-[11px] font-bold text-[#b89b87] uppercase tracking-wider mb-2 ml-1;
}

.app-input {
  @apply w-full text-base bg-white/70 backdrop-blur-sm border border-white/60 
         rounded-xl px-4 py-3 outline-none focus:border-[#cf833f] focus:bg-white 
         transition-all text-[#2b180a] font-bold shadow-inner placeholder-[#e0c9b7];
}

.app-input-sm {
  @apply app-input text-sm py-2;
}

.app-btn-primary {
  @apply w-full py-3 bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white 
         rounded-full font-medium text-[14px] shadow-[0_4px_16px_rgba(200,120,50,0.3)] 
         hover:scale-[1.02] active:scale-95 transition-all outline-none disabled:opacity-50;
}

.app-btn-primary-lg {
  @apply app-btn-primary py-4 text-[15px];
}

.app-btn-ghost {
  @apply w-full py-3 rounded-xl border border-[#e6c9b0]/50 bg-white/60 
         backdrop-blur-sm text-[#8a4f2a] font-bold text-[14px] 
         hover:border-[#cf833f]/60 hover:bg-white transition-all shadow-sm;
}

.app-btn-dashed {
  @apply w-full py-3 border-2 border-dashed border-[#d2bcad]/70 text-[#8a7262] 
         bg-white/40 rounded-xl font-bold text-sm 
         hover:border-[#cf833f]/50 hover:bg-white/60 transition-colors;
}

.app-screen-title {
  @apply text-[26px] font-medium tracking-tight text-[#2b180a];
}

.app-spinner {
  @apply animate-spin rounded-full border-b-2 border-[#d87635];
}

.app-tab-bar {
  @apply flex bg-[#fdf9f1] rounded-xl p-1 shadow-[0_4px_12px_rgba(180,120,80,0.1)] gap-1;
}

.app-tab {
  @apply flex-1 py-2.5 rounded-xl text-xs font-bold transition-all 
         flex items-center justify-center gap-1.5;
}

.app-tab-active {
  @apply bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white shadow-sm;
}

.app-tab-inactive {
  @apply text-[#8a7262] hover:text-[#cf833f];
}

.app-progress-track {
  @apply h-2 w-full bg-[#f5e5cf] rounded-full overflow-hidden;
}

.app-section-title {
  @apply text-[10px] font-bold uppercase tracking-[0.18em] text-[#b89b87];
}
```

---

## 📂 Sugerowana struktura `components/ui/` po refaktorze

```
components/ui/
├── AlertBanner.tsx          ← NOWY
├── AppCard.tsx              ← NOWY
├── BadgeEmblem.tsx          (istniejący)
├── BadgeUnlockOverlay.tsx   (istniejący)
├── ButtonPrimary.tsx        ← NOWY
├── ButtonSecondary.tsx      ← NOWY
├── CatLoader.tsx            ← NOWY
├── CompactTable.tsx         ← NOWY
├── ConfirmDialog.tsx        (istniejący)
├── DynamicIcon.tsx          (istniejący)
├── FilterChip.tsx           ← NOWY (przeniesiony z ExpensesScreen)
├── FormInput.tsx            ← NOWY
├── FormLabel.tsx            ← NOWY
├── FormSelect.tsx           ← NOWY
├── IconTrashButton.tsx      (istniejący)
├── PeriodSelector.tsx       (istniejący)
├── ProgressBar.tsx          ← NOWY
├── ScreenHeader.tsx         ← NOWY
├── Spinner.tsx              ← NOWY
├── StatusBadge.tsx          ← NOWY
├── TabBar.tsx               ← NOWY
├── icons/
│   └── ... (istniejące)
```

---

## 📋 Plan refaktoru per-plik (priorytet)

### Faza 1 — Fundamenty (bez zmian wizualnych)

| Krok | Co | Opis |
|------|----|------|
| 1.1 | `index.css` | Dodać CSS custom properties + nowe klasy bazowe |
| 1.2 | `AppCard.tsx` | Stworzyć komponent karty |
| 1.3 | `FormLabel.tsx` + `FormInput.tsx` | Stworzyć pola formularza |
| 1.4 | `ButtonPrimary.tsx` | Stworzyć przycisk CTA |
| 1.5 | `Spinner.tsx` + `CatLoader.tsx` | Stworzyć loadery |
| 1.6 | `TabBar.tsx` | Stworzyć tab bar |
| 1.7 | `ScreenHeader.tsx` | Stworzyć nagłówek ekranu |
| 1.8 | `ProgressBar.tsx` | Stworzyć pasek postępu |
| 1.9 | `StatusBadge.tsx` | Stworzyć badge statusu |
| 1.10 | Helpers: `financialRole.ts` | Wyciągnąć `financialRoleLabel/Badge` do `lib/` |

### Faza 2 — Migracja ekranów (po kolei)

| Krok | Plik | Zmiany |
|------|------|--------|
| 2.1 | `ProfileSettingsScreen.tsx` | Najprostszy — swap consty na komponenty |
| 2.2 | `AddExpenseScreen.tsx` | Swap `cardStyle/labelStyle/inputStyle` + button |
| 2.3 | `DashboardScreen.tsx` | Swap `cardClass` + TabBar + Spinner |
| 2.4 | `ExpensesScreen.tsx` | Przenieść `FilterChip` do `ui/`, swap spinner |
| 2.5 | `BudgetSettingsScreen.tsx` | TabBar + ProgressBar + FormInput + ButtonPrimary |
| 2.6 | `BudgetAlertsCardV2.tsx` | ProgressBar + AppCard |
| 2.7 | `IncomeMonitorCard.tsx` | AppCard + ProgressBar + FormInput |
| 2.8 | `GoalsScreenV2.tsx` | AppCard + ProgressBar + ScreenHeader + ButtonPrimary |
| 2.9 | `BadgesScreen.tsx` | TabBar + ScreenHeader + Spinner |
| 2.10 | `HouseholdScreen.tsx` | TabBar + ProgressBar + StatusBadge + financialRole helpers |
| 2.11 | `ChatScreen.tsx` | TabBar + FormInput + ButtonPrimary |
| 2.12 | `EmailSetupCard.tsx` | AppCard + ButtonPrimary |
| 2.13 | `HouseholdSetup.tsx` | FormLabel + FormInput + ButtonPrimary |
| 2.14 | `DashboardInsightsPanels.tsx` | AppCard + CatLoader + CompactTable |
| 2.15 | `InsightsCardV2.tsx` | **Usunąć** — duplikat DashboardInsightsPanels |
| 2.16 | `OcrScreen.tsx` | Największy — AppCard + FormLabel + FormInput + FormSelect + ButtonPrimary + CatLoader + AlertBanner + CompactTable + StatusBadge |
| 2.17 | `MainApp.tsx` | ScreenHeader (opcjonalnie) |

### Faza 3 — CSS cleanup

| Krok | Co |
|------|----|
| 3.1 | Usunąć nieużywane consty lokalne (cardClass, labelStyle, inputStyle itd.) |
| 3.2 | Przejrzeć i ujednolicić font-size — `text-[11px]` vs `text-xs` (oba = 12px, ale 11px ≠ xs) |
| 3.3 | Ujednolicić padding kart: `p-5` vs `p-6` vs `p-3.5` → 2 warianty |
| 3.4 | Ujednolicić shadow: `shadow-sm` vs `shadow-[0_8px_32px_...]` → 2 warianty |

---

## ⚠️ Pułapki

1. **`InsightsCardV2.tsx` vs `DashboardInsightsPanels.tsx`** — oba eksportują identyczne INSIGHT_CARD_STYLES, getTypeLabel, shell class i prawie identyczny JSX. Trzeba sprawdzić, który jest importowany i usunąć drugi.

2. **`app-card` class istnieje w CSS** ale wiele plików go NIE używa — zamiast tego powtarzają inline `bg-white/40 backdrop-blur-xl...`. Trzeba albo rozszerzyć `app-card`, albo usunąć i użyć komponentu.

3. **`text-[11px]`** — to NIE jest `text-xs` (który = 12px). Kilka plików mieszają te dwa. Trzeba zdecydować: 11px lub 12px dla labeli.

4. **`font-medium` vs `font-bold` vs `font-semibold`** na przyciskach CTA — różne ekrany używają różnych grubości. Trzeba ujednolicić.

5. **Rounded shapes** — CTA buttons: część `rounded-full`, część `rounded-xl`. Trzeba wybrać jeden styl.

---

## 📈 Szacowany zysk

| Metryka | Przed | Po |
|---------|-------|----|
| Pliki z inline tailwind > 200 znaków | ~14 | ~2-3 |
| Unikalne consts `cardStyle/labelStyle/inputStyle` | ~12 | 0 |
| Duplikaty `financialRoleLabel()` | 3 | 1 (w `lib/`) |
| Duplikaty loadera lottie | 4 | 1 (`CatLoader`) |
| Duplikat całego pliku | 1 (InsightsCardV2 ≈ DashboardInsightsPanels) | 0 |
| Średnia zmiana stylu karty | edytuj 14 plików | edytuj 1 (`AppCard.tsx` lub `index.css`) |
| Średnia zmiana przycisku CTA | edytuj 10 plików | edytuj 1 (`ButtonPrimary.tsx`) |
