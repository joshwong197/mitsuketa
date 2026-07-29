// Self-check for utils/tiles.ts — run with `npm run check:tiles`.
//
// The parcel map has no visual test in CI, so the arithmetic that places it is
// checked here: the grid must stay inside its tile budget and the world bounds,
// and the outline must land inside the visible box at a sane zoom.
import { tileGrid, ringsToPaths, scaleBar } from './tiles.ts';
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
console.log(`ok - zoom ${grid.z}, ${grid.tiles.length} tiles, scale ${bar.metres}m/${bar.px}px, parcel inside box`);
