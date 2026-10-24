// Finished reports: download to the device (Android → Downloads, iPhone → Files)
// or hand to the share sheet. Both must run straight from a tap.
const asFile = (blob: Blob, filename: string) => new File([blob], filename, { type: blob.type });

export function downloadFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const canShareFile = (blob: Blob, filename: string) => !!navigator.canShare?.({ files: [asFile(blob, filename)] });

/** Resolves false when the person closes the share sheet. */
export async function shareFile(blob: Blob, filename: string): Promise<boolean> {
    try { await navigator.share({ files: [asFile(blob, filename)], title: filename }); return true; }
    catch (e) { if ((e as DOMException)?.name === 'AbortError') return false; throw e; }
}
