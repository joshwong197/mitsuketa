import React, { useEffect, useRef } from 'react';
import { MARKETING_CSS, navHTML, FOOTER_HTML, useMarketingChrome } from './marketing';

/**
 * Home / landing page. Nav, footer, styles and chrome come from ./marketing;
 * this file holds the home content and the interactive ownership-graph hero.
 * "Start searching" enters the app (see Root in index.tsx).
 */

const HOME = `
<div class="wrap" id="top">
  <header class="hero">
    <div>
      <div class="mk"><span class="k">&#35211;</span><span class="l">The finding</span></div>
      <h1>See who <em>owns</em> what.</h1>
      <p class="lead">Mitsuketa reads the New Zealand registers and builds the ownership graph from one name, with the risk flagged on it.</p>
      <div class="cta">
        <button class="btn primary js-enter" type="button">Start searching</button>
        <a class="btn ghost" href="#how">How it works</a>
      </div>
      <p class="hint"><b>Try it:</b> drag a node to move it, click one to select. Drag the canvas to pan.</p>
    </div>

    <div class="canvas" id="canvas" aria-label="Interactive example: an ownership graph. Ashcroft Holdings sits above three companies and a disqualified director; one subsidiary is in receivership.">
      <div class="vp" id="vp">
        <svg class="gedges" id="edges" width="900" height="700" aria-hidden="true"></svg>

        <div class="gnode sel" id="n-parent" style="left:250px;top:40px">
          <div class="tseal" aria-hidden="true">&#35211;</div>
          <h4>Ashcroft Holdings Ltd</h4>
          <div class="id">NZBN 9429041830571</div>
          <div class="st green">Registered</div>
        </div>

        <div class="gnode" id="n-akatsuki" style="left:44px;top:190px">
          <h4>Harrow Trading Ltd</h4>
          <div class="id">NZBN 9429032104778</div>
          <div class="st green">Registered</div>
        </div>

        <div class="gnode b-amber" id="n-hoshino" style="left:320px;top:196px">
          <h4>Dunmore Build Ltd</h4>
          <div class="id">NZBN 9429047155096</div>
          <div class="chip amber"><span class="ks" aria-hidden="true">&#29746;</span><span class="kl">Receivership</span></div>
        </div>

        <div class="pill" id="n-dir" style="left:150px;top:360px">
          <span class="ring" aria-hidden="true"><span>&#32224;</span></span>
          <span><span class="nm">Grant Ashcroft</span><span class="rl">Disqualified &#183; Director</span></span>
        </div>

        <div class="gnode b-crit" id="n-sub" style="left:340px;top:356px">
          <h4>Carrington Developments Ltd</h4>
          <div class="id">NZBN 9429039822104</div>
          <div class="chip crit"><span class="ks" aria-hidden="true">&#32005;</span><span class="kl">Prev: liquidation</span></div>
          <div class="nbadge" aria-hidden="true">+6</div>
        </div>
      </div>
    </div>
  </header>
</div>

<section id="premise" class="premise">
  <div class="ghost" aria-hidden="true">&#35211;</div>
  <div class="wrap">
    <div class="body">
      <div class="mk"><span class="k">&#21839;</span><span class="l">The premise</span><span class="ln"></span></div>
      <h2 class="disp">The facts are public. They just don't sit together.</h2>
      <p>A company is owned by another company, held by a trust, and directed by someone already banned from the register. Each of those facts lives in a different place.</p>
      <p>Checking them by hand means one lookup at a time, and the connection you needed is usually a hop or two further out than you looked.</p>
      <p class="k">Mitsuketa crawls the shareholding chain and returns the whole structure at once, coloured by status, with insolvency and disqualification already checked. <em>Red is the only alarm on the canvas, and it means insolvency.</em></p>
    </div>
  </div>
</section>

<section id="find" class="caps"><div class="wrap">
  <div class="mk"><span class="k">&#20309;</span><span class="l">What you find</span><span class="ln"></span></div>
  <h2 class="disp">Four capabilities.</h2>
  <p class="sub">Three run on New Zealand's free government registers. The fourth draws on licensed LINZ title data.</p>
  <div class="capgrid">
    <div class="caprow">
      <div class="n">&#19968;</div>
      <div><h3>Ownership graph<span class="k">&#29366;</span></h3>
        <p>Upstream holders, downstream subsidiaries and sibling entities, crawled from the shareholding data and coloured by company status.</p></div>
      <div class="tier"><span class="t open"><span class="d"></span>Open</span></div>
    </div>
    <div class="caprow">
      <div class="n">&#20108;</div>
      <div><h3>Individual search<span class="k">&#20154;</span></h3>
        <p>Every directorship and shareholding a person holds, the percentage on each, and a check against the disqualified and insolvency registers.</p></div>
      <div class="tier"><span class="t open"><span class="d"></span>Open</span></div>
    </div>
    <div class="caprow">
      <div class="n">&#19977;</div>
      <div><h3>Risk on the graph<span class="k">&#38522;</span></h3>
        <p>Liquidation, receivership, removal and disqualification surface on the node itself. Insolvency is the one mark that turns red.</p></div>
      <div class="tier"><span class="t open"><span class="d"></span>Open</span></div>
    </div>
    <div class="caprow">
      <div class="n">&#22235;</div>
      <div><h3>Property and title<span class="k">&#22320;</span></h3>
        <p>The LINZ Title Register: owner, mortgagee and caveator names against a title, with the aerial for the parcel.</p></div>
      <div class="tier"><span class="t paid"><span class="d"></span>By credit</span><small>Licensed data</small></div>
    </div>
  </div>
</div></section>

<section id="person" class="person"><div class="wrap">
  <div class="mk"><span class="k">&#20154;</span><span class="l">Individual search</span><span class="ln"></span></div>
  <div class="head">
    <h2 class="disp">One name, every company they touch.</h2>
    <p class="sub">Search a person and Mitsuketa returns their full roster of directorships and shareholdings, holds the disqualified and insolvency registers against them, and pulls the signature off the consent form.</p>
  </div>

  <div class="screen">
    <div class="bar">
      <span class="back">&#8249;&nbsp;Back to search</span>
      <span class="meta">14 companies &#183; 9 directorships &#183; 5 shareholdings &#183; 6 active</span>
    </div>
    <div class="pbody">
      <aside class="spine">
        <div class="who">
          <span class="inkan" aria-hidden="true"><span>&#32224;</span></span>
          <div><h3>Ashcroft, Grant</h3><div class="rl">Shareholder &#183; Director</div></div>
        </div>
        <div class="regstrip">
          <div class="r">
            <span class="chk crit" aria-hidden="true">&#32005;</span>
            <div class="tx"><b>Disqualified director</b> <span class="cur">&#183; current</span><br><small>Section 385 Companies Act 1993</small></div>
          </div>
          <div class="r">
            <span class="chk crit" aria-hidden="true">&#32005;</span>
            <div class="tx"><b>Insolvency</b><br><small>1 record &#183; discharged 2019</small></div>
          </div>
          <div class="r">
            <span class="chk green" aria-hidden="true">&#38738;</span>
            <div class="tx"><b>Addresses match</b><br><small>One address across 11 companies</small></div>
          </div>
        </div>
      </aside>

      <div class="roster">
        <table>
          <thead><tr><th style="width:44%">Company</th><th>Role</th><th>Held</th><th>Status</th></tr></thead>
          <tbody>
            <tr>
              <td><div class="co">Ashcroft Holdings Ltd<div class="id">9429041830571</div></div></td>
              <td><span class="role">Director &amp; Shareholder &#183; 60.0%</span></td>
              <td class="held">2011 - current</td>
              <td><span class="status green">Registered</span></td>
            </tr>
            <tr>
              <td><div class="co">Dunmore Build Ltd<div class="id">9429047155096</div>
                <div class="stampline"><span class="fsq crit" aria-hidden="true">&#32005;</span><span class="sl crit">Receivership</span></div></div></td>
              <td><span class="role">Director</span></td>
              <td class="held">2016 - current</td>
              <td><span class="status crit">Receivership</span></td>
            </tr>
            <tr>
              <td><div class="co rm">Carrington Developments Ltd<div class="id">9429039822104</div>
                <div class="stampline"><span class="fsq crit" aria-hidden="true">&#32005;</span><span class="fsq wash" aria-hidden="true">&#28040;</span><span class="sl crit">Prev: liquidation</span></div></div></td>
              <td><span class="role off">Shareholder &#183; 25.0%<span class="tag"><span class="serif">&#36766;</span>Resigned</span></span></td>
              <td class="held">2009 - 2018</td>
              <td><span class="status pale">Removed</span></td>
            </tr>
            <tr>
              <td><div class="co">Harrow Trading Ltd<div class="id">9429032104778</div></div></td>
              <td><span class="role">Shareholder &#183; 12.5%</span></td>
              <td class="held">2014 - current</td>
              <td><span class="status green">Registered</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div></section>

<section id="how" class="how"><div class="wrap">
  <div class="mk"><span class="k">&#20181;&#32068;&#12415;</span><span class="l">How it works</span><span class="ln"></span></div>
  <h2 class="disp">From a name to the whole structure.</h2>
  <div class="steps">
    <div class="s"><div class="top"><span class="rn">i.</span><span class="k">&#26908;&#32034;</span></div><h3>Search</h3><p>Enter a company, an NZBN or a person's name. No setup, no import.</p></div>
    <div class="s"><div class="top"><span class="rn">ii.</span><span class="k">&#27083;&#31689;</span></div><h3>Build</h3><p>Mitsuketa crawls the register and assembles the structure, upstream and down.</p></div>
    <div class="s"><div class="top"><span class="rn">iii.</span><span class="k">&#38522;</span></div><h3>Read the risk</h3><p>Distressed and removed entities surface on the node. Disqualification and insolvency are checked for you.</p></div>
    <div class="s"><div class="top"><span class="rn">iv.</span><span class="k">&#20445;&#23384;</span></div><h3>Keep it</h3><p>Save a snapshot, or export the graph to PNG, PDF or JSON for the file.</p></div>
  </div>
</div></section>

<section id="access" class="access"><div class="wrap">
  <div class="mk"><span class="k">&#23652;</span><span class="l">Access</span><span class="ln"></span></div>
  <h2 class="disp">Two layers. One is open, one draws a credit.</h2>
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
      <div class="pr"><b>Free.</b> Built on New Zealand's official government registers. No credits.</div>
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
      <div class="pr"><em>Nothing about the result is kept.</em> The names return to you and are never stored. <a href="#/about" style="color:var(--accent);text-decoration:underline;text-underline-offset:2px">Why we price it this way &#8594;</a></div>
    </div>
  </div>
</div></section>

<section class="final"><div class="wrap">
  <div class="seal hk" aria-hidden="true">&#35211;</div>
  <h2 class="disp">Start with a name.</h2>
  <p>Enter a company or a person. The structure comes back in seconds.</p>
  <button class="btn primary js-enter" type="button">Start searching</button>
</div></section>
`;

