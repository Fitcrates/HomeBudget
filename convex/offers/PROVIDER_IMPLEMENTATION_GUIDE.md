# Provider Implementation Guide

Ten dokument opisuje, jak dodawac i konfigurowac providerow afiliacyjnych, reklamowych i przyszlych zrodel ofert w Smart Offer Engine.

## Zasada architektoniczna

Sa dwa oddzielne typy integracji:

1. Affiliate/cashback/direct providers
   - trafiaja do katalogu `offers`,
   - implementuja `OfferProvider`,
   - sa uzywane przez matching i scoring,
   - przyklady: TradeTracker, Awin, direct partnerships.

2. Ad networks
   - nie trafiaja do katalogu `offers`,
   - sa izolowane pod `convex/offers/ads`,
   - maja placementy i eventy,
   - mozna je wylaczyc bez naruszania affiliate/cashback,
   - przyklad: RTB House.

## TradeTracker - implementacja affiliate provider

TradeTracker powinien byc traktowany jako affiliate network. TradeTracker publicznie opisuje product feeds jako eksport produktow w XML lub CSV oraz wskazuje, ze platforma ma API/Web Service dostepne z konta. Wedlug ich Knowledge Centre web services sa oparte o SOAP, a product feeds moga byc CSV/XML. Zrodla:

- https://tradetracker.com/us/knowledge-centre/
- https://apps.shopify.com/tradetracker-connect
- https://www.npmjs.com/package/tradetracker-api

### 1. Utworz source w Convex

Wywolaj `offers/admin:upsertOfferSource`:

```ts
await convex.mutation(api.offers.admin.upsertOfferSource, {
  name: "TradeTracker PL",
  sourceType: "affiliate_network",
  providerKey: "tradetracker",
  status: "active",
  priorityBoost: 8,
});
```

`providerKey` musi byc rowny `tradetracker`, bo taki klucz jest zarejestrowany w `providers/registry.ts`.

### 2. Skonfiguruj feed

Najprostsza sciezka Phase 2 uzywa CSV feed URL:

```env
TRADETRACKER_OFFERS_CSV_URL=https://example.com/tradetracker/offers.csv
```

Feed powinien zawierac mozliwie te kolumny:

```csv
id,title,merchant,description,category,segments,country,currency,commission_rate,affiliate_url,estimated_savings,starts_at,expires_at,image_url,terms_url,weight
```

Obslugiwane aliasy kolumn sa w `providers/feedUtils.ts`, np.:

- `id`, `program_id`, `campaign_id`, `offer_id`, `external_id`,
- `title`, `name`, `campaign_name`, `program_name`,
- `merchant`, `merchant_name`, `advertiser`, `advertiser_name`,
- `affiliate_url`, `tracking_url`, `deeplink`, `url`,
- `commission_rate`, `commission`, `cps`,
- `commission_amount`, `cpc`, `flat_fee`,
- `category`, `categories`, `vertical`,
- `segments`, `segment_keys`.

### 3. Uruchom ingestion

Ingestion odpala sie codziennie z crona `ingest active offer providers`.

Mozesz tez uruchomic pojedyncze zrodlo:

```ts
await convex.action(api.offers.providers.ingestionScheduler.ingestProvider, {
  sourceId,
});
```

Albo wszystkie aktywne zrodla:

```ts
await convex.action(api.offers.providers.ingestionScheduler.ingestAllActiveProviders, {});
```

### 4. Sprawdz health

Uzyj:

```ts
await convex.query(api.offers.admin.listOfferSources, {});
```

Zobaczysz `recentRuns`, `lastIngestedAt`, `lastSuccessAt`, `lastError`.

### 5. Skonfiguruj postback konwersji

Ustaw sekret:

```env
OFFER_CONVERSION_POSTBACK_SECRET=long-random-secret
```

Endpoint:

```text
GET /api/offers/conversions/tradetracker
```

Parametry:

```text
secret=...
sourceId=...
offerId=...
transactionId=...
subid=...
commissionAmount=12.34
orderAmount=199.99
currency=PLN
status=pending|approved|rejected|paid
convertedAt=2026-04-30T10:00:00.000Z
```

Uwagi:

- `commissionAmount` i `orderAmount` sa przyjmowane jako kwoty w jednostkach waluty, np. `12.34`, i zapisywane w groszach.
- `subid` powinien byc tokenem klikniecia dodanym przez `createClickUrl`.
- konwersje deduplikuja sie po `sourceId + externalConversionId`.

### 6. Przyszla integracja SOAP

Jezeli TradeTracker udostepni Ci Customer ID, Passphrase i Affiliate Site ID, mozesz dodac provider SOAP:

1. Utworz `providers/tradeTrackerSoapProvider.ts`.
2. Zaimplementuj `OfferProvider`.
3. Pobieraj programy, kupony, materialy i feed URLs z Web Service.
4. Normalizuj je do `NormalizedOfferInput`.
5. Podmien `providerKey` albo rozszerz obecny `tradeTrackerProvider`.

Nie zmieniaj matchingu. Matching ma widziec tylko rekordy `offers`.

## RTB House - implementacja ad network

