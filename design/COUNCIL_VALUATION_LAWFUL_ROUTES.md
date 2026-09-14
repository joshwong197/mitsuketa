# Lawful council valuation routes

## Finding

The free lawful routes have not been exhausted. Hamilton already has a licensed automated route through Waikato Regional Council. Taranaki has a credible limited-use route under dataset-specific terms. Whangārei has a public-use service that needs one narrow clarification. Dunedin expressly offers free reuse on request. Auckland may support noncommercial informational reproduction, while Tauranga and Southland require permission for Mitsuketa's intended third-party display.

This assessment separates public access from downstream reuse. A publicly queryable endpoint, a statutory inspection right, and permission to republish are different things. It is a source and implementation assessment, not legal advice.

## Recommendation matrix

| Area | Current result | Automated display position | Next action |
|---|---|---|---|
| Hamilton | Implemented through the Waikato regional property layer | **Licensed**: the ArcGIS item states CC BY 4.0 | Retain the current adapter, attribution and per-property query pattern |
| Taranaki | Official regional valuation FeatureServer found | **Plausible limited business use**: item terms allow business purposes but prohibit republication of a substantial amount | Ask TRC to confirm user-triggered, uncached or short-cache individual lookups and expected cumulative volume |
| Whangārei | Official public rates-property MapServer found | **Promising but unresolved**: service-specific text says public use, without an express redistribution licence | Ask WDC to confirm display of CV/LV and calculated IV in a commercial internal research product |
| Dunedin | Official DCC and ORC services found | **Permission route available**: DCC offers free reuse upon request | Request permission and confirmation of third-party valuation rights; ask for an API or scheduled source |
| Auckland | Official property deep links and permissive informational wording found | **Noncommercial only without clarification**: current terms separately restrict commercial exploitation | Keep deep links; seek an open-data item licence or written permission before carrying values into a commercial product |
| Tauranga | Official search and property identity layer found | **Link only without permission**: terms prohibit reproduction, framing or reformatting on another site | Keep the official link; request permission if values are required |
| Southland | SDC and region-wide Environment Southland routes found | **Link only for commercial use without permission** | Ask Environment Southland for a region-wide commercial reuse permission covering SDC, Gore and Invercargill |

## Hamilton

Hamilton is already covered by Mitsuketa's Waikato Regional Council adapter. The official `WDP_PROPERTIES_WRC_EXT` FeatureServer supplies valuation reference, address, capital value and land value. Its ArcGIS item specifies CC BY 4.0.^1 The council's map terms distinguish datasets supplied through its data catalogue and permit reuse under their stated licence.^2

The adapter queries one rating-unit polygon using the resolved LINZ address point, attributes Waikato Regional Council, links the CC BY licence and labels IV as calculated `CV − LV`. No further Hamilton-specific scraping is needed.

## Taranaki

Taranaki Regional Council publishes the `EXTERNAL LOCAL MAPS Property Rating` FeatureServer for New Plymouth, Stratford and South Taranaki.^3 Its fields include assessment number, property address, capital value, land value, valuation date, legal description and district/regional rates.

The dataset-specific licence permits personal and business purposes. It then prohibits copying or republishing a substantial amount without prior written consent from the participating councils. It provides no numeric threshold. A user-triggered query for one property, returning CV, LV, calculated IV and the valuation date, is materially different from downloading or mirroring the database. Repeated queries retained over time could still become substantial.

The safe proposed pattern is:

- Query only when a user opens a specific property report.
- Request only assessment reference, address, CV, LV and valuation date.
- Do not bulk enumerate, prefetch or build a local valuation database.
- Use a short operational cache and avoid indefinite aggregation.
- Attribute TRC and the three district councils.
- Carry the accuracy disclaimer and prohibit use for legal disputes.
- Record request volume and cumulative unique properties.

Written confirmation should still be obtained because the cumulative meaning of “substantial” is undefined.

## Whangārei

