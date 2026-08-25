# Architektura wielorynkowa (i18n + OCR) — spec

> Data: 2026-08-25
> Status: w realizacji (Faza 1)
> Poprzednie dokumenty OCR: `OCR_CATEGORY_STRATEGY_2026-04-29.md`, `OCR_RELIABILITY_PLAN_2026-04-26.md`

## Cel

Aplikacja ma obsługiwać więcej niż jeden kraj — na start Polskę i drugi rynek —
bez rozgałęziania logiki `if (Polska)` po całym kodzie. Dokument opisuje, co jest
dziś przywiązane do polskiego rynku, jaka jest architektura docelowa i w jakiej
kolejności do niej dochodzimy.

Zakres to **backend i pipeline OCR**. Tłumaczenie warstwy prezentacji (stringi w
komponentach) jest osobnym, równoległym zadaniem i nie blokuje tego planu — poza
jednym punktem styku: nazwy kategorii, które dziś pełnią rolę identyfikatorów.

## Nie-cele

- Nie budujemy pełnego frameworka i18n dla frontendu w tej fazie.
- Nie wspieramy rynków spoza Europy w fazach 1–4 (USA wymaga osobnego modelu
  podatku od sprzedaży — patrz „Ryzyka").
- Nie zmieniamy modeli AI ani strategii tierowania.

## Diagnoza: sześć warstw sprzężenia z Polską

| # | Warstwa | Gdzie | Charakter problemu |
|---|---------|-------|--------------------|
| 1 | Prompt ekstrakcji | `convex/ocr/prompt.ts` | Reguły po angielsku, ale realia polskie (`SUMA PLN`, `KAUCJA`, `DO ZAPŁATY`, Lidl Plus, „cena po rabacie" w Biedronce). Prompt audytowy w całości po polsku. |
| 2 | Klasyfikatory linii | `convex/ocr/normalization.ts` | Rabat / kaucja / linia techniczna rozpoznawane polskimi rdzeniami. `Pfand` i `Rabatt` nie zostaną rozpoznane → walidacja sumy rozjeżdża się na każdym paragonie. |
| 3 | Słowniki kategoryzacji | `convex/ocr/categories/**` | ~600 linii polskich rdzeni produktowych + polscy wystawcy (Biedronka, Żabka, Orlen, PKP, Tauron). Poza PL zwracają `null`. |
| 4 | Tożsamość kategorii | `convex/schema.ts`, `convex/seed.ts`, `convex/ocr/categories/constants.ts` | Kategoria nie ma klucza — identyfikatorem jest polska nazwa wyświetlana. Przetłumaczenie UI zrywa kategoryzację. |
| 5 | Waluta | `convex/ocr/parser.ts` | Każda waluta przeliczana na PLN po kursie NBP, `household.currency` nie bierze udziału. Poza PL kwoty są po prostu błędne. |
| 6 | Normalizacja tekstu | `convex/ocr/utils.ts` | `stripDiacritics` + `[^a-z0-9]` — pismo niełacińskie redukuje się do pustego stringa; deduplikacja i mapowania użytkownika przestają działać. |

Warstwę 1 poprawia mocniejszy model. Warstw 2–6 nie poprawia żadna zmiana modelu.

## Architektura docelowa

```
household { country, language, currency }
        │
        ├─ katalog kategorii ──► klucze (locale-independent) + etykiety per język
        │                        convex/catalog/defaultCatalog.ts
        │
        └─ market pack (per country) ──► wystawcy, leksykon rabat/kaucja/linia
                                          techniczna, słowa sum, schemat kaucji,
                                          hinty do promptu
                    │
                    ▼
        pipeline OCR (bez wiedzy o konkretnym kraju)
```

Dwie zasady:

1. **Klucz jest identyfikatorem, nazwa jest prezentacją.** Nic w logice nie
   porównuje nazw wyświetlanych.
2. **Wiedza rynkowa jest danymi, nie kodem.** Dodanie kraju to dodanie pakietu,
   nie modyfikacja pipeline'u. Brak pakietu = pipeline działa w trybie
   „tylko model + mapowania użytkownika", nie wywala się.

## Model danych — zmiany

### `categories` / `subcategories`

```
key: v.optional(v.string())   // NOWE — stabilny identyfikator, np. "food",
                              // "food_supermarket"
```

Pole jest opcjonalne, bo istniejące wiersze go nie mają. Backfill dzieje się przy
synchronizacji katalogu (patrz „Migracja"). Kategorie utworzone ręcznie przez
użytkownika pozostają bez klucza — to poprawny stan, heurystyki ich nie dotyczą.

Klucz podkategorii jest złożony: `${categoryKey}_${suffix}`. Dzięki temu
„Akcesoria" w ubraniach i w zwierzętach to dwa różne byty
(`clothing_accessories`, `pets_accessories`), a nie jedna nazwa rozstrzygana
kontekstem.

### `households`

```
language: v.optional(v.string())  // NOWE — "pl" | "en", język etykiet katalogu
country:  v.optional(v.string())  // NOWE — ISO 3166-1 alpha-2, wybór market packa
```

Brak wartości = `pl`/`PL`, czyli zachowanie dzisiejsze.

## Migracja

`syncDefaultCatalog` jest wywoływany przy każdym wejściu do aplikacji
(`MainApp.tsx`), więc backfill kluczy jedzie tą samą ścieżką — bez osobnego
uruchamiania migracji i bez okna, w którym dane są w połowie przekonwertowane:

1. Dopasuj istniejące wiersze po `key`, jeśli już mają.
2. Jeśli nie mają — dopasuj po znormalizowanej nazwie do etykiet katalogu we
   **wszystkich** językach i uzupełnij `key`.
3. Dopiero czego nie da się dopasować — wstaw jako nowy wiersz.

Krok 2 jest tym, co chroni przed duplikatami przy zmianie języka gospodarstwa.
Kolejność jest istotna: gdyby sync dopasowywał tylko po nazwie, zmiana języka
podwoiłaby katalog.

## Fazy

### Faza 1 — klucze kategorii (fundament) ✅ w tym commicie

- `convex/catalog/defaultCatalog.ts`: jedno źródło prawdy — 15 kategorii,
  116 podkategorii, każda z kluczem, ikoną i etykietami `pl`/`en`.
- `schema.ts`: `key` na obu tabelach, `language`/`country` na gospodarstwie.
- `seed.ts`: sianie z katalogu w języku gospodarstwa + backfill kluczy.
- `ocr/categories/constants.ts`: `CATEGORY`/`SUB` trzymają klucze i sufiksy;
  `resolve()` szuka po kluczu, z awaryjnym dopasowaniem po nazwie dla wierszy
  jeszcze niezmigrowanych.
- `parser.ts`: fallback celuje w `other` / `other_misc` zamiast w „inne"/„rozne".

Kryterium odbioru: dla polskiego gospodarstwa wynik kategoryzacji jest
identyczny jak przed zmianą; ~600 linii matcherów w `categories/**` pozostaje
nietkniętych.

**Weryfikacja (wykonana):**

| Sprawdzenie | Wynik |
|---|---|
| Katalog vs dotychczasowy seed (nazwy, ikony, kolory, kolejność) | 15/15 kategorii i 116/116 podkategorii identycznych |
| Unikalność kluczy | brak duplikatów wśród 15 + 116 |
| Wszystkie wywołania `resolve(CATEGORY.x, SUB.y)` w matcherach | 160/160 składa się na istniejący klucz katalogu |
| Sync na bazie sprzed migracji | 131 kluczy uzupełnionych, **0 wstawień, 0 zmian nazw** |
| Powtórny sync | w pełni idempotentny (0 zmian) |
| Heurystyki dla wiersza bez klucza / z kluczem / z etykietami EN | identyczny wynik we wszystkich trzech kształtach |

### Faza 2 — locale gospodarstwa 🔶 częściowo

Zrobione: pola `language`/`country`, wykrywanie locale przeglądarki przy
zakładaniu domu (`src/lib/locale.ts`), mutacja `households.updateLocale`
przesiewająca katalog po zmianie języka.

Zostaje: ekran wyboru języka. Świadomie wstrzymany — dopóki interfejs jest
polski, przełączenie na `en` dałoby angielskie kategorie w polskim UI. Wchodzi
razem z i18n frontendu.

- Kryterium odbioru: przełączenie `pl`→`en` zmienia nazwy i nie tworzy ani
  jednego nowego wiersza. **Zweryfikowane w symulacji: 120 zmian nazw**
  (11 etykiet jest identycznych w obu językach), **0 wstawień**, powrót na `pl`
  odtwarza nazwy co do znaku.

### Faza 3 — waluta ✅

- `convex/ocr/exchangeRates.ts`: kurs krzyżowy przez tabelę A NBP
  (`X → Y = (X → PLN) / (Y → PLN)`), więc para bez złotówki (EUR → CZK) też
  działa bez dokładania drugiego dostawcy.
- Przeliczanie do `household.currency`, nie do PLN.
- Ślad przeliczenia przy wydatku: `originalAmount`, `originalCurrency`,
  `exchangeRate`, `exchangeRateDate`.
- Nieudane pobranie kursu zwraca `null`, nigdy 1.0 — kwoty zostają w walucie
  paragonu, a ekran pokazuje ostrzeżenie.
- Klucz cache OCR zawiera walutę gospodarstwa, więc jej zmiana unieważnia
  zapisane wyniki.

**Weryfikacja (na żywym API NBP):** PLN→PLN = 1.0 bez zapytania,
EUR→PLN = 4,3046 (2026-08-25), PLN→EUR = 0,2323, kurs krzyżowy EUR→CZK = 24,09,
nieznana waluta → `null`, iloczyn kursów odwrotnych = 1 z dokładnością do 1e-9.

### Faza 4 — market packs ✅

- `convex/markets/{types,pl,de,generic,index}.ts`.
- Leksykon (rabat, kaucja, linia techniczna, linia rabatowa jednowierszowa,
  stop-słowa) i hinty promptu wybierane po `household.country`.
- Kraj bez pakietu dostaje pakiet generyczny — pipeline działa dalej.

**Weryfikacja:** 36/36 sprawdzeń leksykonu PL zgodnych z regexami sprzed
refaktoru; 8/8 dla DE; „Kaucja" nie wpada w pakiet DE, „Pfand" nie wpada w PL;
`FR` i brak kraju schodzą do pakietu generycznego.

### Faza 5 — prompt ✅

- Rdzeń `EXTRACTION_PROMPT` neutralny rynkowo; specyfika sieci i nagłówków sum
  dostaje własną sekcję `MARKET NOTES` budowaną z pakietu.
- Prompt audytowy: rusztowanie po angielsku, instrukcje merytoryczne z pakietu.
  Dla PL są to **dosłownie te same polskie linie** co wcześniej — audyt był pod
  nie strojony, więc tłumaczenie ich w ciemno byłoby zmianą zachowania modelu
  bez sposobu na weryfikację (patrz Faza 6).
- `buildQueuedScanSummary` używa waluty gospodarstwa zamiast zaszytego „PLN".

### Faza 6 — korpus testowy

- Kilkanaście paragonów na rynek z oczekiwaną sumą i liczbą pozycji.
- Bazuje na `ocrLogs`, które już zbierają dane.

## Przegląd kodu po Fazach 1–5 (2026-08-25)

Krytyczny przegląd własnych zmian wykrył 12 usterek; wszystkie naprawione w tym
samym commicie. Trzy były regresjami wprowadzonymi przez sam refaktor:

| # | Problem | Poprawka |
|---|---------|----------|
| 1 | Szablon promptu miał zaszyte `"currency": "PLN"`, a parser od Fazy 3 ufa temu polu przy wyborze kursu — echo z szablonu skalowało cały paragon | `{{CURRENCY}}` podstawiane walutą docelową + jawna reguła „nigdy nie kopiuj kodu z szablonu" |
| 2 | Nowe leksykony DE/generic bez granic słów: „Cashew", „Cardamom", „Taxi", „Kruste" uznawane za linie techniczne i wycinane | Granice dobrane pod morfologię: pełne dla krótkich/kolizyjnych, prefiksowe dla polskiej odmiany i niemieckich złożeń |
| 3 | Skan do wyjazdu przeliczany na walutę domu, a wyjazd ma własną walutę | `targetCurrency` przez akcję do parsera; pole `householdCurrency` przemianowane na `targetCurrency`, bo mylna nazwa była źródłem błędu |
| 4 | Nieudane pobranie kursu zapisywało obce kwoty jako walutę domu, bez śladu | Pozycje dostają `originalCurrency`, komunikat mówi wprost, co zostanie zapisane |
| 5 | Klucz cache OCR pomijał kraj, czyli market pack | Kraj i waluta docelowa w odcisku palca |
| 6 | Nieobsługiwany język przeglądarki schodził do polskiego | Schodzi do angielskiego; brak deklaracji nadal = polski (zgodność wstecz) |
| 7 | Błędny kod kraju cicho stawał się „PL" | Odrzucany wyjątkiem; brak wartości nadal domyślnie PL |
| 8 | `getSettingsInternal` odpytywane 5+ razy na skan | Jeden `OcrRunContext` na przebieg, wstrzykiwany do parsera i audytu |
| 9 | Sufiks klucza cięty po pierwszym `_` | Cięty względem klucza kategorii |
| 10 | Wiersze rabatowe bez śladu waluty | `buildDiscountLineItem` przyjmuje kwotę oryginalną |
| 11 | Martwy parametr `compactCategories` w audycie | Zastąpiony kontekstem przebiegu |
| 12 | Martwe eksporty `matchesLexicon`, `catalogKeys` | Usunięte |

## Ryzyka

- **USA/Kanada: ceny netto.** Reconciliation „suma pozycji vs suma paragonu"
  zakłada ceny brutto. Na paragonie amerykańskim każdy skan zaraportuje rozjazd
  i odpali kosztowny audyt drugim modelem. Wymaga pojęcia linii podatku w
  schemacie wyniku — poza zakresem faz 1–5.
- **Systemy kaucyjne są lokalne** (PL kaucja, DE Pfand, SE pant, UK DRS) — każdy
  to osobny wzorzec i osobna decyzja, czy kwota wchodzi do `payableAmount`.
- **Pismo niełacińskie** (grecki, cyrylica) wymaga zmiany `stripDiacritics` i
  tokenizacji, inaczej mapowania użytkownika cicho przestają działać.
- **`convex/migrations.ts`** zawiera skopiowany, nieaktualny katalog z czasów
  migracji ikon. Po Fazie 1 jest martwy i powinien zniknąć, żeby nie stał się
  drugim źródłem prawdy.
