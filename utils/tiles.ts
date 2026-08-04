// Web Mercator tile arithmetic for the 地 parcel map.
//
// Pure and browser-safe: the report view, the HTML export and any test all
// derive the same grid from the same numbers. No mapping library — a parcel map
// is a fixed mosaic of tiles with one polygon drawn over it, which is a dozen
// lines of arithmetic rather than a dependency.
//
// Tiles come from LINZ Basemaps (CC BY 4.0). They are fetched THROUGH the app's
// own API so the LINZ key stays on the server, exactly like every other LINZ
// call — see api/property.ts mode=tile.

export const TILE_SIZE = 256;
/**
 * LINZ Basemaps does not hold imagery at every zoom everywhere — urban areas go
 * deeper than rural ones, and above the available level the service 404s rather
 * than upscaling. Starting at 20 keeps a suburban parcel sharp (~0.3 m/px) while
 * landing inside coverage far more often; TitleMap steps further out when a
 * whole grid comes back empty, which is what rural titles need.
 */
export const MAX_ZOOM = 20;
export const MIN_ZOOM = 1;

export interface TileRef { z: number; x: number; y: number }

export interface TileGrid {
    z: number;
    tiles: (TileRef & { left: number; top: number })[];
    /** Pixel size of the mosaic. */
    width: number;
    height: number;
    /** Mosaic offset, so world pixels map onto the visible box. */
    originX: number;
    originY: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Longitude/latitude to absolute pixel coordinates at a zoom level. */
export function lonLatToPixel(lon: number, lat: number, z: number): [number, number] {
    const scale = TILE_SIZE * Math.pow(2, z);
    const x = ((lon + 180) / 360) * scale;
    // Clamped to the Mercator limit; NZ is nowhere near it, but a bad
    // coordinate should not produce Infinity.
    const sin = Math.sin(clamp(lat, -85.05112878, 85.05112878) * Math.PI / 180);
    const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
    return [x, y];
}

/**
 * The inverse of `lonLatToPixel`. Panning and cursor-anchored zooming both work
 * by moving a point in pixel space and asking where on the ground it landed, so
 * the round trip has to hold to well under a pixel — see utils/tiles.check.ts.
 */
export function pixelToLonLat(px: number, py: number, z: number): [number, number] {
    const scale = TILE_SIZE * Math.pow(2, z);
    const lon = (px / scale) * 360 - 180;
    // Clamped to the Mercator limit, so dragging past the pole yields the pole
    // rather than NaN.
    const n = Math.PI * (1 - 2 * clamp(py / scale, 0, 1));
    const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
    return [lon, lat];
}

/**
 * The tile mosaic covering a `width`×`height` box centred on one point at a
 * given zoom.
 *
 * This is the primitive: `tileGrid` picks a zoom from a bbox and defers here,
 * and the interactive map calls it directly because pan and zoom are exactly a
 * centre and a zoom. `z` must be an integer — fractional zoom is a scale
 * transform applied over an integer tile level, not a different set of tiles.
 */
export function gridAt(
    lon: number, lat: number, z: number, width: number, height: number,
): TileGrid {
    const [cx, cy] = lonLatToPixel(lon, lat, z);
    // Top-left of the visible box in absolute world pixels.
    const originX = cx - width / 2;
    const originY = cy - height / 2;

    const scale = Math.pow(2, z);
    const firstX = Math.floor(originX / TILE_SIZE);
    const firstY = Math.floor(originY / TILE_SIZE);
    const lastX = Math.floor((originX + width) / TILE_SIZE);
    const lastY = Math.floor((originY + height) / TILE_SIZE);

    const tiles: TileGrid['tiles'] = [];
    for (let x = firstX; x <= lastX; x++) {
        for (let y = firstY; y <= lastY; y++) {
            // Off-world tiles do not exist; skip rather than request a 404.
            if (y < 0 || y >= scale) continue;
            tiles.push({
                z, x: ((x % scale) + scale) % scale, y,
                left: Math.round(x * TILE_SIZE - originX),
                top: Math.round(y * TILE_SIZE - originY),
            });
        }
    }
    return { z, tiles, width, height, originX, originY };
}

/** Tiles the box spans before off-world rows are dropped — the budget figure. */
function spanCount(grid: TileGrid): number {
    const across = Math.floor((grid.originX + grid.width) / TILE_SIZE) - Math.floor(grid.originX / TILE_SIZE) + 1;
    const down = Math.floor((grid.originY + grid.height) / TILE_SIZE) - Math.floor(grid.originY / TILE_SIZE) + 1;
    return across * down;
}

/**
 * The largest zoom at which the whole bbox still fits the target box, with a
 * margin so the parcel never touches the frame. Larger zoom = closer in, so we
 * search downward from the maximum.
 */
export function zoomForBbox(
    bbox: [number, number, number, number],
    width: number,
    height: number,
    margin = 0.12,
    maxZoom = MAX_ZOOM,
): number {
    const [minx, miny, maxx, maxy] = bbox;
    const usableW = width * (1 - margin * 2);
    const usableH = height * (1 - margin * 2);
    for (let z = Math.min(maxZoom, MAX_ZOOM); z > MIN_ZOOM; z--) {
        const [x1, y1] = lonLatToPixel(minx, maxy, z);
        const [x2, y2] = lonLatToPixel(maxx, miny, z);
        if (Math.abs(x2 - x1) <= usableW && Math.abs(y2 - y1) <= usableH) return z;
    }
    return MIN_ZOOM;
}

/**
 * The tile mosaic covering `bbox` centred in a `width`×`height` box.
 *
 * `maxTiles` is a hard ceiling: every tile is a request through our own API and
 * an inlined image in the export, so an unbounded grid is a real cost. Hitting
 * the ceiling steps the zoom out rather than dropping tiles, which keeps the
 * parcel whole — a map missing its corner is worse than a map zoomed out.
 */
export function tileGrid(
    bbox: [number, number, number, number],
    width: number,
    height: number,
    maxTiles = 20,
    /** Levels to step back from the natural fit, for retrying past a coverage gap. */
    zoomOut = 0,
): TileGrid {
    let z = Math.max(MIN_ZOOM, zoomForBbox(bbox, width, height) - Math.max(0, zoomOut));
    const [minx, miny, maxx, maxy] = bbox;
    const lon = (minx + maxx) / 2;
    const lat = (miny + maxy) / 2;

    for (;;) {
        const grid = gridAt(lon, lat, z, width, height);
        if (spanCount(grid) > maxTiles && z > MIN_ZOOM) { z--; continue; }
        return grid;
    }
}

/** The centre of a bbox — the point a fitted grid is built around. */
export function bboxCentre(bbox: [number, number, number, number]): [number, number] {
    return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

/** A map view: a centre and a zoom. Zoom may be fractional. */
export interface View { lon: number; lat: number; z: number }

/**
 * Re-centre `view` at zoom `z` so the ground point sitting `dx`,`dy` pixels from
 * the frame centre stays exactly there. Without this a zoom drifts away from
 * whatever the cursor was pointing at, which is the difference between a map
 * that zooms and a map that feels like one.
 *
 * Offsets are in frame pixels, which are world pixels at the view's own zoom —
 * that identity is what lets the arithmetic stay this short.
 */
export function zoomAbout(view: View, z: number, dx: number, dy: number): View {
    const [px, py] = lonLatToPixel(view.lon, view.lat, view.z);
    const [alon, alat] = pixelToLonLat(px + dx, py + dy, view.z);
    const [apx, apy] = lonLatToPixel(alon, alat, z);
    const [lon, lat] = pixelToLonLat(apx - dx, apy - dy, z);
    return { lon, lat, z };
}

/** Move a view by a drag of `dx`,`dy` frame pixels. */
export function panBy(view: View, dx: number, dy: number): View {
    const [px, py] = lonLatToPixel(view.lon, view.lat, view.z);
    const [lon, lat] = pixelToLonLat(px - dx, py - dy, view.z);
    return { lon, lat, z: view.z };
}

/** Rings of a Polygon/MultiPolygon as pixel paths inside the grid's box. */
export function ringsToPaths(
    geometry: { type: string; coordinates: any } | null,
    grid: TileGrid,
): string[] {
    if (!geometry) return [];
    const rings: number[][][] =
        geometry.type === 'Polygon' ? geometry.coordinates
        : geometry.type === 'MultiPolygon' ? geometry.coordinates.flat()
        : [];

    const paths: string[] = [];
    for (const ring of rings) {
        if (!Array.isArray(ring) || ring.length < 3) continue;
        const pts = ring.map(([lon, lat]) => {
            const [px, py] = lonLatToPixel(lon, lat, grid.z);
            return `${(px - grid.originX).toFixed(1)},${(py - grid.originY).toFixed(1)}`;
        });
        paths.push(`M${pts.join('L')}Z`);
    }
    return paths;
}

/** Metres per pixel at this latitude and zoom — for the scale bar. */
export function metresPerPixel(lat: number, z: number): number {
    return (156543.03392 * Math.cos(lat * Math.PI / 180)) / Math.pow(2, z);
}

/** A round scale-bar length: the widest of 1/2/5×10ⁿ metres that fits `maxPx`. */
export function scaleBar(lat: number, z: number, maxPx = 90): { metres: number; px: number } {
    const mpp = metresPerPixel(lat, z);
    const maxMetres = mpp * maxPx;
    let best = 1;
    for (let pow = 0; pow <= 5; pow++) {
        for (const mult of [1, 2, 5]) {
            const candidate = mult * Math.pow(10, pow);
            if (candidate <= maxMetres) best = candidate;
        }
    }
    return { metres: best, px: Math.round(best / mpp) };
}