Whangārei District Council publishes a rates-property layer intended for public-facing use.^4 The live schema includes assessment number, situation address, CV, LV, a field named `as_improvements`, and a refresh date. The item-specific description says the service is intended for public use and excludes private ownership details.^5

This is better evidence than an undocumented endpoint. It does not expressly grant commercial redistribution. WDC's general website terms limit reproduction to personal, informational and noncommercial purposes and require permission for other republication.^6 The relationship between the service-specific public-use text and the general terms should be clarified before automated display.

If approved, inspect `as_improvements` values before treating the field as monetary IV. Otherwise calculate and label `CV − LV`. Do not request ownership, tenure or other unnecessary fields.

## Dunedin

Dunedin City Council publishes a public Rates FeatureServer with rating-assessment geometry and valuation information.^7 Its rates database contains CV, LV and IV.^8 The service is technically suitable but its ArcGIS metadata contains no express reuse licence.

DCC's website reuse page states that information may be used free upon request, subject to acknowledgement and third-party rights.^9 That is a concrete permission path. A request should name the exact fields, commercial/internal context, on-demand query pattern, cache duration and proposed attribution. It should also ask DCC to confirm that its permission covers any rights held by its valuation contractor.

Otago Regional Council exposes a second official property layer with valuation reference, rating authority, LV, CV and update date.^10 Its item terms are principally an accuracy disclaimer, while ORC's general terms restrict reuse to personal, informational or not-for-profit purposes. It is a useful technical alternative but not a commercial licence by itself.

## Auckland

Auckland Council provides stable property pages keyed by rates-assessment identifier.^11 Its current terms allow accurate informational reproduction with acknowledgement, but separately restrict selling or commercially exploiting website material.^12 This makes direct value display plausible only while Mitsuketa is genuinely noncommercial. It is not a safe basis for a future paid product.

The council's geospatial terms use the same substantial-amount restriction seen in Taranaki and permit personal and business use.^13 A valuation dataset carrying those terms could be promising, but no valuation-bearing Auckland open-data layer with a clear item licence was established. The reliable current implementation is a deep link to the official property record.

## Tauranga

Tauranga permits ordinary links but requires written permission before information is reproduced, framed or reformatted on another site.^14 Its online-service terms restrict information to personal or internal business use and prohibit making it available to third parties through a networked environment.^15

The public Property MapServer helps resolve property identifiers, valuation numbers and addresses, but does not expose CV, LV or IV.^16 Bay of Plenty Regional Council has an official property search, but its website terms also require permission for reproduction or framing. Linking remains the clean route unless permission is obtained.

## Southland

Southland District Council's public property layer exposes valuation information, but its general terms limit reproduction to personal, informational and noncommercial purposes.^17 The CC BY notice on that page applies to LINZ parcel boundaries rather than the council valuation database.

Environment Southland offers a region-wide property search with deep-link parameters. Its terms allow attributed reuse by government and noncommercial organisations, while commercial organisations need permission.^18 A single permission request to Environment Southland may be more efficient because its records can cover Southland District, Gore and Invercargill.

## Statutory access and copyright

Section 28 of the Local Government (Rating) Act requires reasonable public access to rating information.^19 It does not expressly give every recipient an unrestricted downstream republication licence.

Section 61 of the Copyright Act addresses material open to public inspection or held on an official register. Its dissemination provisions depend on action by, or with the authority of, the person responsible for public access or the register.^20 It supports asking a council to authorise dissemination; it should not be treated as automatic permission for Mitsuketa.

NZGOAL guidance also distinguishes individual database contents from copyright in the database as a selected or arranged collection.^21 A bare valuation number may raise different copyright issues from systematic extraction of the database. Contractual website terms, third-party rights and service restrictions still need to be respected.

## Permission request

The fastest route is a narrow, technically specific request rather than a general request to “use council data”:

