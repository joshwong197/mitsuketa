# Entity information review — 13 September 2026

## Result

Mitsuketa searches NZBN entities, not just companies. Its graph previously discarded most of the full entity record. The branch now adds integrated **Record / Network** views from the graph toolbar and an entity node's context menu. Record occupies the main canvas while retaining the case sidebar and entity tabs. It covers identity, business addresses/contact, registration/filings, dated roles, share allocations and source/freshness information.

The record reuses a recently fetched graph record in memory (five-minute freshness window) or fetches the entity on demand. Refresh explicitly fetches again. Returning to Network retains graph data without rerunning discovery. Profile data is not added to saved graph JSON; interactive HTML exports now embed the target entity record. Existing graph nodes retain their type, source register and role labels. The Simple scope control offers a confirmation to rerun Comprehensive in the same tab; failed reruns preserve the simple graph.

## Fletcher Building Limited

Live NZBN v5 entity response retrieved through the app's existing proxy on 13 September 2026:

| Field | Returned information | Display after this change |
|---|---|---|
| Identity | NZBN 9429037065836; company 1104175; NZ Limited Company; Registered | Graph and profile |
| Incorporation | 19 December 2000 | Profile, preserving the source calendar date |
| Source update | 26 August 2026 | Profile, separate from retrieval time |
| Annual return | June; last filed 17 June 2026 | Profile |
| Financial reporting month | June | Profile |
| Constitution | Filed | Profile; document remains on source register |
| Ultimate holding company | None declared | Profile; not an inference about beneficial ownership |
| Business addresses | Registered office, service, postal and records addresses | Profile with address types |
| Business contact | Website and telephone | Profile; absent fields labelled “Not supplied” |
| Roles | 7 active directors and 26 historical appointments | Current roles first; history in a separate disclosure |
| Shares | 1,075,561,767 total shares; 10 returned allocations; extensive-shareholding flag | Counts and percentages by allocation, with coverage notice |
| Trading names / industry / email | Empty in this response | “Not supplied”, not a claim none exist |

The Companies Register web result independently identifies the same company and the principal summary fields, but the web tool returned a page generated in June. The live NZBN response is the newer evidence for this review. A connected interactive Browser was not available; do not describe the web-page result as a freshly interacted-with browser session.

