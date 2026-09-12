import React, { useEffect, useMemo, useRef, useState } from 'react';
import { tileUrl } from '../services/propertyService.js';
import {
    MAX_ZOOM, MIN_ZOOM, type View,
    bboxCentre, gridAt, panBy, ringsToPaths, scaleBar, tileGrid, zoomAbout,
} from '../utils/tiles.js';

/**
 * 地図 — the parcel on LINZ aerial imagery, with its title outline drawn over,
 * pannable by drag and zoomable by wheel.
 *
 * No mapping library: a view is a centre and a zoom, which utils/tiles.ts turns
 * into a tile mosaic in a dozen lines of arithmetic. Interaction only moves
 * those two numbers, so the whole map stays one pure function of its state.
 *
 * This interactivity is deliberately NOT carried into the HTML export. The
 * export has no server to fetch tiles from — services/exportService.ts inlines
 * a fixed mosaic as base64 into a standalone SVG — so the exported map stays
 * the static fitted view it has always been. Nothing here is bundled into it.
 *
 * The imagery is LINZ Basemaps under CC BY 4.0 — attribution is a licence
 * condition, not decoration, so the credit line is not optional and must not be
 * removed. Tiles are proxied through /api/property so the LINZ key stays on the
 * server, like every other LINZ call in this app.
 */

export interface TitleMapProps {
    geometry?: { type: string; coordinates: any } | null;
    bbox?: [number, number, number, number] | null;
    width?: number;
    height?: number;
}

/** How many levels to step back looking for imagery before giving up. */
const MAX_ZOOM_RETRIES = 4;
/**
 * How far out the wheel may go. LINZ imagery is useless as a locator much above
 * a whole-district view, and letting the wheel run to the world would strand
 * someone miles from a parcel they cannot see to steer back to.
 */
const MIN_VIEW_ZOOM = 9;
/** Wheel notch to zoom levels. One detent ≈ a third of a level: fine, not jumpy. */
const WHEEL_LINES = 0.12;
const WHEEL_PIXELS = 0.004;

