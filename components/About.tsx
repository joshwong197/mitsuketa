import React, { useRef } from 'react';
import { MARKETING_CSS, navHTML, FOOTER_HTML, useMarketingChrome } from './marketing';

/**
 * About page: background, the free-vs-paid split with the reasoning behind it,
 * and an FAQ. Content is static markup; chrome (nav, footer, theme, enter)
 * comes from ./marketing.
 */

const ABOUT = `
<div class="wrap">
  <div class="pagehead">
    <div class="mk"><span class="k">&#35211;</span><span class="l">About</span></div>
    <h1>The registers, read the way the work taught us.</h1>
    <p class="lead">Mitsuketa was built by someone who spent years in credit, debt recovery and insolvency, reading the New Zealand registers by hand. It does that reading for you.</p>
  </div>
</div>

<section class="sec"><div class="wrap"><div class="prose">
  <p>For years the job meant opening the Companies Office, the NZBN register, the Insolvency Register and the disqualified directors list one at a time, then holding the connections in your head: who owns this company, who sits behind that trust, which director has been through a liquidation before. The information was public. Assembling it was the slow part, and the connection that mattered was usually a hop or two further out than you had time to chase.</p>
  <p>Mitsuketa is that assembly, done in one pass. You give it a name, it crawls the shareholding chain, and it hands back the whole structure with the risk already marked. The checks we found ourselves running every single time, insolvency, receivership, removal, a disqualified director, are the ones it runs for you.</p>
  <p>It is built for the people who do this work: credit teams deciding whether to extend terms, insolvency and legal practitioners tracing a structure, and anyone who needs to know who is really behind a company before they hand it money or a contract.</p>
</div></div></section>

<section class="sec alt"><div class="wrap">
  <h2 class="disp">What's free, what costs, and why.</h2>
  <div class="lg">
    <div class="lay open">
      <div class="tg"><span class="d"></span>The register layer</div>
      <h3>Open</h3>
      <div class="jp">&#20250;&#31038; &#183; &#20154; &#183; &#38522;</div>
      <ul>
        <li>Company and individual search<span>NZBN, Companies Office roles and shareholdings</span></li>
        <li>Ownership graph<span>Upstream, downstream and sibling entities</span></li>
        <li>Risk checks<span>Insolvency, receivership, removal, disqualification</span></li>
      </ul>
      <div class="pr"><b>Free.</b> Built on New Zealand's official government registers. No account, no credits.</div>
    </div>
    <div class="lay paid">
      <div class="tg"><span class="d"></span>The property layer</div>
      <h3>By credit</h3>
      <div class="jp">&#22320; &#183; &#27177;&#21033; &#183; &#30331;&#35352;</div>
      <ul>
        <li>LINZ title search<span>Owner, mortgagee and caveator names against a title</span></li>
        <li>Aerial imagery<span>The LINZ basemap for the parcel</span></li>
        <li>Prepaid credits<span>Buy a bundle; each title search draws one</span></li>
      </ul>
      <div class="pr"><em>Nothing about the result is kept.</em> The names return to you and are never stored.</div>
    </div>
  </div>

  <div class="whywrap">
    <h3>Why we chose to be generous.</h3>
    <div class="prose">
      <p>The company and person registers are public. New Zealand already publishes them, for free, through the NZBN and Companies Office APIs. Charging you to read data the state gives away would be hard to defend, so we don't. The graph, the risk flags, the person roster: all of it runs on that free public data, and all of it stays free.</p>
      <p>One layer is different. Land title data comes from LINZ under a licence for personal data, with real obligations attached to every search and a real cost to serve it. That layer, and only that layer, draws a prepaid credit. The credit covers the licence and the cost of serving it, not the public registers underneath.</p>
      <p>So the line is simple. <strong>If the government gives it away, so do we. If it is licensed and it costs us, it costs a credit.</strong> We would rather be generous with the public part and honest about the paid part than meter everything and dress it up as a plan.</p>
    </div>
  </div>
</div></section>

<section class="sec faq"><div class="wrap">
  <div class="mk"><span class="k">&#21839;</span><span class="l">Questions</span><span class="ln"></span></div>
  <h2 class="disp">Frequently asked.</h2>

  <details>
    <summary>Where does the data come from?<span class="plus" aria-hidden="true">+</span></summary>
    <div class="ans"><p>The company, person and risk information comes from New Zealand's official government registers: the NZBN, the Companies Office, the Insolvency Register and the Disqualified Directors register. Property and title information comes from the LINZ Title Register, under licence.</p></div>
  </details>
  <details>
    <summary>Is it free?<span class="plus" aria-hidden="true">+</span></summary>
    <div class="ans"><p>The register layer is free: company search, individual search, the ownership graph and the risk checks, with no account and no credits. The property layer (LINZ title search) uses prepaid credits, one per search.</p></div>
  </details>
  <details>
    <summary>Why is the company and person search free?<span class="plus" aria-hidden="true">+</span></summary>
    <div class="ans"><p>Because the underlying registers are public and already free. We add the graph and the risk checks on top and keep the whole thing free. Only genuinely licensed data, the LINZ title layer, costs a credit.</p></div>
  </details>
  <details>
    <summary>Do you store my searches, or the results?<span class="plus" aria-hidden="true">+</span></summary>
    <div class="ans"><p>We keep a record of what was searched, the input, because the LINZ licence expects it and it lets us honour amend and delete requests. We do not store the owner, mortgagee or caveator names a title search returns. Those come back to you and are not kept.</p></div>
  </details>
  <details>
    <summary>Is this legal or financial advice?<span class="plus" aria-hidden="true">+</span></summary>
    <div class="ans"><p>No. Mitsuketa reports what the registers say. What you do with it is your call, and for anything that turns on it you should take your own advice.</p></div>
  </details>
  <details>
    <summary>How current is it?<span class="plus" aria-hidden="true">+</span></summary>
    <div class="ans"><p>As current as the registers themselves. Mitsuketa reads them live at search time; it does not work from an old copy.</p></div>
  </details>
  <details>
    <summary>Can I use it for my business?<span class="plus" aria-hidden="true">+</span></summary>
    <div class="ans"><p>Yes, for internal business or personal due diligence, under the terms of use. You can read the current draft on the <a href="#/terms">Terms</a> page.</p></div>
  </details>
  <details>
    <summary>Who can see what I search?<span class="plus" aria-hidden="true">+</span></summary>
    <div class="ans"><p>Your searches are yours. We do not sell them or pass them on, and title results are not stored. The search-input record exists only to meet the LINZ licence and to action a correction or deletion if one is asked for.</p></div>
  </details>
</div></section>

<section class="final"><div class="wrap">
  <div class="seal hk" aria-hidden="true">&#35211;</div>
  <h2 class="disp">Start with a name.</h2>
  <p>The register layer is open. Try it before you think about a single credit.</p>
  <button class="btn primary js-enter" type="button">Start searching</button>
</div></section>
`;

interface AboutProps {
  onEnter: () => void;
}

const About: React.FC<AboutProps> = ({ onEnter }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  useMarketingChrome(rootRef, onEnter);
  return (
    <div className="mland" ref={rootRef}>
      <style dangerouslySetInnerHTML={{ __html: MARKETING_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: navHTML('about') + ABOUT + FOOTER_HTML }} />
    </div>
  );
};

export default About;
