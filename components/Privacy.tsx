import React, { useRef } from 'react';
import { MARKETING_CSS, navHTML, FOOTER_HTML, useMarketingChrome } from './marketing';

import { PROPERTY_PRIVACY_HTML } from './legalContent';
export { PROPERTY_PRIVACY_HTML } from './legalContent';

export default function Privacy({ onEnter }: { onEnter: () => void }) {
    const rootRef = useRef<HTMLDivElement>(null);
    useMarketingChrome(rootRef, onEnter);
    return <div className="mland" ref={rootRef}>
        <style dangerouslySetInnerHTML={{ __html: MARKETING_CSS }} />
        <div dangerouslySetInnerHTML={{ __html: navHTML('terms') + `
            <div class="wrap"><div class="pagehead"><h1>Privacy notice.</h1>
            <p class="lead">Property access and search logging. Updated 13 September 2026.</p>
            <p>Mitsuketa is currently an internal service. For privacy questions or requests about your information, use your existing internal contact with the Mitsuketa administrator. A public privacy contact will be provided before wider release.</p></div></div>
            <section class="sec"><div class="wrap">${PROPERTY_PRIVACY_HTML}</div></section>` + FOOTER_HTML }} />
    </div>;
}
