import React, { useRef } from 'react';
import { MARKETING_CSS, navHTML, FOOTER_HTML, useMarketingChrome } from './marketing';

export const PROPERTY_PRIVACY_HTML = `
<h3>Property searches and matter references</h3>
<p>For each property-search attempt and title report opened, Mitsuketa records your account or credential identifier, the date and time, search mode, the search text or title number you submit, your matter reference, an audit identifier, and your IP address where available. These records are held in our Neon database and are available to authorised administrators for accountability, investigating misuse, troubleshooting and responding to data-access or correction enquiries. A failed or unmatched search can still have an audit record.</p>
<p>A matter reference is required. Use a file or case code; avoid client names or confidential case details that are not needed to identify your matter. If you do not provide a reference, you cannot run a property search. A name you type into an owner search is part of the recorded search input.</p>
<p>Returned title-report contents, including owner, mortgagee and caveator names, are not copied into the search audit or retained in a server-side report library. Property reports are held in browser memory while open. If you export a report, the downloaded copy is under your control.</p>
<h3>Saved references and service providers</h3>
<p>References you explicitly save for reuse are stored in this browser for your username. They are not synced between devices. Removing a saved reference does not erase the audit record of a search that used it. People with access to this browser may be able to read its saved data.</p>
<p>Search inputs are sent to LINZ to retrieve the requested data. Vercel hosts the application and may process request metadata and security logs. Sign-in and refused-access events are also logged. Neon stores the search audit. These providers process information needed to operate the service; the audit is not sold or used for advertising.</p>
<h3>Account approval and payment testing</h3>
<p>Where Clerk sign-in is enabled, Clerk processes account and authentication information. Mitsuketa stores a linked account identifier, email address, any organisation and intended-use details you submit for vetting, and your approval status. Property access requires the administrator's approval; signing in or buying report passes does not itself grant approval. Approval may be suspended or withdrawn.</p>
<p>Where Stripe checkout is enabled, Stripe processes payment information. Mitsuketa records checkout identifiers and report-pass transactions linked to your account. We do not send property queries, matter references or title-report contents to Clerk or Stripe. Sandbox checkout uses test payments and does not buy live service.</p>
<h3>Retention, access and correction</h3>
<p>Search logs are currently retained for administrator review; automatic expiry is not yet configured. Retention must be reviewed against the purposes above and applicable requirements before wider release. We do not promise automatic deletion after a fixed period. Contact the Mitsuketa administrator who provided your access to request access to or correction of your account and search-log information, or to discuss deletion. Requests are assessed against applicable obligations.</p>
`;

export default function Privacy({ onEnter }: { onEnter: () => void }) {
    const rootRef = useRef<HTMLDivElement>(null);
    useMarketingChrome(rootRef, onEnter);
    return <div className="mland" ref={rootRef}>
        <style dangerouslySetInnerHTML={{ __html: MARKETING_CSS }} />
        <div dangerouslySetInnerHTML={{ __html: navHTML('terms') + `
            <div class="wrap"><div class="pagehead"><h1>Privacy notice.</h1>
            <p class="lead">Property access and search logging. Updated 12 September 2026.</p>
            <p>Operator and privacy contact: [details to be confirmed]. For now, contact the administrator who provided your access.</p></div></div>
            <section class="sec"><div class="wrap">${PROPERTY_PRIVACY_HTML}</div></section>` + FOOTER_HTML }} />
    </div>;
}
