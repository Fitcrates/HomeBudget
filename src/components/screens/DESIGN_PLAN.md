# 📱 HomeBudget — Plan przeprojektowania (Mobile-First)

> **Priorytet:** AddExpenseScreen, OcrScreen  
> **Zasada:** UI musi być użyteczny w 100% bez scrollowania dla kluczowych akcji. Ekran telefonu = 844px lub mniej.

---

## 🔍 Analiza obecnego stanu

### MainApp.tsx — szkielet
- Kontener `max-w-[420px] h-dvh flex flex-col` — dobry punkt startowy
- Nawigacja dolna `fixed bottom-0` — OK
- **Problem:** `main` ma `pb-28` i `space-y-6` — dużo wielu padowania "zgadniętego", przez co ekrany zaczynają się za wysoko lub treść jest zbyt kompaktowa
- Górny header z `⚙️ Dom` to jedyny stały element — minimalistyczny, ale przez to dezorientujący (brak tytułu ekranu)

### AddExpenseScreen.tsx
**Problemy:**
1. Formularz to długa lista scrollowana od góry do dołu → na telefonie użytkownik scrolluje przez 4 sekcje zanim dotrze do przycisku "Dodaj"
2. Sekcja "Dowód zakupu" jest na górze — redundantna z OcrScreen. Powinna być opcją drugorzędną
3. Pole "Kwota" (`text-3xl`) jest duże ale gubione w środku formularza
4. Kategorie (accordion) to ostatni element — użytkownik musi scrollować żeby zobaczyć błąd walidacji
5. Brak postępu / wskaźnika co jest wymagane a co opcjonalne
6. Checkbox subskrypcji wciśnięty w środek karty bez wyraźnego kontekstu

### OcrScreen.tsx (~1273 linie!)
**Problemy:**
1. Zbyt rozbudowany — 3 opisowe sekcje "Krok 1/2/3" z długimi opisami tekstowymi zjadają przestrzeń
2. Tabela metryk statystycznych (Pliki/Pozycje/Status) jest nieprzydatna dla użytkownika mobilnego
3. Źródła zdjęć (3 kafelki Aparat/Galeria/Dokument) + "Dodaj kolejny kadr" = zbędna złożoność
4. Po OCR lista pozycji jest pełnoekranowa z oddzielnymi kartami — bardzo ciężka na scrollowanie
5. Długie opisy pomocnicze przy każdym kroku
6. Przyciski Akcje/Sparkles na każdej pozycji są za małe na palec
7. Select kategoria + select podkategoria zajmują dużo przestrzeni

---

## 🎨 Design System (utrzymać istniejący)

| Token | Wartość |
|-------|---------|
| Tło gradientowe | `from-[#ebae69] via-[#faebcd] to-[#fcf4e4]` |
| Akcent główny | `#ca782a` / `#de9241` |
| Tekst główny | `#2b180a` |
| Tekst drugorzędny | `#6d4d38` / `#8a7262` |
| Karta | `bg-white/40 backdrop-blur-xl border border-white/50` |
| Radius | `rounded-xl` (karty), `rounded-full` (CTA) |
| Zielony sukcesu | `#4aad6f` / `#46825d` |

**Czcionka:** Inter / system-ui — bez zmian  
**Cień CTA:** `shadow-[0_8px_20px_rgba(200,100,50,0.3)]`

---

## 📐 Layout — AddExpenseScreen

### Cel: cała kluczowa akcja w viewporcie

```
┌─────────────────────────────────────────┐  ← 0px
│  [←]  💰 Nowy wydatek                  │  header (48px)
├─────────────────────────────────────────┤
│  ┌──────────────────────────────────┐   │
│  │         KWOTA (hero input)       │   │
│  │   [ 0.00              PLN ]      │   │  ~80px
│  └──────────────────────────────────┘   │
│                                          │
│  [Data: dziś]          [Opis (opt)]     │  ~52px (dwa pola obok siebie)
│                                          │
│  ══ KATEGORIA ══════════════════════    │
│  [ 🛒 Jedzenie ] [ 🏠 Dom ] [ 🚗 Auto ] │  Chip grid 2x3 (nie accordion!)
│  [ 🎭 Rozrywka] [ 💊 Zdrowie] [...]    │  ~120px
│  ┌──── Podkategoria ────────────────┐   │  Pojawia się po wyborze
│  │ [chip1] [chip2] [chip3] ...      │   │  ~56px
│  └──────────────────────────────────┘   │
│                                          │
│  ┌─ Opcje ─────────────────────────┐   │
│  │ ☐ To jest subskrypcja           │   │  ~44px
│  └──────────────────────────────────┘   │
│                                          │
│  [🔍 Skanuj paragon] [📎 Załącz]       │  Drugorzędne akcje ~48px
│                                          │
│  [   ✅  DODAJ WYDATEK   ]             │  CTA button ~52px
└─────────────────────────────────────────┘  ← ~440px końcowy
```

