import React, { useRef } from 'react';
import { MARKETING_CSS, navHTML, FOOTER_HTML, useMarketingChrome } from './marketing';
import { TERMS_DOCUMENT_HTML } from './legalContent';

/**
 * Terms page: a WORKING DRAFT scaffolded from the Relab clause map in
 * MONETIZATION_HANDOFF.md (kept local). Plain-language intent per clause, not
 * final wording. To be expanded with real terms and reviewed before Mitsuketa
 * charges for anything.
 */

const TERMS = TERMS_DOCUMENT_HTML;

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
