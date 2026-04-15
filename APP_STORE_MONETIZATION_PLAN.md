# Plan Monetyzacji I Publikacji

## Cel

Zbudować wersję aplikacji `HomeBudget` gotową do publikacji w Google Play i App Store oraz wdrożyć model monetyzacji, który nie obniży zaufania użytkownika.

## Rekomendowana ścieżka techniczna

Najlepsza ścieżka dla tego projektu to:

1. Zachować obecny frontend React + Vite + Convex.
2. Dodać `Capacitor`, aby wygenerować natywne projekty `android` i `ios`.
3. Traktować PWA jako dodatek, ale sklepy potraktować jako główny kanał dystrybucji.

Dlaczego:

- Google Play i App Store łatwiej monetyzować przez natywne zakupy/subskrypcje.
- Capacitor pozwala zachować większość obecnego kodu.
- W przyszłości łatwiej dodać push notifications, deep linking, biometrics i paywall.

## Model monetyzacji

Najbezpieczniejszy model dla tej aplikacji:

1. `Freemium`
2. `Subskrypcja miesięczna i roczna`
3. Opcjonalnie `7-dniowy trial`

### Co dać za darmo

- ręczne dodawanie wydatków
- podstawowe kategorie
- prosty podgląd historii
- ograniczona liczba skanów OCR miesięcznie

### Co dać w premium

- nielimitowany OCR
- lepsze AI do rozpoznawania i kategoryzacji
- eksport danych
- budżety i alerty
- współdzielenie gospodarstwa domowego
- statystyki i trendy
- backup / historia dłuższa niż podstawowa

### Czego nie polecam na start

- reklam
- jednorazowego zakupu zamiast subskrypcji
- zbyt agresywnego blokowania podstawowych funkcji

## Etapy wdrożenia

### Etap 1. Uporządkowanie produktu

- dopracować onboarding
- dopracować ekran profilu, ustawień i konta
- przygotować politykę prywatności i regulamin
- opisać dokładnie, jakie dane przechowuje OCR i AI
- sprawdzić, czy wszystkie teksty w aplikacji są spójne językowo

### Etap 2. Mobile shell przez Capacitor

- dodać `@capacitor/core`
- dodać `@capacitor/cli`
- uruchomić `npx cap init`
- wygenerować platformy:
  - `npx cap add android`
  - `npx cap add ios`
- skonfigurować ikony, splash screen i bundle IDs

Proponowane identyfikatory:

- Android: `pl.homebudget.app`
- iOS: `pl.homebudget.app`

### Etap 3. Funkcje mobilne

- dodać obsługę bezpiecznego logowania
- dodać deep linki
- dodać obsługę aparatu i galerii pod mobile
- sprawdzić upload zdjęć i PDF na realnych urządzeniach
- dodać analytics zdarzeń produktowych

### Etap 4. Monetyzacja

- wybrać produkt subskrypcyjny:
  - `premium_monthly`
  - `premium_yearly`
- wdrożyć paywall
- zablokować funkcje premium po stronie UI i backendu
- zapisywać status subskrypcji użytkownika w Convex

Na mobile najlepiej użyć zakupów natywnych:

- Google Play Billing
- Apple In-App Purchases

Nie polecam omijania tego przez Stripe wewnątrz aplikacji iOS dla cyfrowych funkcji premium, bo może to zostać odrzucone przez App Store.

### Etap 5. Publikacja

- przygotować listing sklepu
- przygotować screenshoty telefonu
- przygotować ikonę aplikacji
- przygotować opis, słowa kluczowe i kategorię
- zrobić testy:
  - Android Internal Testing
  - iOS TestFlight

## Wymagania sklepów

### Google Play

- konto Google Play Developer
- Data Safety form
- polityka prywatności
- testy przed publikacją

### Apple App Store

- konto Apple Developer
- App Privacy details
- polityka prywatności
- screeny i metadata
- zgodność z zasadami IAP przy subskrypcjach

## Co trzeba zrobić w backendzie

- dodać pole typu `plan` lub `subscriptionStatus` do profilu użytkownika
- dodać limity OCR dla darmowego planu
- dodać serwerową walidację premium
- przygotować webhooki lub synchronizację statusu zakupów

Przykładowe statusy:

- `free`
- `trial`
- `premium`
- `past_due`
- `canceled`

## Ryzyka

- OCR i upload mogą zachowywać się inaczej na iOS i Androidzie niż w przeglądarce desktop
- Apple może zakwestionować model płatności, jeśli funkcje premium będą wyglądały jak cyfrowa usługa omijająca IAP
- bez polityki prywatności i opisu AI/OCR publikacja może utknąć

## Rekomendowana kolejność prac

1. Naprawić UX i teksty w aplikacji.
2. Dodać `Capacitor`.
3. Uruchomić build Android/iOS lokalnie.
4. Przygotować paywall i status subskrypcji.
5. Wdrożyć Google Play Billing i Apple IAP.
6. Wpuścić aplikację na testy wewnętrzne.
7. Dopiero potem robić publiczny release.

## Minimalny plan MVP do sklepów

Jeśli chcesz wejść do sklepów szybko, zakres MVP powinien obejmować:

- logowanie
- dodawanie wydatków
- OCR paragonów
- podstawowe kategorie
- profil użytkownika
- prosty plan premium z limitem OCR
- politykę prywatności

## Następny praktyczny krok

Najrozsądniejszy następny krok techniczny to:

1. dodać `Capacitor`
2. przygotować strukturę pod subskrypcje premium
3. uruchomić pierwszą wersję Android build

Jeśli chcesz, mogę w kolejnym kroku od razu zintegrować ten projekt z `Capacitor` i przygotować go pod sklepy.