### Kluczowe zmiany:
1. **Kwota jako hero** — największy element, widoczny od razu, w górze, duży placeholder
2. **Kategorie jako chip grid** zamiast accordion — wszystkie kategorie widoczne, wybranie otwiera podkategorie w jednym rzędzie chips poniżej
3. **Data + Opis w jednym rzędzie** — data po lewej (krótsza, często domyślna), opis po prawej (dłuższa)
4. **Skanuj paragon** → mały link tekstowy/przycisk drugorzędny, nie duża sekcja
5. **Subskrypcja** → toggle switch zamiast checkbox
6. **Przycisk CTA** zawsze widoczny (sticky bottom po formularzu LUB na tyle mała treść że mieści się bez scrolla)

---

## 📐 Layout — OcrScreen

### Cel: 3 stany, każdy zmaksymalizowany

#### Stan 1: Wybór źródła (przed OCR)

```
┌─────────────────────────────────────────┐
│  [←]  🔍 Skaner paragonów              │  header 48px
├─────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐   │
│  │   [ 📷 Aparat ]  [ 🖼 Galeria ]  │   │  Dwa DUŻE przyciski ~120px każdy
│  │   Dotknij żeby sfotografować     │   │  pełna szerokość, widoczne
│  └──────────────────────────────────┘   │
│                                          │
│  [+ Dodaj kolejne zdjęcie (2/3)]       │  Pojawia się jeśli dodano ≥1
│                                          │
│  ┌─ Miniatury ────────────────────  ┐   │  Maksymalnie 3 miniatury 80x80 px
│  │ [img1][img2][img3]               │   │
│  └──────────────────────────────────┘   │
│                                          │
│  [         🤖 ANALIZUJ         ]       │  CTA (aktywny gdy ≥1 plik)
│                                          │
│  Lub dołącz PDF:  [ 📄 Dokument ]      │  Drugorzędne, mniejsze
└─────────────────────────────────────────┘
```

#### Stan 2: Ładowanie OCR

```
┌─────────────────────────────────────────┐
│  [←]  🔍 Skaner paragonów              │
├─────────────────────────────────────────┤
│                                          │
│         [  🐱 animacja lottie  ]        │  Wycentrowana animacja kota
│                                          │
│   Analizuję paragon...                  │  Tekst animowany (pulse)
│   Groq Llama 4 Scout czyta dokument    │  Podtytuł
│                                          │
│   ───────────────────────────────       │  Progress indicator (fake)
│         ████████████░░░░░░░░           │  Pasek postępu
│                  78%                    │
│                                          │
│  ⊗  Anuluj                             │  Opcja wyjścia
└─────────────────────────────────────────┘
```

#### Stan 3: Lista pozycji (po OCR)

```
┌─────────────────────────────────────────┐
│  [←]  🔍 Wynik   ✓ 8 poz.  ⚠ 2 błędy │  Sticky header z metrykami
├─────────────────────────────────────────┤
│  📅 Data paragonu: [  2026-04-18  ]    │  Kompaktowy input daty
│  [Skanuj ponownie]                      │  
├─────────────────────────────────────────┤
│  ┌─ pozycja 1 ──────────────────────┐  │
│  │ Mleko 3.2%          3.49 PLN     │  │  Jedna linia: opis + kwota
│  │ 🏷 [Jedzenie / Nabiał ▾]         │  │  SELECT natywny (mały)
│  └──────────────────────────────────┘  │  
│  ┌─ pozycja 2 ──────────────────────┐  │
│  │ Chleb żytni          4.20 PLN    │  │
│  │ ⚠ [Wybierz kategorię ▾][sub▾]  │  │  Highlight gdy brak kategorii
│  └──────────────────────────────────┘  │
│  ...                                    │
├─────────────────────────────────────────┤ sticky bottom
│  [  💾  ZAPISZ 8 WYDATKÓW  ]          │  Sticky CTA
└─────────────────────────────────────────┘
```