const keyOf = (t: { z: number; x: number; y: number }) => `${t.z}/${t.x}/${t.y}`;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const TitleMap: React.FC<TitleMapProps> = ({
    geometry, bbox, width = 640, height = 300,
}) => {
    // A tile that fails is left blank rather than showing a broken image: the
    // outline and the rest of the mosaic still read.
    const [failed, setFailed] = useState<Set<string>>(new Set());
    // Whether ANY tile has painted. LINZ holds imagery to a different depth in
    // different places, so a grid can come back wholly empty at one zoom and be
    // fine one level out — but a map that has already drawn must never be
    // replaced by an error, which is what made this look like it worked and
    // then broke.
    const [anyLoaded, setAnyLoaded] = useState(false);
    const [zoomOut, setZoomOut] = useState(0);
    // null means "still framed on the parcel". The fitted view is derived, not
    // stored, so a retry or a new title reframes without the user's pan fighting
    // it; the first interaction seeds this and takes over.
    const [view, setView] = useState<View | null>(null);
    const [dragging, setDragging] = useState(false);

    const frameRef = useRef<HTMLDivElement>(null);
    // The view as it was when the drag began. Panning against the anchor rather
    // than accumulating per-move deltas means no rounding drift over a long drag.
    const anchor = useRef<{ id: number; x: number; y: number; view: View } | null>(null);

    /** The default framing: the parcel, fitted, exactly as before. */
    const fitted = useMemo((): View | null => {
        if (!bbox || !geometry) return null;
        const [lon, lat] = bboxCentre(bbox);
        return { lon, lat, z: tileGrid(bbox, width, height, 20, zoomOut).z };
    }, [geometry, bbox, width, height, zoomOut]);

    const current = view ?? fitted;
    const zLo = Math.min(MIN_VIEW_ZOOM, fitted?.z ?? MIN_VIEW_ZOOM);

    const model = useMemo(() => {
        if (!geometry || !current) return null;
        // Tiles exist only at integer zooms. A fractional zoom renders the
        // nearest level and scales it — at most √2 either way, so imagery is
        // never softer than a half-step of resampling.
        const zTile = clamp(Math.round(current.z), MIN_ZOOM, MAX_ZOOM);
        const s = Math.pow(2, current.z - zTile);
        const iw = width / s;
        const ih = height / s;
        const grid = gridAt(current.lon, current.lat, zTile, iw, ih);
        return {
            grid, s, iw, ih,
            paths: ringsToPaths(geometry, grid),
            bar: scaleBar(current.lat, current.z),
        };
    }, [geometry, current, width, height]);

    // Only failures belonging to the CURRENT grid count. Stepping the zoom
    // changes every tile key, and stale keys from the previous attempt would
    // otherwise instantly condemn the new grid.
    const missing = model
        ? model.grid.tiles.filter(t => failed.has(keyOf(t))).length
        : 0;
    // Coverage hunting applies to the fitted view only. Once the map is being
    // driven by hand, an empty grid means "you panned somewhere without imagery"
    // — reframing or erroring out from under the user would be wrong.
    const allMissing = !view && !!model
        && model.grid.tiles.length > 0 && missing >= model.grid.tiles.length;

    useEffect(() => {
        if (allMissing && !anyLoaded && zoomOut < MAX_ZOOM_RETRIES) {
            setZoomOut(z => z + 1);
            setFailed(new Set());
        }
    }, [allMissing, anyLoaded, zoomOut]);

    // A different title resets the search entirely, pan and zoom included.
    useEffect(() => {
        setFailed(new Set());
        setAnyLoaded(false);
        setZoomOut(0);
        setView(null);
    }, [geometry, bbox]);

    // Wheel is bound by hand because React's synthetic listener is passive, and
    // a passive handler cannot preventDefault — the page would scroll under the
    // zoom.
    useEffect(() => {
        const el = frameRef.current;
        if (!el || !current) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            if (!rect.width) return;
            // Client pixels to model pixels; the frame holds its aspect ratio,
            // so one factor serves both axes.
            const k = width / rect.width;
            const dx = (e.clientX - rect.left) * k - width / 2;
            const dy = (e.clientY - rect.top) * k - height / 2;
            const step = -e.deltaY * (e.deltaMode === 1 ? WHEEL_LINES : WHEEL_PIXELS);

            setView(v => {
                const from = v ?? current;
                const z = clamp(from.z + step, zLo, MAX_ZOOM);
                if (z === from.z) return v ?? from;
                return zoomAbout(from, z, dx, dy);
            });
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [current, width, height, zLo]);

    // Unit titles and some cross-leases carry no outline. Say nothing rather
    // than render an empty frame.
    if (!model || !current) return null;
    const { grid, s, iw, ih, paths, bar } = model;

    // Only after every retry has come back empty, and nothing ever painted, is
    // the imagery genuinely unavailable.
    if (allMissing && !anyLoaded && zoomOut >= MAX_ZOOM_RETRIES) {
        return (
            <p
                className="text-ink-mid"
                style={{ border: '1px solid var(--rule)', padding: '11px 14px', fontSize: 12.5, margin: 0 }}
            >
                No aerial imagery covers this parcel at any available zoom.
                <span className="text-ink-pale">
                    {' '}If this is unexpected, check LINZ_BASEMAPS_KEY — the server log records the
                    exact status returned by LINZ Basemaps.
                </span>
            </p>
        );
    }

    const beginDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        // Mouse and pen only. Claiming touch would mean swallowing the page
        // scroll on a phone to pan a map nobody asked to pan there.
        if (e.pointerType === 'touch' || e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        anchor.current = { id: e.pointerId, x: e.clientX, y: e.clientY, view: current };
        setDragging(true);
    };

    const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        const a = anchor.current;
        if (!a || a.id !== e.pointerId) return;
        const rect = e.currentTarget.getBoundingClientRect();
        if (!rect.width) return;
        const k = width / rect.width;
        setView(panBy(a.view, (e.clientX - a.x) * k, (e.clientY - a.y) * k));
    };

    const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        if (anchor.current?.id !== e.pointerId) return;
        anchor.current = null;
        setDragging(false);
    };

    return (
        <figure style={{ margin: 0 }}>
            <div
                ref={frameRef}
                onPointerDown={beginDrag}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                // Getting back to the parcel has to be possible without hunting
                // for it. Double-click drops the hand-driven view and the fitted
                // one takes over again.
                onDoubleClick={() => setView(null)}
                title="Drag to pan · scroll to zoom · double-click to refit"
                style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: `${width} / ${height}`,
                    overflow: 'hidden',
                    border: '1px solid var(--rule)',
                    background: 'var(--paper2)',
                    cursor: dragging ? 'grabbing' : 'grab',
                }}
            >
                <div
                    style={{
                        // The mosaic is built for a box of iw×ih model pixels and
                        // then scaled onto the frame, which is what turns integer
                        // tile levels into continuous zoom.
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        width: `${(iw / width) * 100}%`,
                        height: `${(ih / height) * 100}%`,
                        transform: `translate(-50%, -50%) scale(${s})`,
                        transformOrigin: 'center',
                        // Pointer handling belongs to the frame; the layer moving
                        // underneath must not intercept it.
                        pointerEvents: 'none',
                    }}
                >
                    {grid.tiles.map(t => {
                        const key = keyOf(t);
                        if (failed.has(key)) return null;
                        return (
                            <img
                                key={key}
                                src={tileUrl(t.z, t.x, t.y)}
                                alt=""
                                aria-hidden="true"
                                draggable={false}
                                onLoad={() => setAnyLoaded(true)}
                                onError={() => setFailed(prev => {
                                    if (prev.has(key)) return prev;
                                    return new Set(prev).add(key);
                                })}
                                style={{
                                    // Percentages, not pixels: the mosaic then
                                    // scales with the container in step with the
                                    // SVG's viewBox, with no resize listener to
                                    // leak and nothing to drift out of register.
                                    position: 'absolute',
                                    left: `${(t.left / iw) * 100}%`,
                                    top: `${(t.top / ih) * 100}%`,
                                    width: `${(256 / iw) * 100}%`,
                                    height: `${(256 / ih) * 100}%`,
                                    userSelect: 'none',
                                }}
                            />
                        );
                    })}

                    <svg
                        viewBox={`0 0 ${iw} ${ih}`}
                        preserveAspectRatio="none"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                        role="img"
                        aria-label="Title boundary on aerial imagery"
                    >
                        {paths.map((d, i) => (
                            <React.Fragment key={i}>
                                {/* Paper-coloured underlay so the ink outline
                                    reads over dark roofs and dark vegetation.
                                    Widths divide by the layer scale so the
                                    outline keeps its weight through a zoom. */}
                                <path d={d} fill="none" stroke="var(--paper)" strokeWidth={4.5 / s} opacity={0.65} />
                                <path
                                    d={d}
                                    fill="var(--accent)"
                                    fillOpacity={0.14}
                                    stroke="var(--accent)"
                                    strokeWidth={2 / s}
                                    strokeLinejoin="round"
                                />
                            </React.Fragment>
                        ))}
                    </svg>
                </div>

                {/* The scale bar sits OUTSIDE the scaled layer: it reports a real
                    distance, so it must be measured against the frame rather
                    than ride the transform that stretches the imagery. */}
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    preserveAspectRatio="none"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                    aria-hidden="true"
                >
                    <g transform={`translate(12 ${height - 20})`}>
                        <rect x={-4} y={-11} width={bar.px + 52} height={22} fill="var(--paper)" opacity={0.82} />
                        <path
                            d={`M0,-4 L0,3 M0,0 L${bar.px},0 M${bar.px},-4 L${bar.px},3`}
                            stroke="var(--ink)"
                            strokeWidth={1.2}
                            fill="none"
                        />
                        <text
                            x={bar.px + 7}
                            y={4}
                            fill="var(--ink)"
                            style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
                        >
                            {bar.metres} m
                        </text>
                    </g>
                </svg>
            </div>
            <figcaption
                className="text-ink-pale"
                style={{ fontSize: 10.5, marginTop: 5, lineHeight: 1.5 }}
            >
                Title boundary over aerial imagery · drag to pan, scroll to zoom, double-click to refit ·{' '}
                <a
                    href="https://basemaps.linz.govt.nz/"
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}
                >
                    LINZ Basemaps
                </a>{' '}
                CC BY 4.0. Imagery date varies by region and may predate recent works.
            </figcaption>
        </figure>
    );
};

export default TitleMap;
