import type { GraphNode } from '../types';

const fields = ['entityStatusDescription', 'status', 'isInExternalAdmin', 'externalAdminType', 'removalCommenced', 'hasHistoricInsolvency', 'historicInsolvencyType', 'isDisqualified', 'hasInsolvencyRecord', 'insolvencyCurrent', 'disqualifiedCheck', 'insolvencyCheck', 'companyCheck'] as const;
/** Patch status only; never restore old geometry, membership or view state. */
export function mergeRegisterData(latest: GraphNode[], updates: GraphNode[]): GraphNode[] {
    const byId = new Map(updates.map(n => [n.id, n.data]));
    return latest.map(node => {
        const data = byId.get(node.id);
        if (!data) return node;
        return { ...node, data: { ...node.data, ...Object.fromEntries(fields.filter(key => key in data).map(key => [key, data[key]])) } };
    });
}