> Mitsuketa is an internal property research service. When an authorised user opens a specific property report, we propose to query the council's official service for that single rating unit and display its valuation reference, capital value, land value, improvement value where supplied, and valuation date. We would not bulk download, enumerate or resell the dataset. We would use a short operational cache, retain source attribution and licence links, show the council's accuracy disclaimer, and link to the official property record. Expected usage is [requests per month] and [unique properties per month]. Please confirm whether this use is permitted under the published service terms and whether the council's permission covers any third-party rights in the valuation data.

For Taranaki, add a direct question asking whether cumulative on-demand lookups at the stated volume remain below the “substantial amount” restriction. For Dunedin, cite the council's free-upon-request reuse wording. For Whangārei, cite the item's “intended for public use” statement.

If a council supplies an existing extract through LGOIMA, request reuse permission or an NZGOAL licence at the same time. Disclosure alone should not be treated as a licence.

## Sources

1. Waikato Regional Council, [WDP Properties ArcGIS item](https://www.arcgis.com/home/item.html?id=a3dd4d9f7bb64499bfff8d0e918c7f57).
2. Waikato Regional Council, [Maps and data terms of use](https://www.waikatoregion.govt.nz/services/maps/terms-of-use/).
3. Taranaki Regional Council, [Property Rating item metadata and licence](https://www.arcgis.com/sharing/rest/content/items/73214348e9a242349384bf18d116618b?f=pjson).
4. Whangārei District Council, [Rates Property layer](https://geo.wdc.govt.nz/server/rest/services/Property__Land__Roads_and_Rail_public_view/MapServer/12).
5. Whangārei District Council, [Property Land and Roads item metadata](https://geo.wdc.govt.nz/portal/sharing/rest/content/items/b1e0bf49388b4595ba1cc8f66206c42a?f=pjson).
6. Whangārei District Council, [Disclaimer and copyright](https://www.wdc.govt.nz/Council/About-the-website/Disclaimer-and-copyright).
7. Dunedin City Council, [Public Rates FeatureServer](https://apps.dunedin.govt.nz/arcgis/rest/services/Public/Rates/FeatureServer).
8. Dunedin City Council, [Information held in the rates database](https://www.dunedin.govt.nz/services/rates-information/information-we-hold).
9. Dunedin City Council, [About this site and reuse](https://www.dunedin.govt.nz/about-this-site).
10. Otago Regional Council, [PropertyExternal valuation layer](https://maps.orc.govt.nz/arcgis/rest/services/PropertyExternal/MapServer/0).
11. Auckland Council, [Property rates and valuation search](https://www.aucklandcouncil.govt.nz/en/property-rates-valuations/find-property-rates-valuation.html).
12. Auckland Council, [Terms and conditions](https://www.aucklandcouncil.govt.nz/en/terms-and-conditions.html).
13. Auckland Council, [Geospatial terms and conditions](https://www.aucklandcouncil.govt.nz/en/geospatial/geospatial-terms-conditions.html).
14. Tauranga City Council, [Website terms of use](https://www.tauranga.govt.nz/terms-of-use).
15. Tauranga City Council, [Online services terms](https://www.tauranga.govt.nz/online-services-terms-and-conditions).
16. Tauranga City Council, [Property MapServer layer](https://gis.tauranga.govt.nz/server/rest/services/Property/MapServer/12).
17. Southland District Council, [Disclaimer and copyright](https://www.southlanddc.govt.nz/home/disclaimer/).
18. Environment Southland, [Terms of use](https://www.es.govt.nz/terms-of-use).
19. New Zealand Legislation, [Local Government (Rating) Act 2002, section 28](https://www.legislation.govt.nz/act/public/2002/6/en/latest/DLM132255.html).
20. New Zealand Legislation, [Copyright Act 1994, section 61](https://legislation.govt.nz/act/public/1994/0143/latest/DLM346831.html).
21. data.govt.nz, [NZGOAL Guidance Note 4: Copyright in datasets](https://data.govt.nz/toolkit/policies/nzgoal/guidance-note-4).
