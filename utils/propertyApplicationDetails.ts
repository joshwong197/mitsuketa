// Shared questionnaire schema. These answers support manual review, not automatic approval.
export const applicationOptions = {
    use: ['Property purchase or ownership', 'Legal or professional advice', 'Lending or financial assessment', 'Research or public-interest work', 'Other'],
    volume: ['1–10 searches', '11–50 searches', '51–200 searches', 'More than 200 searches', 'Not sure yet'],
    sharing: ['Only me', 'People within my organisation', 'Clients or professional advisers', 'Public reports, websites or other distribution', 'Not sure yet'],
} as const;
export interface ApplicationDetails {
    version: 1; fullName: string; role: string; use: string; volume: string;
    sharing: string; recipients: string; safeguards: string; confirmed: true;
}
export function parseApplicationDetails(value: unknown): ApplicationDetails {
    if (!value || typeof value !== 'object') throw new Error('Complete the application questions.');
    const input = value as Record<string, unknown>;
    const field = (key: string, label: string, max: number) => {
        const raw = input[key];
        if (typeof raw !== 'string' || !raw.trim() || raw.trim().length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(raw))
            throw new Error(`Check ${label}.`);
        return raw.trim();
    };
    const choice = (key: keyof typeof applicationOptions) => {
        const result = field(key, key, 100);
        if (!(applicationOptions[key] as readonly string[]).includes(result)) throw new Error(`Choose an option for ${key}.`);
        return result;
    };
    if (input.version !== 1 || input.confirmed !== true) throw new Error('Confirm that your application is accurate and complete.');
    return { version: 1, fullName: field('fullName', 'your name', 160), role: field('role', 'your role or capacity', 160),
        use: choice('use'), volume: choice('volume'), sharing: choice('sharing'),
        recipients: field('recipients', 'who will receive the information', 1000),
        safeguards: field('safeguards', 'how you will store and protect the information', 1000), confirmed: true };
}
