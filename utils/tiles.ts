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
const MIN_ZOOM = 1;

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

    for (;;) {
        const [minx, miny, maxx, maxy] = bbox;
        const [cx, cy] = lonLatToPixel((minx + maxx) / 2, (miny + maxy) / 2, z);
        // Top-left of the visible box in absolute world pixels.
        const originX = cx - width / 2;
        const originY = cy - height / 2;

        const scale = Math.pow(2, z);
        const firstX = Math.floor(originX / TILE_SIZE);
        const firstY = Math.floor(originY / TILE_SIZE);
        const lastX = Math.floor((originX + width) / TILE_SIZE);
        const lastY = Math.floor((originY + height) / TILE_SIZE);

        const count = (lastX - firstX + 1) * (lastY - firstY + 1);
        if (count > maxTiles && z > MIN_ZOOM) { z--; continue; }

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
