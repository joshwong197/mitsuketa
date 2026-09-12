import React, { useRef } from 'react';
import { MARKETING_CSS, navHTML, FOOTER_HTML, useMarketingChrome } from './marketing';
import { PROPERTY_PRIVACY_HTML } from './Privacy';

/**
 * Terms page: a WORKING DRAFT scaffolded from the Relab clause map in
 * MONETIZATION_HANDOFF.md (kept local). Plain-language intent per clause, not
 * final wording. To be expanded with real terms and reviewed before Mitsuketa
 * charges for anything.
 */

const TERMS = `
<div class="wrap">
  <div class="pagehead">
    <div class="mk"><span class="k">&#32004;</span><span class="l">Terms</span></div>
    <h1>Terms of use.</h1>
    <p class="lead">How Mitsuketa may be used, the data it draws on, and the terms attached to that data.</p>
  </div>
  <div class="draftbar">
    <b>Working draft.</b> This page is a structural draft, adapted from a comparable New Zealand product (Relab) that resupplies the same LINZ and MBIE data. It is not the final wording and it is not legal advice. The terms will be settled and reviewed before Mitsuketa charges for anything.
  </div>
</div>

<section class="sec"><div class="wrap">

  <div class="clause">
    <div class="cn">1</div>
    <div>
      <h3>Definitions</h3>
      <p><strong>Information</strong> means the data Mitsuketa returns from the New Zealand registers. <strong>Ownership Information</strong> means the LINZ title data specifically: owner, mortgagee and caveator names. <strong>Report passes</strong> are the planned prepaid units used to generate property reports. <strong>Fees</strong> are amounts charged for paid access; sandbox test payments are not real fees.</p>
      <p class="src">Draft. Definitions to be completed alongside the operative clauses.</p>
    </div>
  </div>

  <div class="clause">
    <div class="cn">2</div>
    <div>
      <h3>Acceptable use</h3>
      <p>You may use Mitsuketa for internal business or personal due diligence, and lawfully. You may not resell or redistribute the Information, and you may not publish it to third parties.</p>
      <p class="src">Adapted from Relab clause 8.</p>
    </div>
  </div>

  <div class="clause">
    <div class="cn">3</div>
    <div>
      <h3>Ownership Information (the LINZ terms)</h3>
      <p>Land title data carries obligations from the LINZ Licence for Personal Data, which flow down to you. When you receive Ownership Information you agree to:</p>
      <ul>
        <li>act as an "agency" under the Privacy Act 2020 in respect of it;</li>
        <li>keep it reasonably secure;</li>
        <li>tell us promptly if it is disclosed in breach of these terms;</li>
        <li>not allow it to be indexed by search engines;</li>
        <li>not use it in any way that would put Mitsuketa or LINZ in breach of the Privacy Act 2020;</li>
        <li>not use it for unsolicited direct marketing;</li>
        <li>correct or delete it on request, with evidence, within four working days.</li>
      </ul>
      <p class="src">Adapted from Relab clause 6. Four working days is tighter than the five LINZ allows us, to keep a buffer.</p>
    </div>
  </div>

  <div class="clause">
    <div class="cn">4</div>
    <div>
      <h3>Third-party licence terms</h3>
      <p>Your use is also subject to the terms of the data sources Mitsuketa draws on: the LINZ Personal Data Licence (v2.3) and CC BY 4.0 for title and basemap data, and MBIE's API Access Agreement for the register data, including its privity, indemnity and warranty provisions.</p>
      <p class="src">Adapted from Relab clause 9. REINZ and Auckland Council pass-throughs are dropped, as Mitsuketa does not use that data.</p>
    </div>
  </div>

  <div class="clause">
    <div class="cn">5</div>
    <div>
      <h3>Privacy</h3>
      ${PROPERTY_PRIVACY_HTML}
      <p>Read the <a href="#/privacy">privacy notice</a> before submitting a property search.</p>
    </div>
  </div>

  <div class="clause">
    <div class="cn">6</div>
    <div>
      <h3>Report passes and access approval</h3>
      <p>Property access is restricted to individually approved users. Do not share your account. Approval is separate from payment and may be suspended or withdrawn. During sandbox testing, checkout uses test payments only and does not purchase live service. Final paid offers, tax treatment, expiry and refund terms will be settled before real payments are enabled.</p>
    </div>
  </div>

  <div class="clause">
    <div class="cn">7</div>
    <div>
      <h3>No warranties</h3>
      <p>The Information is provided as it stands, drawn from the registers. To the extent the law allows, we exclude the implied warranties. Where you use Mitsuketa in trade, the guarantees in the Consumer Guarantees Act 1993 are contracted out; any implied warranty that cannot be excluded is limited to NZD 100.</p>
      <p class="src">Adapted from Relab clause 14.</p>
    </div>
  </div>

  <div class="clause">
    <div class="cn">8</div>
    <div>
      <h3>Liability</h3>
      <p>Our total liability to you is capped at the Fees you paid in the prior year. We are not liable for indirect or consequential loss.</p>
      <p class="src">Adapted from Relab clause 15.</p>
    </div>
  </div>

  <div class="clause">
    <div class="cn">9</div>
    <div>
      <h3>Fair Trading Act</h3>
      <p>Where you are in trade and it is fair and reasonable, sections 9, 12A and 13 of the Fair Trading Act 1986 are contracted out.</p>
      <p class="src">Adapted from Relab clause 17.10.</p>
    </div>
  </div>

  <div class="clause">
    <div class="cn">10</div>
    <div>
      <h3>Governing law</h3>
      <p>These terms are governed by New Zealand law. The acceptable-use, licence, privacy, warranty and liability clauses survive termination.</p>
      <p class="src">Draft.</p>
    </div>
  </div>

  <p class="legalnote">The consent-form data some tools scrape from the Companies Office portal is never included in Mitsuketa's paid product and is not covered by these terms. This draft will be finalised and reviewed before any charging begins.</p>

</div></section>

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