### Kluczowe zmiany:
1. **Usuń tabele statystyk** — zastąp kompaktowym badge na headerze
2. **Długie opisy kroków** — skróć do jednej linii lub usuń
3. **Przyciski pliku** → dwa główne duże (Aparat / Galeria), PDF jako link dodatkowy
4. **Lista pozycji** → kompaktowa (1 wiersz = 1 pozycja), select kategorii widoczny od razu, bez rozwijania
5. **Sticky CTA** w dole przy liście pozycji
6. **Pasek postępu** podczas ładowania OCR
7. **Nagłówek z metrykami** po OCR

---

## 🔧 Zmiany w MainApp.tsx

```
┌─────────────────────────────────────────┐
│  [Tytuł ekranu]           [⚙️ Dom]     │  Stały header z tytułem aktywnego widoku
└─────────────────────────────────────────┘
```

- Pokaż tytuł aktywnego ekranu w headerze (`Dodaj wydatek`, `Wydatki`, `Dashboard`)
- Usuń duplikację tytułu z samych ekranów

---

## 🔧 Zmiany w DashboardScreen.tsx

**Obecny problem:** Duże spacje, header "Cześć Rodzinko" + "Dashboard" to 2 osobne linijki zajmujące ~80px

**Propozycja:**
```
┌─────────────────────────────────────────┐
│  Period: [Miesiąc][Tydzień][...] ←→   │  Kompaktowy selector
├─────────────────────────────────────────┤
│  Łącznie: 4 230,50 PLN   # trans: 47  │  Karta hero w jednej linii
├─────────────────────────────────────────┤
│  [Wykres kołowy]                        │  Pełna szerokość
│  [Wykres słupkowy]                      │  
│  [Alerty budżetu]                       │  
│  [Monitor przychodu]                    │  
└─────────────────────────────────────────┘
```

---

## 🔧 Zmiany w ExpensesScreen.tsx

Ekran wypada dobrze — minor issues:
- Powtórzony `PeriodSelector` + osobny `CalendarIcon` z zakresem dat → zbędna duplikacja
- Można usunąć drugą kartkę z datami

---

## 📋 Priorytet zmian

| Priorytet | Ekran | Zmiana |
|-----------|-------|--------|
| 🔴 Krytyczne | **AddExpenseScreen** | Chip grid kategorii, hero kwota, ukrycie sekcji OCR |
| 🔴 Krytyczne | **OcrScreen** | Uproszczenie kroku 1 (dwa duże przyciski), sticky CTA, kompaktowa lista pozycji |
| 🟡 Ważne | **OcrScreen** | Pasek postępu zamiast loadera, nagłówek z metrykami |
| 🟡 Ważne | **MainApp** | Tytuł ekranu w headerze |
| 🟢 Drobne | **DashboardScreen** | Usunięcie duplikatu nagłówka |
| 🟢 Drobne | **ExpensesScreen** | Usunięcie duplikatu zakresu dat |

---

## ✅ Zasady kluczowe (non-negotiable)

1. **Zero wymaganego scrollowania** dla podstawowej akcji (dodanie wydatku, uruchomienie OCR)
2. **Przyciski CTA** minimum `48px` wysokości, pełna szerokość lub `sticky`
3. **Targets dotykowe** minimum `44x44px` (Apple HIG)
4. **Kategorie** zawsze widoczne — nie chowane za accordion
5. **Loading states** zajmują cały ekran — nie wcinają się między elementy
6. **Kolory** bez zmian — utrzymać obecny warm tonal system
7. **Animacje** zachować (hover scale, fade-in) — są subtelne i premium

---

## 🚀 Co NIE zmienia się

- Logika biznesowa (mutations, queries, Convex)
- Struktura nawigacji (bottom nav 5 ikon)
- Paleta kolorów i tokeny
- Animacja ładowania (lottie kota)
- Toast notifications (Sonner)
- Walidacja formularzy
