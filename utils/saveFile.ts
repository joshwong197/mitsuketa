// Hand a finished report to the user. On a phone that means the share sheet
// (Save to Files, Mail, WhatsApp); elsewhere, or where file sharing is not
// supported, a normal download. Call it straight from a tap: browsers only
// allow the share sheet during a user gesture.
export async function saveFile(blob: Blob, filename: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
    const file = new File([blob], filename, { type: blob.type });
    const phone = window.matchMedia('(max-width: 767px)').matches;
    if (phone && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: filename }); return 'shared'; }
        catch (e) { if ((e as DOMException)?.name === 'AbortError') return 'cancelled'; }
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return 'downloaded';
}
