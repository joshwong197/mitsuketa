export interface ResolvedPropertyAddress {
    address_id?: number | null;
    full_address?: string | null;
    full_road_name?: string | null;
    suburb_locality?: string | null;
    town_city?: string | null;
    territorial_authority?: string | null;
    longitude?: number | null;
    latitude?: number | null;
}

export interface CouncilRatingValuation {
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
    sourceName?: string;
    sourceUrl?: string;
    licenceUrl?: string;
    matchMethod?: 'spatial' | 'address';
    matchConfidence?: 'high' | 'medium';
    note?: string;
}

type Adapter = 'waimakariri' | 'horizons';

export interface CouncilSource {
    council: string;
    officialUrl: string;
    adapter?: Adapter;
}

const COUNCILS: Array<[string[], CouncilSource]> = [
    [['far north'], { council: 'Far North District Council', officialUrl: 'https://www.fndc.govt.nz/' }],
    [['whangarei'], { council: 'Whangarei District Council', officialUrl: 'https://www.wdc.govt.nz/' }],
    [['kaipara'], { council: 'Kaipara District Council', officialUrl: 'https://www.kaipara.govt.nz/' }],
    [['auckland'], { council: 'Auckland Council', officialUrl: 'https://www.aucklandcouncil.govt.nz/en/property-rates-valuations/find-property-rates-valuation.html' }],
    [['thames coromandel'], { council: 'Thames-Coromandel District Council', officialUrl: 'https://www.tcdc.govt.nz/' }],
    [['hauraki'], { council: 'Hauraki District Council', officialUrl: 'https://www.hauraki-dc.govt.nz/' }],
    [['waikato'], { council: 'Waikato District Council', officialUrl: 'https://www.waikatodistrict.govt.nz/' }],
    [['matamata piako'], { council: 'Matamata-Piako District Council', officialUrl: 'https://www.mpdc.govt.nz/' }],
    [['hamilton'], { council: 'Hamilton City Council', officialUrl: 'https://hamilton.govt.nz/property-rates-and-building/property/property-search/' }],
    [['waipa'], { council: 'Waipa District Council', officialUrl: 'https://www.waipadc.govt.nz/' }],
    [['otorohanga'], { council: 'Otorohanga District Council', officialUrl: 'https://www.otodc.govt.nz/' }],
    [['south waikato'], { council: 'South Waikato District Council', officialUrl: 'https://www.southwaikato.govt.nz/' }],
    [['waitomo'], { council: 'Waitomo District Council', officialUrl: 'https://www.waitomo.govt.nz/', adapter: 'horizons' }],
    [['taupo'], { council: 'Taupo District Council', officialUrl: 'https://www.taupodc.govt.nz/property-and-rates/property-search', adapter: 'horizons' }],
    [['western bay of plenty'], { council: 'Western Bay of Plenty District Council', officialUrl: 'https://www.westernbay.govt.nz/property-rates-and-building/property-and-rates-search' }],
    [['tauranga'], { council: 'Tauranga City Council', officialUrl: 'https://www.tauranga.govt.nz/property-and-rates/property-search' }],
    [['rotorua lakes', 'rotorua'], { council: 'Rotorua Lakes Council', officialUrl: 'https://www.rotorualakescouncil.nz/property-building-bins/rating-information-database-rid' }],
    [['whakatane'], { council: 'Whakatane District Council', officialUrl: 'https://www.whakatane.govt.nz/' }],
    [['kawerau'], { council: 'Kawerau District Council', officialUrl: 'https://www.kaweraudc.govt.nz/' }],
    [['opotiki'], { council: 'Opotiki District Council', officialUrl: 'https://www.odc.govt.nz/' }],
    [['gisborne'], { council: 'Gisborne District Council', officialUrl: 'https://www.gdc.govt.nz/' }],
    [['wairoa'], { council: 'Wairoa District Council', officialUrl: 'https://www.wairoadc.govt.nz/' }],
    [['hastings'], { council: 'Hastings District Council', officialUrl: 'https://www.hastingsdc.govt.nz/services/properties-and-rates/my-property/' }],
    [['napier'], { council: 'Napier City Council', officialUrl: 'https://www.hbrc.govt.nz/services/properties-and-rates/rates/' }],
    [['central hawkes bay'], { council: "Central Hawke's Bay District Council", officialUrl: 'https://www.chbdc.govt.nz/' }],
    [['new plymouth'], { council: 'New Plymouth District Council', officialUrl: 'https://www.npdc.govt.nz/' }],
    [['stratford'], { council: 'Stratford District Council', officialUrl: 'https://www.stratford.govt.nz/' }],
    [['south taranaki'], { council: 'South Taranaki District Council', officialUrl: 'https://www.southtaranaki.com/' }],
    [['ruapehu'], { council: 'Ruapehu District Council', officialUrl: 'https://www.ruapehudc.govt.nz/', adapter: 'horizons' }],
    [['whanganui'], { council: 'Whanganui District Council', officialUrl: 'https://www.whanganui.govt.nz/', adapter: 'horizons' }],
    [['rangitikei'], { council: 'Rangitikei District Council', officialUrl: 'https://www.rangitikei.govt.nz/', adapter: 'horizons' }],
    [['manawatu'], { council: 'Manawatu District Council', officialUrl: 'https://www.mdc.govt.nz/', adapter: 'horizons' }],
    [['palmerston north'], { council: 'Palmerston North City Council', officialUrl: 'https://www.pncc.govt.nz/Rates-Building-Property/Property-housing/Property-and-rates-search', adapter: 'horizons' }],
    [['tararua'], { council: 'Tararua District Council', officialUrl: 'https://www.tararuadc.govt.nz/', adapter: 'horizons' }],
    [['horowhenua'], { council: 'Horowhenua District Council', officialUrl: 'https://www.horowhenua.govt.nz/', adapter: 'horizons' }],
    [['masterton'], { council: 'Masterton District Council', officialUrl: 'https://mstn.govt.nz/' }],
    [['carterton'], { council: 'Carterton District Council', officialUrl: 'https://cdc.govt.nz/' }],
    [['south wairarapa'], { council: 'South Wairarapa District Council', officialUrl: 'https://swdc.govt.nz/' }],
    [['kapiti coast', 'kapiti'], { council: 'Kapiti Coast District Council', officialUrl: 'https://www.kapiticoast.govt.nz/' }],
    [['porirua'], { council: 'Porirua City Council', officialUrl: 'https://poriruacity.govt.nz/services/rates-property/property-search/' }],
    [['upper hutt'], { council: 'Upper Hutt City Council', officialUrl: 'https://eservices.uhcc.govt.nz/rates/properties/search' }],
    [['lower hutt', 'hutt'], { council: 'Hutt City Council', officialUrl: 'https://www.huttcity.govt.nz/property-and-building/rates-and-valuations/property-search' }],
    [['wellington'], { council: 'Wellington City Council', officialUrl: 'https://services.wellington.govt.nz/property-search/' }],
    [['tasman'], { council: 'Tasman District Council', officialUrl: 'https://www.tasman.govt.nz/my-property/rates/search' }],
    [['nelson'], { council: 'Nelson City Council', officialUrl: 'https://www.nelson.govt.nz/3rates/rates-search' }],
    [['marlborough'], { council: 'Marlborough District Council', officialUrl: 'https://www.marlborough.govt.nz/services/rates/rates-search' }],
    [['kaikoura'], { council: 'Kaikoura District Council', officialUrl: 'https://www.kaikoura.govt.nz/' }],
    [['hurunui'], { council: 'Hurunui District Council', officialUrl: 'https://www.hurunui.govt.nz/' }],
    [['waimakariri'], { council: 'Waimakariri District Council', officialUrl: 'https://gisservices.waimakariri.govt.nz/apps/YourRates/index.html', adapter: 'waimakariri' }],
    [['christchurch'], { council: 'Christchurch City Council', officialUrl: 'https://ccc.govt.nz/services/rates-and-valuations/rates-and-valuation-search' }],
    [['selwyn'], { council: 'Selwyn District Council', officialUrl: 'https://online.selwyn.magiqcloud.com/rates/properties/search' }],
    [['ashburton'], { council: 'Ashburton District Council', officialUrl: 'https://www.ashburtondc.govt.nz/' }],
    [['timaru'], { council: 'Timaru District Council', officialUrl: 'https://www.timaru.govt.nz/services/rates-and-property/property-search' }],
    [['mackenzie'], { council: 'Mackenzie District Council', officialUrl: 'https://www.mackenzie.govt.nz/' }],
    [['waimate'], { council: 'Waimate District Council', officialUrl: 'https://www.waimatedc.govt.nz/' }],
    [['buller'], { council: 'Buller District Council', officialUrl: 'https://bullerdc.govt.nz/' }],
    [['grey'], { council: 'Grey District Council', officialUrl: 'https://www.greydc.govt.nz/' }],
    [['westland'], { council: 'Westland District Council', officialUrl: 'https://www.westlanddc.govt.nz/' }],
    [['waitaki'], { council: 'Waitaki District Council', officialUrl: 'https://www.waitaki.govt.nz/' }],
    [['central otago'], { council: 'Central Otago District Council', officialUrl: 'https://www.codc.govt.nz/' }],
    [['queenstown lakes'], { council: 'Queenstown Lakes District Council', officialUrl: 'https://www.qldc.govt.nz/services/rates-property/property-information-search' }],
    [['dunedin'], { council: 'Dunedin City Council', officialUrl: 'https://www.dunedin.govt.nz/services/rates-information/rates' }],
    [['clutha'], { council: 'Clutha District Council', officialUrl: 'https://www.cluthadc.govt.nz/' }],
    [['southland'], { council: 'Southland District Council', officialUrl: 'https://www.southlanddc.govt.nz/' }],
    [['gore'], { council: 'Gore District Council', officialUrl: 'https://www.goredc.govt.nz/' }],
    [['invercargill'], { council: 'Invercargill City Council', officialUrl: 'https://www.icc.govt.nz/rates-building-property/1-rates/02-rates-search' }],
    [['chatham islands', 'chatham island'], { council: 'Chatham Islands Council', officialUrl: 'https://www.cic.govt.nz/' }],
];

