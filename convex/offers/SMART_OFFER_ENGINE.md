# Smart Offer Engine

## Cel modulu

Smart Offer Engine to deterministyczny modul rekomendacji ofert dla aplikacji budzetu domowego. Modul analizuje lokalne dane wydatkow w Convex, wylicza anonimowe segmenty gospodarstwa domowego, dopasowuje je do znormalizowanego katalogu ofert i mierzy klikniecia oraz pozniejsze konwersje.

Wazne ograniczenia:

- matching ofert nie uzywa AI,
- surowe wydatki nie opuszczaja Convex,
- React odpowiada tylko za wyswietlanie i interakcje,
- logika biznesowa mieszka w funkcjach Convex,
- rekomendacje sa deterministyczne i audytowalne.

## Dotychczas zaimplementowane

### Phase 1

Zaimplementowano fundament backendowy:

- tabele w `convex/schema.ts`:
  - `offer_sources`,
  - `offers`,
  - `household_spending_profiles`,
  - `household_offer_segments`,
  - `household_segment_jobs`,
  - `household_offer_recommendations`,
  - `offer_clicks`,
  - `provider_ingestion_runs`.
- katalog modulow w `convex/offers`:
  - segmentacja,
  - katalog i normalizacja ofert,
  - matching i scoring,
  - renderowanie wiadomosci z szablonow,
  - tracking klikniec,
  - podstawowa analityka,
  - kontrakt providerow.
- cron `recalculate dirty offer segments`, ktory przelicza segmenty w batchach.
- cron `expire inactive offers`, ktory wygasza stare oferty.
- integracje z `expenses.ts`, ktore oznaczaja gospodarstwo jako `dirty` po dodaniu, edycji lub usunieciu wydatku.
- endpoint HTTP `/api/offers/redirect?clickToken=...`, ktory przekierowuje klikniecia do linku affiliate.
- publiczne funkcje:
  - `offers/public:listFreshPersonalized`,
  - `offers/public:refreshPersonalized`,
  - `offers/public:dismissRecommendation`,
  - `offers/public:createClickUrl`.
- funkcje admin/catalog:
  - `offers/admin:upsertOfferSource`,
  - `offers/admin:upsertManualOffer`,
  - `offers/admin:pauseOffer`.

### Phase 2

Phase 2 rozwija modul w strone prawdziwych zrodel afiliacyjnych, reklamowych i raportowania:

- tabela konwersji `offer_conversions`,
- adaptery feedow `awin` i `tradetracker`,
- izolowany modul reklamowy dla `rtbhouse`,
- tabele `ad_placements` i `ad_events`,
- endpoint event tracking `/api/ads/rtbhouse/event`,
- endpoint postback konwersji `/api/offers/conversions/tradetracker`,
- ingestion wszystkich aktywnych zrodel katalogowych,
- rejestr providerow rozszerzony poza manual,
- druga strategia scoringowa do A/B testow,
- analityka CTR, konwersji i przychodu per oferta, zrodlo oraz strategia scoringowa,
- recording konwersji z deduplikacja po `sourceId + externalConversionId`.

## Architektura

```text
offers/
  public.ts
    User-facing Convex API.

  admin.ts
    Admin/backoffice mutations for sources and manual offers.

  types.ts
    Shared domain types.

  catalog/
    normalizer.ts
      Validates provider/manual payload and canonicalizes arrays/currency/status.
    repository.ts
      DB helpers for upsert and active catalog reads.
    lifecycle.ts
      Offer expiry.

  segments/
    rules.ts
      Deterministic segment predicates.
    calculator.ts
      Pure profile and segment calculation.
    jobs.ts
      Dirty queue and persistence.
    scheduler.ts
      Cron batch processing.

  matching/
    eligibility.ts
      Hard filters: active, country, currency, segment/category match.
    matcher.ts
      Loads offers/profile/segments and returns scored candidates.
    recommendations.ts
      Persists ranked recommendation cards with audit payload.
    scoring/
      types.ts
      defaultStrategy.ts
      marginFirstStrategy.ts
      registry.ts

  messages/
    templates.ts
    renderer.ts

  providers/
    providerTypes.ts
    registry.ts
    manualProvider.ts
    awinProvider.ts
    tradeTrackerProvider.ts
    ingestionScheduler.ts

  ads/
    admin.ts
    public.ts
    tracking.ts
    providers/
      rtbHouseProvider.ts

  tracking/
    clicks.ts
    conversions.ts
    analytics.ts
```

Regula zaleznosci: public/admin/scheduler moga importowac domenowe moduly, ale moduly domenowe nie importuja public/admin. Providerzy normalizuja dane do wewnetrznego modelu, a matching nie wie, skad oferta pochodzi.

## Schemat danych

Najwazniejsze encje:

- `offer_sources` - konfiguracja zrodla: manual, affiliate network, cashback network, future sources.
- `offers` - wewnetrzny katalog znormalizowanych ofert.
- `household_spending_profiles` - anonimowy profil wydatkow gospodarstwa z okna 90 dni.
- `household_offer_segments` - segmenty typu `HIGH_FOOD`, `DELIVERY_HEAVY`, `FUEL_SPENDER`.
- `household_segment_jobs` - kolejka dirty/processing/clean dla batchowego przeliczania.
- `household_offer_recommendations` - wynik matchingu z rankingiem, tekstem i audytem scoringu.
- `offer_clicks` - klikniecia z tokenem atrybucyjnym.
- `offer_conversions` - konwersje i prowizje.
- `provider_ingestion_runs` - status i historia synchronizacji feedow.
- `ad_placements` - konfiguracja placementow reklamowych poza katalogiem ofert.
- `ad_events` - anonimowe eventy reklamowe: impression, click, conversion, view.

