# Council rating valuations — feasibility spike

Date: 14 September 2026

## Decision

Do not abandon this feature. Build it as a hybrid:

1. Give every resolved property an official council **View rating valuation** link.
2. Retrieve CV/LV/IV automatically only from allowlisted official sources with a clear reuse licence and a tested property match.
3. Fall back to the official council search when an automated source is unavailable, ambiguous or unhealthy.

There is no free public national CV/RV feed suitable for Mitsuketa. LINZ holds the National District Valuation Roll, but access is restricted to eligible public bodies and their contractors. Public inspection rights for council rating databases do not create a general right to scrape and republish their data.

## Why the link layer can work nationally

Mitsuketa already requests these fields from the LINZ NZ Addresses layer:

- `address_id`
- `full_address`
- `town_city`
- `territorial_authority`

Address searches retain them in `resolved_address`. Title reports currently call `addressOf()` and keep only `full_address`. Change that lookup to retain the structured LINZ address feature. The territorial authority can then select the right official council lookup without another national data source.

For a title with no usable address, use the title geometry to determine the territorial authority. Keep a plain official council search link and a **Copy address** action as the final fallback.

## Good automated sources

| Coverage | Official source | Data | Licence/readiness | Recommendation |
|---|---|---|---|---|
| Waimakariri District | [Property Values ArcGIS layer](https://gisservices.waimakariri.govt.nz/arcgis/rest/services/Property/PropertyandLand/MapServer/5) | CV, LV, IV, valuation date, valuation number, property ID, location | CC BY 4.0; JSON/GeoJSON query support | First pilot |
| Horizons region | [Public Property ArcGIS layer](https://maps.horizons.govt.nz/arcgis/rest/services/LocalMapsPublic/Public_Property/MapServer/1) | CV, LV, valuation number, TA, update date, official rates link | CC BY 4.0; JSON/GeoJSON query support | First pilot; useful multi-district coverage |
| Christchurch | [Current Rating Unit Value layer](https://gis.ccc.govt.nz/server/rest/services/OpenData/Property/FeatureServer/21) | CV, LV, IV, valuation reference and dates | Public official query layer; confirm the applicable reuse terms before release | Technically excellent; approve licence before production |
| New Plymouth/Taranaki | [Property Rating layer](https://services.arcgis.com/MMPHUPU6MnEt0lEK/ArcGIS/rest/services/Property_Rating/FeatureServer/0) | Address, assessment, CV, LV, rates and valuation date | Public official query layer; confirm licence | Next candidate |
| Whangarei | [Public property layer](https://geo.wdc.govt.nz/server/rest/services/Property__Land__Roads_and_Rail_public_view/FeatureServer/12) | Address, CV, LV, property/assessment IDs and parcel IDs | Public query layer; no clear reuse licence found | Ask Council before embedding values |
| Southland District | [Property layer](https://gis.southlanddc.govt.nz/server/rest/services/PROPERTY/MapServer/3) | Address, valuation number, CV, LV, legal/title description and rates | Public query layer; no clear reuse licence found | Ask Council before embedding values |

Waimakariri and Horizons are the safest first adapters because the official service metadata expressly states CC BY 4.0. Christchurch is a strong technical source but should not be treated as licensed merely because its REST endpoint is public.

## Link-first council examples

These official searches are useful without maintaining brittle page scrapers:

| Area | Official lookup | Linking note |
|---|---|---|
| Auckland | [Find a property valuation](https://www.aucklandcouncil.govt.nz/en/property-rates-valuations/find-property-rates-valuation.html) | Search by address or rates assessment; result URLs can use the assessment number |
| Hamilton | [Property search](https://hamilton.govt.nz/property-rates-and-building/property/property-search/) | Stable-looking property ID result URLs, but terms limit reuse |
| Tauranga | [Property search](https://www.tauranga.govt.nz/property-and-rates/property-search) | Use the official search; do not carry owner/contact fields into Mitsuketa |
| Wellington | [Property search](https://services.wellington.govt.nz/property-search/) | Result uses an opaque token; link to search unless a verified ID is available |
| Lower Hutt | [Property search and Rates Report](https://www.huttcity.govt.nz/property-and-building/rates-and-valuations/property-search) | Free official Rates Report; no stable property URL verified |
| Upper Hutt | [Rates property search](https://eservices.uhcc.govt.nz/rates/properties/search) | Result path can use a valuation number |
| Palmerston North | [Property and rates search](https://www.pncc.govt.nz/Rates-Building-Property/Property-housing/Property-and-rates-search) | Embedded application; link only |
| Hastings | [My property](https://www.hastingsdc.govt.nz/services/properties-and-rates/my-property/) | Result URL can use the council `rid` |
| Rotorua | [Rating Information Database](https://www.rotorualakescouncil.nz/property-building-bins/rating-information-database-rid) | External OneCouncil lookup; link only |
| Dunedin | [Rates search](https://www.dunedin.govt.nz/services/rates-information/rates) | Stable-looking rating ID result URLs; no documented API |
| Invercargill | [Rates search](https://www.icc.govt.nz/rates-building-property/1-rates/02-rates-search) | Search/result linking is possible; confirm reuse before parsing |
| Nelson | [Rates search](https://www.nelson.govt.nz/3rates/rates-search) | Property result links are possible; no documented API |
| Timaru | [Property search](https://www.timaru.govt.nz/services/rates-and-property/property-search) | Result URL can use an assessment number |
| Selwyn | [Rates property search](https://online.selwyn.magiqcloud.com/rates/properties/search) | Link first; automated inspection may be blocked |
| Tasman | [Rates search](https://www.tasman.govt.nz/my-property/rates/search) | Link only unless Council grants reuse permission |
| Marlborough | [Rates search](https://www.marlborough.govt.nz/services/rates/rates-search) | Link only unless Council grants reuse permission |
| Queenstown Lakes | [Property information search](https://www.qldc.govt.nz/services/rates-property/property-information-search) | Interactive search; no stable deep link verified |

The production registry should cover every territorial authority, even when its only capability is a search landing page.

## Matching rules

A LINZ title is not always one council rating unit. A rating unit may aggregate several titles, and unit or cross-lease titles can be ambiguous. Never show an automated value solely because the address text is similar.

Accept an automated value when:

- an official council property/valuation identifier matches; or
- one spatial rating-unit result contains the resolved LINZ address point and its address/legal description agrees; or
- one address query result matches the normalized full address and there are no competing rating units.

For multiple or weak matches, show the official council link and label the value as unavailable. Store the match method and confidence for audit/debugging.

## Proposed report data

```ts
type CouncilRatingValuation = {
  status: 'matched' | 'ambiguous' | 'link_only' | 'unavailable';
  council: string;
  valuationNumber?: string;
  capitalValue?: number;
  landValue?: number;
  improvementsValue?: number;
  valuationDate?: string;
  sourceUpdatedAt?: string;
  retrievedAt: string;
  officialUrl: string;
  licenceUrl?: string;
  matchMethod?: 'council_id' | 'spatial' | 'address';
  matchConfidence?: 'high' | 'medium' | 'low';
};
```

Display **Council rating valuation (CV/RV)**, the valuation date, source and retrieval date. Add: **For rating purposes; this is not a current market valuation.** Include values in the HTML export only for a high-confidence match. Otherwise export the official council link.

## Adapter design

- Keep a territorial-authority registry with the official lookup URL and optional adapter configuration.
- Run external queries server-side.
- Allow automated adapters only when the source is official, fields are schema-tested and the reuse licence permits Mitsuketa's use.
- Use the resolved LINZ address point first; fall back to title geometry or address matching.
- Use a short timeout, one retry, a circuit breaker and a cached snapshot. If anything fails, return the official link.
- Add a fixture/schema health check for each adapter so a council field change disables values instead of producing a misleading report.
- Do not scrape undocumented HTML applications.

## Suggested delivery order

1. Preserve the full LINZ resolved address on title reports.
2. Add the national territorial-authority-to-council registry and official lookup action.
3. Add the same link to the property report and HTML export.
4. Pilot Waimakariri and Horizons automated adapters.
5. Validate title/rating-unit ambiguity with unit titles, cross-leases and multi-title properties.
6. Add more adapters only after source and licence review.

## Primary sources

- [LINZ: property valuation in New Zealand](https://www.linz.govt.nz/guidance/property-valuation/property-valuation-new-zealand)
- [LINZ: New Zealand Property Spine and restricted National DVR access](https://www.linz.govt.nz/our-work/property-information-system/new-zealand-property-spine)
- [LINZ: National DVR licence](https://data.linz.govt.nz/license/linz-agreement-for-national-dvr-data-12/)
- [LINZ NZ Addresses](https://data.linz.govt.nz/layer/123113-nz-addresses/)
- [Local Government (Rating) Act 2002](https://www.legislation.govt.nz/act/public/2002/6/en/latest/)
- [Rating Valuations Act 1998](https://www.legislation.govt.nz/act/public/1998/69/en/latest/)
