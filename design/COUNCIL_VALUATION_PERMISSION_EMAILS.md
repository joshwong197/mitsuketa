# Council valuation permission requests

## Proposed contacts

| Council or source | Route | Address |
|---|---|---|
| Taranaki Regional Council GIS | Email | `gisteam@trc.govt.nz` |
| Whangārei District Council GIS/Data | Email, requesting referral to the GIS/Data owner | `mailroom@wdc.govt.nz` |
| Dunedin City Council | Email | `dcc@dcc.govt.nz`, copy `webmaster@dcc.govt.nz` |
| Auckland Council | Online enquiry requesting referral to Geospatial/Data and Rates | [Email Auckland Council](https://www.aucklandcouncil.govt.nz/en/report-problem/email-us.html) |
| Tauranga City Council | Email, requesting referral to GIS/Data and Rates | `info@tauranga.govt.nz` |
| Environment Southland | Email, requesting referral to GIS and Rates | `service@es.govt.nz`, copy `rates@es.govt.nz` |

The first three requests have the strongest prospect of unlocking automated display. Auckland, Tauranga and Southland are still worth asking because a refusal will define the permitted link-out boundary.

## Shared product description

Use this description consistently:

- Mitsuketa is currently a private New Zealand research tool for company and property information used by a small number of approved users.
- It may later become a paid professional service, so the request seeks permission covering that possibility rather than relying on a noncommercial exception.
- A lookup occurs only when a user searches for and opens one property report.
- Mitsuketa would request only the rating-unit identifier, address, CV, LV, IV where supplied, valuation date and source-update date.
- It would not request or display ratepayer names, contact details, arrears, payment information or other private fields.
- It would not enumerate, bulk download, mirror, sell or provide an extract of the council database.
- It would not build a local valuation database. Any operational caching would be short-lived and follow any limit specified by the council.
- Every result would identify the council/source, link to the official record or search, show the licence or attribution requested by the council, and state that the values are for rating purposes rather than a current market valuation.
- Ambiguous or failed matches would show only the official council link.

## Taranaki Regional Council

**To:** `gisteam@trc.govt.nz`  
**Subject:** Permission clarification — individual Property Rating lookups in Mitsuketa

Kia ora GIS team,

I am developing Mitsuketa, a private New Zealand research tool for company and property information currently used by a small number of approved users. It may later become a paid professional service, so I want to confirm the position now rather than rely on a noncommercial exception.

We have identified TRC's official `EXTERNAL LOCAL MAPS Property Rating` ArcGIS service:

https://services.arcgis.com/MMPHUPU6MnEt0lEK/arcgis/rest/services/Property_Rating/FeatureServer/0

The item's terms say LocalMaps may be used for personal and business purposes, while copying or republishing a substantial amount requires prior written consent. Could you please confirm whether the following use is permitted under those terms?

- A query occurs only when an authorised user opens one specific property report.
- We request and display only the assessment reference, property address, capital value, land value and valuation date. If IV is not supplied, we may show `CV − LV` clearly labelled as calculated.
- We do not bulk download, enumerate, mirror, resell or offer an extract of the dataset.
- We do not build a local valuation database. Any operational cache would be short-lived and can follow a limit you specify.
- We attribute Taranaki Regional Council, New Plymouth District Council, Stratford District Council and South Taranaki District Council, link to the official source, and carry the source disclaimer.
- We state that the information is indicative, for rating purposes, and must not be used for legal disputes.

Could you also advise whether cumulative use at approximately **[estimated lookups] individual property lookups per month** would remain permitted, and whether there is an attribution form or request-rate limit you would like us to follow?

If displaying the values is not permitted, may Mitsuketa still link users directly to the relevant LocalMaps property result or property report? If a stable prefilled-link format is available, we would appreciate the documented format.

I am happy to provide screenshots or a technical flow diagram.

Ngā mihi,

**[Name]**  
**[Role / organisation]**  
**[Email]**  
**[Phone, optional]**

## Whangārei District Council

**To:** `mailroom@wdc.govt.nz`  
**Subject:** GIS data permission clarification — individual rating valuation lookups

Kia ora,

Could you please refer this request to the team responsible for GIS data and the public rates-property service?

I am developing Mitsuketa, a private New Zealand research tool for company and property information currently used by a small number of approved users. It may later become a paid professional service, so I would like clear permission before displaying council valuation data.

We have identified WDC's public `Rates Property` ArcGIS layer:

https://geo.wdc.govt.nz/server/rest/services/Property__Land__Roads_and_Rail_public_view/MapServer/12

Its service metadata describes it as intended for public use. Could WDC confirm whether Mitsuketa may make user-triggered, one-property-at-a-time queries and display only:

- assessment number and situation address;
- capital value and land value;
- improvements value, if `as_improvements` is confirmed to be monetary IV, otherwise a clearly labelled `CV − LV` calculation; and
- the source refresh date.

We would not request or display ownership or contact information, bulk download or enumerate the service, mirror or resell the dataset, or build a local valuation database. Any operational cache would be short-lived and can follow a limit specified by WDC. Each result would identify WDC, link to the official property/rates service, include the requested attribution and disclaimer, and state that the values are for rating purposes rather than a current market valuation.

Please confirm whether this is permitted for both the current internal service and a possible future paid service. If permission is limited, could you specify the permitted purpose, fields, volume, cache period, attribution and request-rate limit?

If value display is not permitted, may we link directly to the relevant WDC property or rates result? If a stable prefilled-link format exists, we would appreciate the documented format.

Ngā mihi,

**[Name]**  
**[Role / organisation]**  
**[Email]**  
**[Phone, optional]**

## Dunedin City Council

**To:** `dcc@dcc.govt.nz`  
**Cc:** `webmaster@dcc.govt.nz`  
**Subject:** Request for free reuse permission — individual DCC rating valuations

Kia ora,

I am developing Mitsuketa, a private New Zealand research tool for company and property information currently used by a small number of approved users. It may later become a paid professional service.

DCC's “About this site” page states that, upon request, information on the website may be used free of charge when its source status is acknowledged. I am therefore requesting permission for the following narrow use of DCC rating information.

When an authorised user opens one specific property report, Mitsuketa would retrieve and display only the rating-unit or valuation reference, address, capital value, land value, improvements value, valuation date and source-update date. We would not request or display ratepayer names, contact details, arrears or payment information.

We would not bulk download, enumerate, mirror, resell or provide an extract of the rates database, and would not build a local valuation database. Any operational cache would be short-lived and can follow a limit specified by DCC. Each result would acknowledge Dunedin City Council, link to the official DCC rates record or search, carry any required disclaimer, and state that the values are for rating purposes rather than a current market valuation.

Could DCC please confirm:

1. whether this use is permitted for both the current internal tool and a possible future paid professional service;
2. whether the permission covers any third-party rights held by DCC's valuation provider;
3. whether DCC prefers that we query the public Rates FeatureServer, another documented API, or a supplied data service;
4. the required attribution, permitted cache duration and request-rate limit; and
5. whether direct or prefilled links to the official DCC property result are permitted if value display is declined.

The public service we have identified is:

https://apps.dunedin.govt.nz/arcgis/rest/services/Public/Rates/FeatureServer

I am happy to provide screenshots or a technical flow diagram.

Ngā mihi,

**[Name]**  
**[Role / organisation]**  
**[Email]**  
**[Phone, optional]**

## Auckland Council

**Route:** [Auckland Council online enquiry](https://www.aucklandcouncil.govt.nz/en/report-problem/email-us.html)  
**Requested referral:** Geospatial/Data and Rates teams  
**Subject:** Permission clarification — individual Auckland rating valuation display

Kia ora,

I am developing Mitsuketa, a private New Zealand research tool for company and property information currently used by a small number of approved users. It may later become a paid professional service. Could this request please be referred to the teams responsible for geospatial data licensing and the property rates and valuation search?

When an authorised user opens one specific property report, we would like to display only the rates-assessment reference, address, capital value, land value, improvements value and valuation date from the official Auckland Council record. We would not request or display ratepayer names, contact details, arrears or payment information.

We would not bulk download, enumerate, mirror or resell the valuation database, and would not build a local valuation database. Any operational cache would be short-lived and can follow a limit specified by Council. Every result would acknowledge Auckland Council, link to the official property record, carry Council's disclaimer, and state that the values are for rating purposes rather than a current market valuation.

Could Council confirm whether this is permitted for both the current internal tool and a possible future paid professional service, and whether there is an official API or licensed dataset we should use? Please also advise the required attribution, permitted cache duration and request-rate limit.

If displaying the values is not permitted, may we continue linking directly to the relevant official `/find-property-rates-valuation/{assessment-id}.html` page, and may we construct that link from an assessment identifier returned by an official Council service?

Ngā mihi,

**[Name]**  
**[Role / organisation]**  
**[Email]**  
**[Phone, optional]**

## Tauranga City Council

**To:** `info@tauranga.govt.nz`  
**Subject:** Permission request — individual Tauranga rating valuation display

Kia ora,

Could this request please be referred to the teams responsible for GIS/data licensing and property rates?

I am developing Mitsuketa, a private New Zealand research tool for company and property information currently used by a small number of approved users. It may later become a paid professional service. I understand Council's terms restrict reproduction, framing and reformatting of Council information on another site, so I am seeking express permission rather than treating an accessible service as permission.

When an authorised user opens one specific property report, Mitsuketa would like to display only the rating-unit or valuation reference, address, capital value, land value, improvements value and valuation date. We would not request or display owner or ratepayer names, contact details, arrears or payment information.

We would not frame the Council website, bulk download, enumerate, mirror or resell the database, and would not build a local valuation database. Any operational cache would be short-lived and can follow a limit specified by Council. Every result would acknowledge Tauranga City Council, link to the official property search or result, carry the requested disclaimer, and state that the values are for rating purposes rather than a current market valuation.

Could Council confirm whether this narrow use is permitted for both the current internal tool and a possible future paid professional service, and whether there is an official API or licensed data service we should use? Please also advise the required attribution, permitted cache duration and request-rate limit.

If permission to display values is declined, could Council confirm that Mitsuketa may provide an ordinary link to the official property search? If a stable prefilled link or documented result URL is available, we would appreciate the supported format.

Ngā mihi,

**[Name]**  
**[Role / organisation]**  
**[Email]**  
**[Phone, optional]**

## Environment Southland

**To:** `service@es.govt.nz`  
**Cc:** `rates@es.govt.nz`  
**Subject:** Region-wide permission request — individual rating valuation display

Kia ora,

Could this request please be referred to the teams responsible for GIS/data licensing and rates?

I am developing Mitsuketa, a private New Zealand research tool for company and property information currently used by a small number of approved users. It may later become a paid professional service. Environment Southland's property tools bring together information from councils across the region, so I am asking whether a single permission or licence can cover rating valuation information for Southland District, Gore and Invercargill.

When an authorised user opens one specific property report, Mitsuketa would like to display only the rating-unit or valuation reference, address, capital value, land value, improvements value and valuation date. We would not request or display owner or ratepayer names, contact details, arrears or payment information.

We would not bulk download, enumerate, mirror or resell the regional database, and would not build a local valuation database. Any operational cache would be short-lived and can follow a limit specified by Council. Every result would identify the contributing council and Environment Southland, link to the official property record or search, carry the requested attribution and disclaimer, and state that the values are for rating purposes rather than a current market valuation.

Could Environment Southland confirm whether this narrow use is permitted for both the current internal tool and a possible future paid professional service? If separate contributing-council permission is required, please identify the relevant data owners or contacts. Please also advise the official service to query, permitted fields, required attribution, cache duration and request-rate limit.

If value display is declined, may Mitsuketa construct a direct or prefilled link to the relevant Environment Southland property result using the address or property identifier?

Ngā mihi,

**[Name]**  
**[Role / organisation]**  
**[Email]**  
**[Phone, optional]**
