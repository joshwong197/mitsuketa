import React, { useEffect, useRef, useState } from 'react';
import type { ApiConfig } from '../types';
import { loadEntityRecord } from '../services/entityRecordService';
import { EntityRecord } from './EntityRecord';
export { registerDate } from './EntityRecord';
import type { EntityProfile } from '../services/entityProfile';

export const EntityDetailsPanel: React.FC<{ nzbn: string; config: ApiConfig; onClose: () => void }> = ({ nzbn, config, onClose }) => {
    const [profile, setProfile] = useState<EntityProfile | null>(null);
    const [error, setError] = useState('');
    const [refresh, setRefresh] = useState(0);
    const closeRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        closeRef.current?.focus();
        return () => previous?.focus();
    }, []);
    useEffect(() => {
        let active = true;
        setProfile(null); setError('');
        loadEntityRecord(nzbn, config, refresh > 0).then(record => {
            if (active) setProfile(record);
        }).catch(() => { if (active) setError('Could not load the register record. Please try again.'); });
        return () => { active = false; };
    }, [nzbn, config.nzbnKey, refresh]);
    return <section role="region" aria-labelledby="entity-details-title" className="sumi-dossier sumi-record-workspace bg-paper text-ink"
            onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
            <header className="sumi-dossier-header">
                <div className="sumi-dossier-title"><span className="sumi-tool-mark" aria-hidden="true">簿</span><div><h2 id="entity-details-title">Entity details</h2><p>The register record</p></div></div>
                <div className="sumi-view-switch" role="group" aria-label="Entity view">
                  <button ref={closeRef} onClick={onClose} aria-label="Back to network"><span aria-hidden="true">網</span> Network</button>
                  <span aria-current="page"><span aria-hidden="true">簿</span> Record</span>
                </div>
            </header>
            <div className="sumi-dossier-body">
                {error && <p role="alert">{error} <button className="text-accent underline" onClick={() => setRefresh(n => n + 1)}>Retry</button></p>}
                {!profile && !error && <p role="status">Loading register information…</p>}
                {profile && <EntityRecord profile={profile} onRefresh={() => setRefresh(n => n + 1)} />}
            </div>
        </section>;
}
