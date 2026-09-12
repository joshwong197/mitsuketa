// Self-check for utils/tiles.ts — run with `npm run check:tiles`.
//
// The parcel map has no visual test in CI, so the arithmetic that places it is
// checked here: the grid must stay inside its tile budget and the world bounds,
// and the outline must land inside the visible box at a sane zoom.
import {
    tileGrid, ringsToPaths, scaleBar,
    gridAt, lonLatToPixel, pixelToLonLat, panBy, zoomAbout,
} from './tiles.ts';
import assert from 'node:assert';
// A real Penrose-sized parcel (~8,377 m²), lon/lat WGS84.
const bbox: [number, number, number, number] = [174.8155, -36.9105, 174.8172, -36.9092];
const grid = tileGrid(bbox, 640, 300);
assert.ok(grid.tiles.length > 0 && grid.tiles.length <= 20, `tiles ${grid.tiles.length}`);
assert.ok(grid.z >= 14 && grid.z <= 22, `zoom ${grid.z}`);
// Every tile index must be in range for its zoom.
const span = 2 ** grid.z;
for (const t of grid.tiles) assert.ok(t.x >= 0 && t.x < span && t.y >= 0 && t.y < span, 'tile in range');
// The parcel must land inside the visible box.
const poly = { type: 'Polygon', coordinates: [[
  [bbox[0], bbox[1]], [bbox[2], bbox[1]], [bbox[2], bbox[3]], [bbox[0], bbox[3]], [bbox[0], bbox[1]],
]] };
const paths = ringsToPaths(poly, grid);
assert.equal(paths.length, 1);
const nums = (paths[0].match(/-?\d+\.\d+/g) ?? []).map(Number);
const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
assert.ok(Math.min(...xs) > 0 && Math.max(...xs) < 640, `x in box: ${Math.min(...xs)}..${Math.max(...xs)}`);
assert.ok(Math.min(...ys) > 0 && Math.max(...ys) < 300, `y in box: ${Math.min(...ys)}..${Math.max(...ys)}`);
// Scale bar must be a round number and fit.
const bar = scaleBar(-36.91, grid.z);
assert.ok([1,2,5,10,20,50,100,200,500].includes(bar.metres), `round: ${bar.metres}`);
assert.ok(bar.px > 0 && bar.px <= 90, `px ${bar.px}`);
// A tiny parcel must not blow past max zoom.
const tiny = tileGrid([174.8160, -36.9100, 174.81605, -36.90995] as [number, number, number, number], 640, 300);
assert.ok(tiny.z <= 22, `tiny zoom ${tiny.z}`);

// --- interactive map arithmetic -------------------------------------------
// Pan and cursor-anchored zoom both work by moving a point in pixel space and
// asking where on the ground it landed, so the projection has to invert cleanly
// and the anchor has to actually hold.
const [clon, clat] = [174.81635, -36.90985];
for (const z of [9, 14.4, 17, 19.75, 20]) {
  const [px, py] = lonLatToPixel(clon, clat, z);
  const [rlon, rlat] = pixelToLonLat(px, py, z);
  assert.ok(Math.abs(rlon - clon) < 1e-9, `lon round trip at z${z}: ${rlon}`);
  assert.ok(Math.abs(rlat - clat) < 1e-9, `lat round trip at z${z}: ${rlat}`);
}

// gridAt must centre the box on the point it was given.
const at = gridAt(clon, clat, 18, 640, 300);
const [gx, gy] = lonLatToPixel(clon, clat, 18);
assert.ok(Math.abs((at.originX + 320) - gx) < 1e-6, 'gridAt centres x');
assert.ok(Math.abs((at.originY + 150) - gy) < 1e-6, 'gridAt centres y');
assert.ok(at.tiles.length > 0 && at.tiles.length <= 20, `gridAt tiles ${at.tiles.length}`);

// The refactor must not have moved the fitted grid: bbox-fitting is still the
// export's code path and its output has to be byte-for-byte what it was.
const viaCentre = gridAt((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2, grid.z, 640, 300);
assert.deepEqual(viaCentre, grid, 'tileGrid still equals gridAt at the fitted zoom');

// Zooming about a cursor offset must leave the ground under that offset put.
const before = { lon: clon, lat: clat, z: 17 };
for (const [dx, dy, z2] of [[220, -95, 18.6], [-300, 140, 15.25], [0, 0, 19]] as const) {
  const after = zoomAbout(before, z2, dx, dy);
  const [bx, by] = lonLatToPixel(before.lon, before.lat, before.z);
  const held = pixelToLonLat(bx + dx, by + dy, before.z);
  const [ax, ay] = lonLatToPixel(after.lon, after.lat, after.z);
  const now = pixelToLonLat(ax + dx, ay + dy, after.z);
  // Sub-millimetre on the ground, i.e. exact for anything a screen can show.
  assert.ok(Math.abs(now[0] - held[0]) < 1e-9, `anchor lon holds (${dx},${dy}→z${z2})`);
  assert.ok(Math.abs(now[1] - held[1]) < 1e-9, `anchor lat holds (${dx},${dy}→z${z2})`);
}

// A drag and its reverse must return the view exactly where it started.
const panned = panBy(panBy(before, 137, -64), -137, 64);
assert.ok(Math.abs(panned.lon - before.lon) < 1e-9, `pan round trip lon ${panned.lon}`);
assert.ok(Math.abs(panned.lat - before.lat) < 1e-9, `pan round trip lat ${panned.lat}`);
// ...and a drag must move the ground by exactly the pixels dragged.
const east = panBy(before, -256, 0);
const [ex] = lonLatToPixel(east.lon, east.lat, before.z);
const [ox] = lonLatToPixel(before.lon, before.lat, before.z);
assert.ok(Math.abs((ex - ox) - 256) < 1e-6, `pan moves 256px, got ${ex - ox}`);

// Dragging far past the pole must clamp, not produce NaN. Dragging the imagery
// up walks the view south, so this lands on the Mercator limit at -85.05.
const polar = panBy({ lon: 174, lat: -84, z: 9 }, 0, -1e7);
assert.ok(Number.isFinite(polar.lat) && polar.lat < -85, `pole clamps, got ${polar.lat}`);

console.log(`ok - zoom ${grid.z}, ${grid.tiles.length} tiles, scale ${bar.metres}m/${bar.px}px, parcel inside box`);
console.log('ok - pan/zoom: projection inverts, cursor anchor holds, drag is exact, pole clamps');
