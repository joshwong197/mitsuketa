import React, { useRef } from 'react';
import { MARKETING_CSS, navHTML, FOOTER_HTML, useMarketingChrome } from './marketing';
import { TERMS_DOCUMENT_HTML } from './legalContent';

/**
 * Terms page: a WORKING DRAFT scaffolded from the Relab clause map in
 * MONETIZATION_HANDOFF.md (kept local). Plain-language intent per clause, not
 * final wording. To be expanded with real terms and reviewed before Mitsuketa
 * charges for anything.
 */

const TERMS = TERMS_DOCUMENT_HTML + `
<section class="final"><div class="wrap">
  <div class="seal hk" aria-hidden="true">&#35211;</div>
  <h2 class="disp">Read the rest first.</h2>
  <p>The <a href="#/about" style="color:var(--accent);text-decoration:underline;text-underline-offset:2px">About page</a> explains what's free, what costs, and why.</p>
  <button class="btn primary js-enter" type="button">Start searching</button>
</div></section>
`;

interface TermsProps {
  onEnter: () => void;
}

const Terms: React.FC<TermsProps> = ({ onEnter }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  useMarketingChrome(rootRef, onEnter);
  return (
    <div className="mland" ref={rootRef}>
      <style dangerouslySetInnerHTML={{ __html: MARKETING_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: navHTML('terms') + TERMS + FOOTER_HTML }} />
    </div>
  );
};

export default Terms;
