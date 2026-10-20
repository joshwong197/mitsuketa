import React from 'react';
import { PersonCompanyResult, PersonRegisterChecks } from '../types';
import { insolvencyLinkedSummary } from '../utils/insolvencyTiming';
import './person-results.css';

export const PersonRoleSeal: React.FC<{ director: boolean; shareholder: boolean }> = ({ director, shareholder }) => (
    <span className="person-role-seal" role="img" aria-label={director && shareholder ? 'Director and shareholder' : director ? 'Director' : shareholder ? 'Shareholder' : 'Individual'}>
        <span className="person-role-seal-inner" aria-hidden="true">
            {director && shareholder ? <>
                <span className="person-role-shareholder">株</span>
                <span className="person-role-director">締</span>
                <span className="person-role-divider" />
            </> : <span>{director ? '締' : shareholder ? '株' : '人'}</span>}
        </span>
    </span>
);

export const PersonSubjectCard: React.FC<{
    name: string;
    results: PersonCompanyResult[];
    checks?: PersonRegisterChecks;
    currentDisqualification: boolean;
    currentInsolvency: boolean;
    disqualificationCount: number;
    insolvencyCount: number;
}> = ({ name, results, checks, currentDisqualification, currentInsolvency, disqualificationCount, insolvencyCount }) => {
    const directors = results.filter(r => r.isDirector).length;
    const shareholders = results.filter(r => r.shareholding > 0).length;
    const roles = [directors ? 'Director' : '', shareholders ? 'Shareholder' : ''].filter(Boolean).join(' · ') || 'Individual';
    const findings = [
        disqualificationCount ? `Disqualification Name Match${disqualificationCount > 1 ? 'es' : ''} · ${disqualificationCount}${currentDisqualification ? ' · Current Finding Returned' : ''}` : '',
        insolvencyCount ? `${currentInsolvency ? 'Insolvency' : 'Historical Insolvency'} Name Match${insolvencyCount > 1 ? 'es' : ''} · ${insolvencyCount}${currentInsolvency ? ' · Current Finding Returned' : ''}` : '',
    ].filter(Boolean);
    const incomplete = checks?.disqualified !== 'complete' || checks?.insolvency !== 'complete';
    const current = currentDisqualification || currentInsolvency;
    const { count: linkedCount, line: linkedLine } = insolvencyLinkedSummary(results);
    const stamp = checks?.checkedAt && Number.isFinite(checks.checkedAt)
        ? new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(checks.checkedAt) : null;

    return <section className={`person-subject-card${current ? ' has-current-finding' : linkedCount ? ' sumi-insolvency-history' : ''}`} aria-label="Individual search subject">
        <div className="person-subject-spine" aria-hidden="true"><span>人</span><small>見つけた</small></div>
        <div className="person-subject-main">
            <div className="person-subject-row">
                <div className="person-subject-identity">
                    <p className="person-subject-source">Individual search · Companies Office</p>
                    <div className="person-subject-name-row">
                        <PersonRoleSeal director={directors > 0} shareholder={shareholders > 0} />
                        <div><h2>{name}</h2><p className="person-subject-roles">{roles}</p></div>
                    </div>
                </div>
                <dl className="person-subject-counts">
                    <div><dt>Company matches</dt><dd>{results.length}</dd></div>
                    <div><dt>Directorships</dt><dd>{directors}</dd></div>
                    <div><dt>Shareholdings</dt><dd>{shareholders}</dd></div>
                    {linkedCount > 0 && <div className="person-subject-count-crit"><dt>Insolvency-linked</dt><dd>{linkedCount}</dd></div>}
                </dl>
            </div>
            <div className="person-subject-footer">
                <div className="person-subject-findings">
                    {findings.length ? findings.map(f => <p key={f}>{f}</p>) : <p>{incomplete ? 'Register check completion not available' : 'No Insolvency or Disqualification Name Matches Returned'}</p>}
                    {findings.length > 0 && <small>Review identifying details below</small>}
                    {linkedLine && <p className="person-subject-linked">{linkedLine}</p>}
                    {checks?.disqualified === 'unavailable' && <p className="person-check-unavailable">Disqualified directors check unavailable</p>}
                    {checks?.insolvency === 'unavailable' && <p className="person-check-unavailable">Insolvency check unavailable</p>}
                </div>
                {stamp && !incomplete && <small>Checked {stamp}</small>}
            </div>
            <p className="person-subject-count-note">Counts include historical roles where returned. Directorship and shareholding counts can overlap.</p>
        </div>
    </section>;
};
