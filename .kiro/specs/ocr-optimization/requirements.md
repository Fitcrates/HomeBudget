# OCR Optimization - Wymagania

## Cel projektu

Optymalizacja systemu OCR w aplikacji HomeBudget w celu:
1. Zmniejszenia czasu przetwarzania paragonów z wieloma zdjęciami (z 40-80s do <10s)
2. Poprawy dokładności ekstrakcji danych przy długich paragonach
3. Naprawy błędnego przypisywania kategorii dla specyficznych typów transakcji (np. "Odziez UZYW")

## Problemy do rozwiązania

### Problem 1: Bardzo długi czas przetwarzania dla 2+ zdjęć
- **Obecnie**: 40-80 sekund dla 2 zdjęć długiego paragonu
- **Oczekiwane**: <10 sekund niezależnie od liczby zdjęć (do 3)
- **Przyczyna**: Zbyt wiele wywołań AI (nawet 5-7 dla problematycznych paragonów)

### Problem 2: Błędne ceny i pominięte pozycje
- **Obecnie**: Przy długich paragonach model często gubi kontekst
- **Oczekiwane**: Dokładna ekstrakcja wszystkich pozycji niezależnie od długości paragonu
- **Przyczyna**: Jeden prompt obsługujący wszystkie przypadki, zbyt skomplikowany prompt

### Problem 3: Błędna kategoryzacja "Odziez UZYW"
- **Obecnie**: Przypisuje do "Inne" zamiast "Ubrania i obuwie > Odzież"
- **Oczekiwane**: Prawidłowe rozpoznanie używanej odzieży
- **Przyczyna**: Brak heurystyk wykrywających "używaną" odzież

## Wymagania funkcjonalne

### Wymaganie 1: Szybsze przetwarzanie wielu obrazów
- System musi przetwarzać obrazy równolegle (async per-obraz)
- Maksymalny czas przetwarzania: 10 sekund dla 3 obrazów
- Liczba wywołań AI: maksymal 3 niezależnie od liczby obrazów

### Wymaganie 2: Uproszczony prompt ekstrakcyjny
- Prompt ma być zwięzły i skupiony na ekstrakcji
- Zachować wielojęzyczność (polski, angielski, niemiecki)
- Zachować dokładność ekstrakcji cen i produktów

### Wymaganie 3: Poprawa kategoryzacji
- Dodanie wykrywania używanej odzieży (UŻYW, USED, second-hand, outlet)
- Dodanie wykrywania dziecięcej używanej odzieży
- Zachowanie istniejących heurystyk kategoryzacji

### Wymaganie 4: Inteligentne retry
- Retry ma być uruchamiane tylko gdy jest to naprawdę potrzebne
- Dla prostych paragonów (1 zdjęcie, krótki paragon): brak retry
- Dla złożonych przypadków: maksymal 1 retry z modelem "smart"

## Wymagania niefunkcjonalne

### Wydajność
- Czas przetwarzania 1 obrazu: <3 sekundy
- Czas przetwarzania 2-3 obrazów: <10 sekund
- Timeout pojedynczego wywołania AI: 30 sekund

### Dokładność
- Extrakcja cen: >95% poprawnych
- Extrakcja nazw produktów: >90% poprawnych
- Kategoryzacja: >85% trafnych

### Stabilność
- Obsługa błędów API (rate limit, timeout)
- Fallback do wyniku częściowego w przypadku awarii
- Logowanie czasów dla diagnostyki

## Przypadki użycia

### Przypadek 1: Krótki paragon (1 zdjęcie)
- Użytkownik robi zdjęcie pojedynczego paragonu
- System przetwarza w <3 sekundy
- Brak dodatkowych wywołań retry

### Przypadek 2: Długi paragon (2-3 zdjęcia)
- Użytkownik dodaje 2-3 zdjęcia tego samego paragonu
- System przetwarza równolegle, then łączy wyniki
- Maksymalnie 1 retry jeśli suma się nie zgadza

### Przypadek 3: Używana odzież
- Użytkownik skanuje paragon z "Odziez UZYW" lub "Second Hand"
- System prawidłowo kategoryzuje do "Ubrania i obuwie > Odzież"

### Przypadek 4: Paragon zagraniczny (angielski)
- Użytkownik skanuje paragon np. z Niemiec lub UK
- System poprawnie extraktuje dane niezależnie od języka

## Mechanizm uczenia się (Learning)

System posiada mechanizm uczenia się oparty na korektach użytkownika:

### Obecna implementacja (productMappings.ts)
- `upsertMapping` - zapisuje korekty użytkownika do tabeli `product_mappings`
- `lookupMappingsBatch` - sprawdza zapamiętane mapowania podczas OCR
- `usageCount` - licznik użycia danego mapowania
- **Ograniczenie**: Tylko dokładne dopasowanie (exact match)

### Wymaganie dot. uczenia
- System ma priorytetowo używać zapamiętanych mapowań przed AI
- Używać `usageCount` do sortowania (najczęściej używane first)
- Rozważyć fuzzy matching dla podobnych nazw (opcjonalne)

## Kryteria akceptacji

1. ✅ Czas przetwarzania 2 zdjęć spadł z 40-80s do <10s
2. ✅ Paragon "Odziez UZYW" jest kategoryzowany do "Ubrania i obuwie > Odzież"
3. ✅ Dokładność ekstrakcji cen nie pogorszyła się
4. ✅ Wielojęzyczność (EN, DE, PL) działa poprawnie
5. ✅ Logowanie czasów pozwala diagnozować problemy
6. ✅ Korekty użytkownika są zapisywane i używane przy kolejnych skanowaniach