interface LandingProps {
  onEnter: () => void;
}

const Landing: React.FC<LandingProps> = ({ onEnter }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  useMarketingChrome(rootRef, onEnter);

  // Interactive ownership graph: drag nodes, pan canvas, live edges.
  useEffect(() => {
    const container = rootRef.current;
    if (!container) return;
    const canvas = container.querySelector<HTMLElement>('#canvas');
    const vp = container.querySelector<HTMLElement>('#vp');
    const svg = container.querySelector<SVGSVGElement>('#edges');
    if (!canvas || !vp || !svg) return;

    const edges: Array<[string, string, string?]> = [
      ['n-parent', 'n-akatsuki'], ['n-parent', 'n-hoshino'],
      ['n-parent', 'n-dir', 'dash'], ['n-hoshino', 'n-sub'],
    ];
    const pan = { x: 20, y: 10 };
    let drag: { node?: HTMLElement; pan?: boolean; sx: number; sy: number; ox: number; oy: number } | null = null;

    const setVp = () => { vp.style.transform = `translate(${pan.x}px,${pan.y}px)`; };
    const anchor = (el: HTMLElement, edge: 'top' | 'bottom') => {
      const x = el.offsetLeft, y = el.offsetTop, w = el.offsetWidth, h = el.offsetHeight;
      return edge === 'top' ? { x: x + w / 2, y } : { x: x + w / 2, y: y + h };
    };
    const draw = () => {
      let p = '';
      edges.forEach(e => {
        const a = container.querySelector<HTMLElement>('#' + e[0]);
        const b = container.querySelector<HTMLElement>('#' + e[1]);
        if (!a || !b) return;
        const s = anchor(a, 'bottom'), t = anchor(b, 'top');
        const my = (s.y + t.y) / 2;
        p += `<path class="${e[2] === 'dash' ? 'dash' : ''}" d="M${s.x},${s.y} C${s.x},${my} ${t.x},${my} ${t.x},${t.y}"/>`;
      });
      svg.innerHTML = p;
    };
    setVp(); draw();

    const onDown = (ev: PointerEvent) => {
      const node = (ev.target as HTMLElement).closest<HTMLElement>('.gnode,.pill');
      if (node) {
        container.querySelectorAll('.gnode.sel').forEach(n => n.classList.remove('sel'));
        if (node.classList.contains('gnode')) node.classList.add('sel');
        drag = { node, sx: ev.clientX, sy: ev.clientY, ox: node.offsetLeft, oy: node.offsetTop };
      } else {
        drag = { pan: true, sx: ev.clientX, sy: ev.clientY, ox: pan.x, oy: pan.y };
        canvas.classList.add('grabbing');
      }
      canvas.setPointerCapture(ev.pointerId);
    };
    const onMove = (ev: PointerEvent) => {
      if (!drag) return;
      const dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
      if (drag.pan) { pan.x = drag.ox + dx; pan.y = drag.oy + dy; setVp(); }
      else if (drag.node) { drag.node.style.left = `${drag.ox + dx}px`; drag.node.style.top = `${drag.oy + dy}px`; draw(); }
    };
    const onUp = () => { drag = null; canvas.classList.remove('grabbing'); };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, []);

  return (
    <div className="mland" ref={rootRef}>
      <style dangerouslySetInnerHTML={{ __html: MARKETING_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: navHTML('home') + HOME + FOOTER_HTML }} />
    </div>
  );
};

export default Landing;