Source: [Fletcher's Companies Register record](https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/1104175). The register's extract includes identity, status, addresses, directors and shareholdings: [company extract guidance](https://companies-register.companiesoffice.govt.nz/help-centre/keeping-company-details-up-to-date/getting-a-copy-of-your-company-information/).

## Non-company coverage

| Entity | Existing graph behaviour | Review and current treatment |
|---|---|---|
| Ordinary partnership | Searchable if on NZBN; available roles can be drawn | Live sample returned no roles. Show core record and explicit missing-role notice; do not imply no partners |
| Limited partnership | Available corporate/person roles drawn; corporate role holders may be followed in Comprehensive | Live sample code/source `Y` returned a `Partner` role. Preserve that role label and use the Limited Partnerships Register link |
| Trust | Available trustees drawn as person/entity roles | Live sample code `Trading_Trust` returned two trustees and no business addresses. Show public data without inferring beneficiaries or a complete trustee list |
| Incorporated society | Available officers drawn as roles | Live sample code/source `I` returned three officers. Preserve officer labels and route to the societies register |
| Charitable trust board | Searchable through NZBN | Live sample code/source `T` returned a charity number and no roles. Show charity number, source-register link and Charities Register search link |
| Registered charity | No dedicated Charities Register integration | Charity registration is separate from legal structure. A charity may be a trust, society or company. NZBN alone does not verify current charity status, purposes or financial reporting |
| No NZBN | Not discoverable by this app's entity endpoint | The no-results message now explains this boundary |

Public data coverage varies; an empty relationship graph is not proof that no relationships exist. Entities registered with Companies Office include companies, societies, trust boards and limited partnerships; ordinary partnerships and trusts can apply for an NZBN. [NZBN eligibility and types](https://www.nzbn.govt.nz/get-an-nzbn/applying-for-an-nzbn/). Legal structure and charity registration are distinct: [Charities Services guidance](https://www.charities.govt.nz/news-and-events/hot-topics/what-to-be-or-not-to-be-incorporated-societies-and-charitable-trusts). [Limited Partnerships search guidance](https://lp-register.companiesoffice.govt.nz/help-centre/searching-the-registers/how-to-search-the-limited-partnerships-registers/).

## Accuracy fixes

- Search results and target graph nodes retain and show the entity type. The search area now says “Companies & entities”.
- The Companies Register URL is only constructed for an explicitly identified company source. Non-company identifiers are not treated as company numbers.
- Graph roles preserve middle names. Trustees/officers/partners use a neutral person seal and their filed role label instead of a shareholder seal.
- Simple includes immediate current roles. Comprehensive retains historical-role behaviour. The profile can show both without conflating them.
- Joint shareholders are one allocation with multiple holders; the profile never multiplies that allocation's shares by its number of holders.
- Extensive shareholding is labelled. Nominees and registered shareholders are not presented as an exhaustive list of beneficial owners.
- The profile projects business fields explicitly. It excludes personal role/shareholder addresses, bank account details and GST identifiers. External website links accept HTTP(S) only.

## Remaining source boundaries

The record is not a complete reproduction of each register. Company document links are collected, but their PDF contents are not downloaded into the record or export. It does not automatically query Charities Services or expose unavailable/private partner/trust information. Non-company links currently open the relevant register's search homepage, not an unverified deep link.

## Record cards, history and combined export — 13 September 2026

The Record view now uses an entity identity card, an indigo 記録 spine, key counts and four sections marked 一 / 二 / 三 / 四. Current facts remain visible; former names, address history, historical appointments and historical shareholders use disclosures. Former names are omitted when none are returned. The HTML export embeds the target entity's public record alongside the existing graph in Network / Record views; Simple or Comprehensive scope is preserved. Switching views works offline. Linked source documents still need internet access. Records for every related node are not bundled.

Live read-only checks on Fletcher (company 1104175) returned **6 historical business addresses, 45 historical shareholders and 200 document links** from the public register pages. NZBN name history returned an empty array. Its advertised address-history endpoint returned 404 for Fletcher, so company history is collected from the public Companies Register HTML instead. Parser failures are reported as unavailable, not silently represented as proof of no history.

The public pages expose filing titles, dates and source document URLs. Fletcher examples include financial statements, annual returns, extensive shareholder lists and shareholding particulars. The register also describes constitutions, consents and insolvency filings among its available documents. Historical shareholder records can be incomplete; names and cessation dates do not establish historical parcel sizes or beneficial ownership. [Companies Register search and document guidance](https://companies-register.companiesoffice.govt.nz/help-centre/getting-support-to-use-the-companies-register/searching-the-companies-register/).

The new endpoint follows fixed official register URLs and accepts numeric company identifiers only. Document links are restricted to official hexadecimal document URLs. The existing consent-form/PDF proxy and person-report signature extraction are separate capabilities; no general PDF text/OCR parsing was added here. HTML layouts can change, so source links and partial-failure messages remain available. Document links are limited to the retrieved page, with an additional 250-link cap.

Checks cover parser grouping and URL filtering, both offline export scopes, embedded-text escaping, disclosure history and the larger same-tab notice readers. Local screenshots replay captured Fletcher data; permanent tests use synthetic fixtures.

Existing insolvency/disqualification enrichment and the Comprehensive ownership crawl remain additional graph features. Their name matches do not by themselves prove identity, and the new profile does not turn them into register facts.

## Validation

- Pure profile checks: joint allocations, false vs absent, source routing, unsafe links and excluded personal/financial fields.
- Graph checks: Simple boundaries, Comprehensive default, historical roles, officers/trustees/partners and full person names.
- Browser scenarios: company and five non-company types, details display, correct source link, Escape close and saved graph scope.
- Production build and comparison against prior TypeScript diagnostics. Known baseline diagnostics remain outside this change.

Live response captures and screenshots are ignored local review artifacts; the repository tests use fictional data. A separate display check replayed the captured Fletcher response to inspect desktop/mobile rendering and historical-role disclosure, with external risk enrichment mocked. No main/production, billing or authentication changes are part of this work.
