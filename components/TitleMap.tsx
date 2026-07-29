import React, { useMemo, useState } from 'react';
import { tileUrl } from '../services/propertyService.js';
import { ringsToPaths, scaleBar, tileGrid } from '../utils/tiles.js';

/**
 * 地図 — the parcel on LINZ aerial imagery, with its title outline drawn over.
 *
 * No mapping library: a parcel map is a fixed mosaic of tiles with one polygon
 * on top, which utils/tiles.ts works out in a dozen lines of arithmetic. That
 * keeps it static, printable, and identical in the HTML export.
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

export const TitleMap: React.FC<TitleMapProps> = ({
    geometry, bbox, width = 640, height = 300,
}) => {
    // A tile that fails is left blank rather than showing a broken image: the
    // outline and the rest of the mosaic still read.
    const [failed, setFailed] = useState<Set<string>>(new Set());

    const model = useMemo(() => {
        if (!bbox || !geometry) return null;
        const grid = tileGrid(bbox, width, height);
        return {
            grid,
            paths: ringsToPaths(geometry, grid),
            bar: scaleBar((bbox[1] + bbox[3]) / 2, grid.z),
        };
    }, [geometry, bbox, width, height]);

    // Unit titles and some cross-leases carry no outline. Say nothing rather
    // than render an empty frame.
    if (!model) return null;
    const { grid, paths, bar } = model;

    return (
        <figure style={{ margin: 0 }}>
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: `${width} / ${height}`,
                    overflow: 'hidden',
                    border: '1px solid var(--rule)',
                    background: 'var(--paper2)',
                }}
            >
                <div style={{ position: 'absolute', inset: 0 }}>
                    {grid.tiles.map(t => {
                        const key = `${t.z}/${t.x}/${t.y}`;
                        if (failed.has(key)) return null;
                        return (
                            <img
                                key={key}
                                src={tileUrl(t.z, t.x, t.y)}
                                alt=""
                                aria-hidden="true"
                                draggable={false}
                                onError={() => setFailed(prev => new Set(prev).add(key))}
                                style={{
                                    // Percentages, not pixels: the mosaic then
                                    // scales with the container in step with the
                                    // SVG's viewBox, with no resize listener to
                                    // leak and nothing to drift out of register.
                                    position: 'absolute',
                                    left: `${(t.left / width) * 100}%`,
                                    top: `${(t.top / height) * 100}%`,
                                    width: `${(256 / width) * 100}%`,
                                    height: `${(256 / height) * 100}%`,
                                    userSelect: 'none',
                                }}
                            />
                        );
                    })}

                    <svg
                        viewBox={`0 0 ${width} ${height}`}
                        preserveAspectRatio="none"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                        role="img"
                        aria-label="Title boundary on aerial imagery"
                    >
                        {paths.map((d, i) => (
                            <React.Fragment key={i}>
                                {/* Paper-coloured underlay so the ink outline
                                    reads over dark roofs and dark vegetation. */}
                                <path d={d} fill="none" stroke="var(--paper)" strokeWidth={4.5} opacity={0.65} />
                                <path
                                    d={d}
                                    fill="var(--accent)"
                                    fillOpacity={0.14}
                                    stroke="var(--accent)"
                                    strokeWidth={2}
                                    strokeLinejoin="round"
                                />
                            </React.Fragment>
                        ))}

                        {/* Scale bar lives inside the viewBox so it scales with
                            the imagery — a pixel-sized bar would report the
                            wrong distance at any container width. */}
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
            </div>
            <figcaption
                className="text-ink-pale"
                style={{ fontSize: 10.5, marginTop: 5, lineHeight: 1.5 }}
            >
                Title boundary over aerial imagery ·{' '}
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
