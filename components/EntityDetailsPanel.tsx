import React, { useEffect, useRef, useState } from 'react';
import type { ApiConfig } from '../types';
import { loadEntityRecord } from '../services/entityRecordService';
import { cachedEntityProfile } from '../services/entityProfile';
import { EntityRecord } from './EntityRecord';
export { registerDate } from './EntityRecord';
import type { EntityStatusInput } from '../utils/entityStatus';
import type { EntityProfile } from '../services/entityProfile';

// Switching to Org Chart unmounts this panel; remember where the reader was.
const scrollPositions = new Map<string, number>();
const readyProfile = (nzbn: string) => { const p = cachedEntityProfile(nzbn); return p?.historyCheckedAt ? p : null; };

export const EntityDetailsPanel: React.FC<{ nzbn: string; statusContext?: EntityStatusInput; config: ApiConfig; onClose: () => void }> = ({ nzbn, statusContext, config, onClose }) => {
    const [profile, setProfile] = useState<EntityProfile | null>(() => readyProfile(nzbn));
    const [error, setError] = useState('');
    const [refresh, setRefresh] = useState(0);
    const closeRef = useRef<HTMLButtonElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const restored = useRef(false);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        closeRef.current?.focus();
        return () => previous?.focus();
    }, []);
    useEffect(() => {
        if (!refresh && readyProfile(nzbn)) return;
        let active = true;
        setProfile(null); setError('');
        // Paint the NZBN core straight away; history, documents and summary reports fill in as they land.
        loadEntityRecord(nzbn, config, refresh > 0, record => { if (active) setProfile(record); }).then(record => {
            if (active) setProfile(record);
        }).catch(() => { if (active) setError('Could not load the register record. Please try again.'); });
        return () => { active = false; };
    }, [nzbn, config.nzbnKey, refresh]);
    useEffect(() => {
        if (!profile || restored.current || !bodyRef.current) return;
        restored.current = true;
        bodyRef.current.scrollTop = scrollPositions.get(nzbn) || 0;
    }, [profile, nzbn]);
    return <section role="region" aria-labelledby="entity-details-title" className="sumi-dossier sumi-record-workspace bg-paper text-ink"
            onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
            <header className="sumi-dossier-header">
                <div className="sumi-dossier-title"><span className="sumi-tool-mark" aria-hidden="true">簿</span><div><h2 id="entity-details-title">Details</h2><p>The register record</p></div></div>
                <div className="sumi-view-switch" role="group" aria-label="Entity view">
                  <button ref={closeRef} onClick={onClose} aria-label="Back to Org Chart"><span aria-hidden="true">網</span> Org Chart</button>
                  <span aria-current="page"><span aria-hidden="true">簿</span> Details</span>
                </div>
            </header>
            <div className="sumi-dossier-body" ref={bodyRef} onScroll={e => scrollPositions.set(nzbn, e.currentTarget.scrollTop)}>
                {error && <p role="alert">{error} <button className="text-accent underline" onClick={() => setRefresh(n => n + 1)}>Retry</button></p>}
                {!profile && !error && <p role="status">Loading register information…</p>}
                {profile && <EntityRecord profile={profile} statusContext={statusContext} loading={!profile.historyCheckedAt} onRefresh={() => setRefresh(n => n + 1)} />}
            </div>
        </section>;
}