function normalise(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ')
        .replace(/\b(?:district|city|council)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

const BY_KEY = new Map<string, CouncilSource>();
for (const [aliases, source] of COUNCILS) {
    for (const alias of aliases) BY_KEY.set(normalise(alias), source);
}

export function councilSourceFor(territorialAuthority?: string | null): CouncilSource | null {
    if (!territorialAuthority) return null;
    return BY_KEY.get(normalise(territorialAuthority)) ?? null;
}

const WDC_LAYER = 'https://gisservices.waimakariri.govt.nz/arcgis/rest/services/Property/PropertyandLand/MapServer/5';
const HORIZONS_LAYER = 'https://maps.horizons.govt.nz/arcgis/rest/services/LocalMapsPublic/Public_Property/MapServer/1';
const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';

interface ArcFeature { attributes?: Record<string, any> }

function numberOrUndefined(value: unknown): number | undefined {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}

function isoDate(value: unknown): string | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const date = new Date(typeof value === 'number' ? value : String(value));
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function addressNumber(value: string): string | null {
    const match = normalise(value).match(/(?:^|\s)(\d+[a-z]?)(?:\s|$)/);
    return match?.[1] ?? null;
}

function addressScore(want: string, candidate: string): number {
    const a = new Set(normalise(want).split(' ').filter(Boolean));
    const b = new Set(normalise(candidate).split(' ').filter(Boolean));
    if (!a.size || !b.size) return 0;
    const wantNo = addressNumber(want);
    const gotNo = addressNumber(candidate);
    if (wantNo && gotNo && wantNo !== gotNo) return 0;
    let shared = 0;
    for (const token of a) if (b.has(token)) shared++;
    return shared / a.size + (wantNo && gotNo === wantNo ? 0.25 : 0);
}

async function arcQuery(url: string, params: Record<string, string>, fetchImpl: typeof fetch): Promise<ArcFeature[]> {
    const query = new URL(`${url}/query`);
    for (const [key, value] of Object.entries({ where: '1=1', returnGeometry: 'false', f: 'json', ...params })) {
        query.searchParams.set(key, value);
    }
    const response = await fetchImpl(query, { signal: AbortSignal.timeout(3_000), headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`Council valuation source returned ${response.status}`);
    const body = await response.json() as { features?: ArcFeature[]; error?: { message?: string } };
    if (body.error) throw new Error(body.error.message || 'Council valuation query failed');
    return body.features ?? [];
}

function chooseAddress(features: ArcFeature[], field: string, address: string): ArcFeature | null | 'ambiguous' {
    const ranked = features.map(feature => ({ feature, score: addressScore(address, String(feature.attributes?.[field] ?? '')) }))
        .filter(row => row.score >= 0.65).sort((a, b) => b.score - a.score);
    if (!ranked.length) return null;
    if (ranked.length > 1 && Math.abs(ranked[0].score - ranked[1].score) < 0.08) return 'ambiguous';
    return ranked[0].feature;
}

async function waimakariri(address: ResolvedPropertyAddress, fetchImpl: typeof fetch): Promise<Partial<CouncilRatingValuation> | 'ambiguous' | null> {
    const features = await arcQuery(WDC_LAYER, {
        geometry: `${address.longitude},${address.latitude}`,
        geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
        distance: '120', units: 'esriSRUnit_Meter',
        outFields: 'LOCATION,VNZ,PROPERTY_NO,CapitalValue,LANDVALUE,ImprovementsValue,VALNDATE',
    }, fetchImpl);
    const picked = chooseAddress(features, 'LOCATION', address.full_address || '');
    if (picked === 'ambiguous') return 'ambiguous';
    if (!picked) return null;
    const a = picked.attributes ?? {};
    return {
        valuationNumber: a.VNZ ? String(a.VNZ) : undefined,
        capitalValue: numberOrUndefined(a.CapitalValue), landValue: numberOrUndefined(a.LANDVALUE),
        improvementsValue: numberOrUndefined(a.ImprovementsValue), valuationDate: isoDate(a.VALNDATE),
        sourceUrl: WDC_LAYER, licenceUrl: CC_BY, matchMethod: 'address', matchConfidence: 'high',
        sourceName: 'Waimakariri District Council',
    };
}

async function horizons(address: ResolvedPropertyAddress, fetchImpl: typeof fetch): Promise<Partial<CouncilRatingValuation> | 'ambiguous' | null> {
    const features = await arcQuery(HORIZONS_LAYER, {
        geometry: `${address.longitude},${address.latitude}`,
        geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
        outFields: 'VnzLand,VnzLocation,VnzCapitalValue,VnzLandValue,ValuationNumber,TerritorialAuthority,RatesSearchLink,DataLastUpdated',
    }, fetchImpl);
    let picked: ArcFeature | null | 'ambiguous' = features.length === 1 ? features[0] : chooseAddress(features, 'VnzLocation', address.full_address || '');
    if (picked === 'ambiguous' || (features.length > 1 && !picked)) return 'ambiguous';
    if (!picked) return null;
    const a = picked.attributes ?? {};
    const capital = numberOrUndefined(a.VnzCapitalValue);
    const land = numberOrUndefined(a.VnzLandValue);
    return {
        valuationNumber: String(a.ValuationNumber ?? a.VnzLand ?? '') || undefined,
        capitalValue: capital, landValue: land,
        improvementsValue: capital !== undefined && land !== undefined && capital >= land ? capital - land : undefined,
        sourceUpdatedAt: isoDate(a.DataLastUpdated),
        officialUrl: typeof a.RatesSearchLink === 'string' && /^https:\/\//.test(a.RatesSearchLink) ? a.RatesSearchLink : undefined,
        sourceUrl: HORIZONS_LAYER, licenceUrl: CC_BY, matchMethod: 'spatial', matchConfidence: 'high',
        sourceName: 'Horizons Regional Council',
    };
}

export async function lookupCouncilRating(
    address: ResolvedPropertyAddress | null,
    fetchImpl: typeof fetch = fetch,
): Promise<CouncilRatingValuation | null> {
    const source = councilSourceFor(address?.territorial_authority);
    if (!source) return null;
    const base: CouncilRatingValuation = {
        status: 'link_only', council: source.council, officialUrl: source.officialUrl,
        retrievedAt: new Date().toISOString(),
    };
    if (!source.adapter || address?.longitude == null || address.latitude == null || !address.full_address) return base;
    try {
        const result = source.adapter === 'waimakariri'
            ? await waimakariri(address, fetchImpl)
            : await horizons(address, fetchImpl);
        if (result === 'ambiguous') return { ...base, status: 'ambiguous', note: 'More than one council rating unit matched this title.' };
        if (!result) return base;
        return { ...base, ...result, status: 'matched', officialUrl: result.officialUrl ?? base.officialUrl };
    } catch {
        return { ...base, note: 'The council data service was unavailable when this report was generated.' };
    }
}