RTB House jest retargeting/ad network, nie providerem ofert. Publiczne materialy integracyjne opisuja eventy, tracking links, pixele, postbacki, campaign/account keys oraz custom tags/segments. Zrodla:

- https://netlify.segmentstream.dev/integrations/rtb-house
- https://help.adjust.com/en/partner-setup/rtb-house
- https://help.airbridge.io/en/guides/rtbhouse
- https://www.rtbhouse.com/

RTB House nie powinien pisac do `offers`. Uzywaj `ad_placements` i `ad_events`.

### 1. Utworz source techniczny

Opcjonalnie dodaj source do `offer_sources`, zeby miec jeden rejestr partnerow:

```ts
await convex.mutation(api.offers.admin.upsertOfferSource, {
  name: "RTB House",
  sourceType: "ad_network",
  providerKey: "rtbhouse",
  status: "active",
  priorityBoost: 0,
});
```

Ten source nie jest uzywany przez katalog ofert.

### 2. Utworz placement

Wywolaj `offers/ads/admin:upsertPlacement`:

```ts
await convex.mutation(api.offers.ads.admin.upsertPlacement, {
  placementKey: "offers_screen_rtbhouse_top",
  providerKey: "rtbhouse",
  sourceId,
  screen: "OffersScreen",
  status: "active",
  accountKey: "ACCOUNT_KEY_FROM_RTB_HOUSE_MANAGER",
  campaignKey: "CAMPAIGN_OR_HASH",
  targetUrl: "https://your-landing-page.example.com",
  metadata: {
    format: "native",
    notes: "RTB House placement for offer screen",
  },
});
```

RTB House account key/campaign hash zwykle otrzymasz od account managera albo z narzedzia measurement partnera.

### 3. Pobierz placement w aplikacji

Na ekranie:

```ts
const placement = useQuery(api.offers.ads.public.getPlacementForScreen, {
  householdId,
  screen: "OffersScreen",
  eventBaseUrl: "https://YOUR_CONVEX_SITE_URL/api/ads/rtbhouse/event",
});
```

Zwrotka zawiera:

- `accountKey`,
- `campaignKey`,
- `targetUrl`,
- `tracking.impressionUrl`,
- `tracking.clickUrl`,
- anonimowe `customSegments` w metadata.

### 4. Wyslij event impression

Po wyrenderowaniu placementu:

```ts
await fetch(placement.tracking.impressionUrl);
```

Endpoint zapisze `ad_events` i zwroci `204`.

### 5. Obsluz click

CTA moze otwierac:

```ts
window.location.href = placement.tracking.clickUrl;
```

Endpoint zapisze click i przekieruje do `targetUrl`, jezeli placement go ma.

### 6. Custom tags i prywatnosc

RTB House moze przyjmowac custom tags/segments. Nie wysylaj surowych wydatkow ani nazw transakcji. Dopuszczalne dane:

- segment keys, np. `HIGH_FOOD`,
- ekran/placement,
- anonimowy event token,
- campaign/placement metadata.

### 7. Measurement partner

Jezeli uzywasz Adjust/Airbridge/SegmentStream:

1. Utworz kampanie/link w panelu partnera.
2. W RTB House skonfiguruj link/pixel zgodnie z partnerem.
3. W Convex placement ustaw `targetUrl` na click tracking link albo landing URL.
4. Jezeli partner wymaga event mappingu, mapuj tylko eventy anonimowe:
   - impression,
   - click,
   - conversion,
   - view.

## Jak dodac nowego affiliate providera

1. Utworz plik:

```text
convex/offers/providers/myProvider.ts
```

2. Zaimplementuj:

```ts
export const myProvider: OfferProvider = {
  key: "my-provider",
  sourceType: "affiliate_network",
  async fetchOffers(args) {
    return { items: [] };
  },
  normalize(raw, source) {
    return [/* NormalizedOfferInput */];
  },
};
```

3. Dodaj do `providers/registry.ts`.

4. Utworz `offer_sources` z `providerKey: "my-provider"`.

5. Ustaw envy/secrety.

6. Odpal ingestion i sprawdz `provider_ingestion_runs`.

## Jak dodac nowego ad providera

1. Utworz:

```text
convex/offers/ads/providers/myAdProvider.ts
```

2. Zaimplementuj `AdProvider`:

```ts
export const myAdProvider: AdProvider = {
  key: "my-ad-provider",
  buildRenderConfig({ placement, eventBaseUrl, householdSegments }) {
    return {
      placement,
      providerKey: "my-ad-provider",
      tracking: {
        impressionUrl: "...",
        clickUrl: "...",
      },
    };
  },
};
```

3. Dodaj do `offers/ads/providers/registry.ts`.

4. Utworz `ad_placements`.

5. W UI pobierz placement przez `getPlacementForScreen`.

## Checklist produkcyjny

- Provider ma osobny `providerKey`.
- Source/placement mozna wylaczyc statusem.
- Feed failure nie usuwa automatycznie waznych ofert.
- Linki affiliate zawsze ida przez click token/subid.
- Konwersje maja deduplikacje.
- Dane wysylane do zewnetrznych sieci sa anonimowe.
- Matching nadal dziala tylko na wewnetrznym katalogu `offers`.
- Ad network nie importuje `matching/*`.