Indeksy sa dobrane pod:

- household-scoped reads,
- szybkie pobieranie aktywnych ofert,
- idempotentny upsert po `sourceId + externalId`,
- raportowanie po `offerId`, `sourceId`, czasie oraz statusie,
- batch jobs po `status + nextRunAt`.

## Segmentacja

Segmentacja jest czysto algorytmiczna:

1. Cron lub recalc job pobiera wydatki z ostatnich 90 dni.
2. `calculator.ts` grupuje wydatki po kategoriach.
3. `rules.ts` wylicza segmenty na podstawie progow kwotowych i czestotliwosci.
4. Wynik jest zapisywany jako profil i segmenty, bez surowych paragonow.

Obecne segmenty:

- `HIGH_FOOD`,
- `DELIVERY_HEAVY`,
- `FUEL_SPENDER`,
- `SUBSCRIPTION_HEAVY`,
- `ONLINE_SHOPPER`.

## Matching i scoring

Matching dziala na:

- aktywnych ofertach,
- aktywnych zrodlach,
- walucie gospodarstwa,
- kraju,
- segmentach,
- kluczach kategorii.

Strategia scoringowa implementuje kontrakt:

```ts
type ScoringStrategy = {
  key: string;
  score(input: ScoringInput): ScoringResult;
};
```

Obecne strategie:

- `default_v1` - balansuje segment, spend, savings, revenue, source priority i weight,
- `margin_first_v1` - mocniej premiuje przychod oraz direct/high-margin offers.

A/B test:

- `registry.ts` wybiera strategie deterministycznym hashem `householdId`,
- rekomendacja zapisuje `strategyKey`,
- analityka raportuje wyniki per strategia.

## Providerzy ofert

Kazde zrodlo implementuje `OfferProvider`:

```ts
type OfferProvider = {
  key: string;
  sourceType: CatalogSourceType;
  fetchOffers(args: FetchOffersArgs): Promise<ProviderOfferPage>;
  normalize(raw: unknown, source: Doc<"offer_sources">): NormalizedOfferInput[];
};
```

Provider odpowiada za:

- pobranie feedu,
- auth/paginacje specyficzna dla zrodla,
- zamiane payloadu na `NormalizedOfferInput`.

Core matching zna tylko `offers`, nie zna Awin ani TradeTracker.

## Wiadomosci

Wiadomosci sa szablonami TypeScript:

- bez AI,
- z walidacja wymaganych zmiennych,
- z fallbackiem locale,
- formatowane waluta gospodarstwa.

Przyklad:

```text
Wydajecie okolo {monthlySpend} miesiecznie na {categoryName}.
Oferta {merchantName} moze dac okolo {estimatedSavings} oszczednosci.
```

## Tracking

Klikniecie:

```text
UI -> createClickUrl -> offer_clicks -> /api/offers/redirect -> affiliate URL + subid
```

Konwersja:

```text
provider postback/import -> recordConversion -> offer_conversions -> analytics
```

Konwersje sa deduplikowane po `sourceId + externalConversionId`.

## Co pozostalo do zrobienia

### Backend

- dodac realne mapowanie feedow Awin/TradeTracker pod konkretne pola eksportu partnera,
- dodac webhook/postback HTTP dla konwersji, zabezpieczony sekretem per source,
- dodac admin role zamiast samego `getAuthUserId`,
- dodac paginacje ingestion dla providerow z duzymi feedami,
- dodac job stale recommendations refresh po udanym ingestion,
- dodac testy jednostkowe pure modulow:
  - segment calculator,
  - rules,
  - normalizer,
  - scoring,
  - template renderer.

### Frontend

- ekran ofert:
  - lista rekomendacji,
  - dismiss,
  - click CTA,
  - loading/empty/error states.
- admin/backoffice:
  - zrodla ofert,
  - manual offers,
  - health providerow,
  - statystyki ofert.

### Phase 3

- cashback ledger,
- cashback balance,
- payout lifecycle,
- ad placements jako osobny modul,
- notification channels: in-app, push, email digest,
- price comparison / loyalty / bank offers,
- opcjonalna przyszla AI strategy tylko na anonimowych profilach.

## Plan implementacji

### Phase 1 - MVP

Status: zrobione.

- schema podstawowa,
- manual sources/offers,
- segment dirty queue,
- batch recalculation,
- deterministic matching,
- default scoring,
- template messages,
- click tracking,
- redirect endpoint.

### Phase 2 - Enhanced

Status: zrobione backendowo.

Zakres:

- `offer_conversions`,
- providerzy `awin` i `tradetracker`,
- ingestion wszystkich aktywnych zrodel,
- source health/status,
- analytics per offer/source/strategy,
- druga scoring strategy i deterministyczne A/B,
- conversion recording i dedupe,
- RTB House jako izolowany ad provider,
- instrukcja implementacji providerow w `PROVIDER_IMPLEMENTATION_GUIDE.md`.

### Phase 3 - Full

Status: do zrobienia.

Zakres:

- cashback accounts and ledger,
- payouts,
- ad network isolation,
- notifications,
- advanced providers,
- admin dashboard hardening,
- optional AI scoring extension.
