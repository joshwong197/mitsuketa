import type { NodeData } from '../types';
import { getStatusBucket } from './statusRamp';

export type EntityStatusInput = Partial<NodeData> & { isRemoved?: boolean };

/** One register-status interpretation for charts, record cards and case alerts. */
export function entityStatus(input: EntityStatusInput) {
    const status = input.status || input.externalAdminType || '';
    const bucket = getStatusBucket({ ...input, status: input.isRemoved && !status ? 'Removed' : status } as NodeData);
    const alerts: Array<{ label: string; historical: boolean }> = [];
    if (input.companyCheck === 'unavailable') alerts.push({ label: 'Company check incomplete', historical: false });
    if (input.disqualifiedCheck === 'unavailable') alerts.push({ label: 'Disqualification check unavailable', historical: false });
    if (input.insolvencyCheck === 'unavailable') alerts.push({ label: 'Insolvency check incomplete', historical: false });
    if (input.isDisqualified) alerts.push({ label: 'Disqualified director record', historical: false });
    if (input.hasInsolvencyRecord) alerts.push({ label: 'Insolvency record', historical: input.insolvencyCurrent === false });
    if (input.isInExternalAdmin || /liquidat|receiver|administration|statutory/i.test(status)) {
        alerts.push({ label: input.externalAdminType || status || 'External administration', historical: false });
    }
    if (input.removalCommenced) alerts.push({ label: 'Removal commenced', historical: false });
    if (bucket === 'faded' || bucket === 'amalgamated' || input.isRemoved || /removed|struck|deregister|dissolv|deleted|amalgamat/i.test(status)) alerts.push({ label: status || 'Removed', historical: false });
    if (input.hasHistoricInsolvency) alerts.push({ label: input.historicInsolvencyType ? `Previous ${input.historicInsolvencyType}` : 'Historical insolvency', historical: true });
    if (bucket === 'crit' && !alerts.length) alerts.push({ label: status || 'Insolvency record', historical: false });
    const tone = bucket === 'crit' ? 'critical' as const
        : bucket === 'faded' || bucket === 'amalgamated' ? 'removed' as const
        : input.removalCommenced ? 'removal' as const
        : bucket === 'warning' ? 'administration' as const : 'normal' as const;
    return { bucket, tone, label: status || 'Status not supplied', alerts };
}
