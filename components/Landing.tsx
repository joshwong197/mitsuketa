import React, { useEffect, useRef } from 'react';

/**
 * Landing page — the public front door. Shown before the app on first load;
 * "Start searching" enters the search UI (see Root in index.tsx).
 *
 * The markup and styles are ported verbatim from design/homepage-direction.html
 * so the design stays reviewable as one artefact. CSS is wrapped in a single
 * `.mland { ... }` native-nesting block so nothing leaks into the app, and the
 * whole <style> unmounts with the component. Tokens (--paper/--ink/--accent…)
 * and the washi grain come from the app's global index.css — not redefined here.
 */

const CSS = `
.mland{
  /* Sumi tokens defined locally so the landing is self-contained (the app's
     index.css is a Tailwind v4 source and isn't compiled by the current Vite
     setup). Values mirror index.css exactly. */
  color-scheme:light dark;
  --acc-l:oklch(0.40 0.095 265); --acc-d:oklch(0.72 0.085 260);
  --paper:light-dark(oklch(0.952 0.007 85),oklch(0.185 0.008 75));
  --paper2:light-dark(oklch(0.930 0.008 85),oklch(0.225 0.009 75));
  --ink:light-dark(oklch(0.235 0.014 65),oklch(0.905 0.012 85));
  --ink-mid:light-dark(oklch(0.44 0.012 65),oklch(0.68 0.012 85));
  --ink-pale:light-dark(oklch(0.62 0.010 70),oklch(0.50 0.010 80));
  --ink-wash:light-dark(oklch(0.78 0.009 75),oklch(0.35 0.009 75));
  --rule:light-dark(oklch(0.855 0.008 80),oklch(0.30 0.010 75));
  --accent:light-dark(var(--acc-l),var(--acc-d));
  --accent-ink:light-dark(oklch(0.965 0.006 85),oklch(0.185 0.008 75));
  --crit:light-dark(oklch(0.55 0.17 30),oklch(0.66 0.17 30));
  --amber:light-dark(oklch(0.60 0.10 78),oklch(0.72 0.10 78));
  --green:light-dark(oklch(0.50 0.08 150),oklch(0.68 0.09 150));
  --serif:"Shippori Mincho","Yu Mincho",serif;
  --gothic:"Zen Kaku Gothic New","Yu Gothic UI","Segoe UI",system-ui,sans-serif;
  --mono:ui-monospace,"Cascadia Mono",Consolas,monospace;
  background:var(--paper); color:var(--ink); font-family:var(--gothic); font-size:15px;
  line-height:1.65; min-height:100vh; -webkit-font-smoothing:antialiased;
  *{box-sizing:border-box}
  a{color:inherit;text-decoration:none}
  .wrap{max-width:1240px;margin:0 auto;padding:0 clamp(20px,5vw,64px)}
  section{border-top:1px solid var(--rule)}
  .serif{font-family:var(--serif)}
  .mono{font-family:var(--mono);font-variant-numeric:tabular-nums}

  .strip{font-size:11px;color:var(--ink-pale);letter-spacing:.02em;display:flex;gap:14px;align-items:center;
    flex-wrap:wrap;padding:9px 0;border-bottom:1px solid var(--rule)}
  .strip .sq{width:6px;height:6px;background:var(--green);display:inline-block;margin-right:6px}
  .strip .sep{color:var(--ink-wash)}
  nav{display:flex;align-items:center;justify-content:space-between;padding:18px 0;gap:24px}
  .brand{display:flex;align-items:center;gap:11px}
  .seal{background:var(--accent);color:var(--accent-ink);font-family:var(--serif);font-weight:700;
    display:grid;place-items:center;line-height:1;flex:0 0 auto}
  .mark{width:33px;height:33px;font-size:20px}
  .brand .nm{font-family:var(--serif);font-weight:600;font-size:19px;letter-spacing:.01em}
  .brand .jp{font-family:var(--serif);font-size:11px;color:var(--ink-pale);letter-spacing:.22em;margin-top:1px}
  .navlinks{display:flex;align-items:center;gap:24px;font-size:13.5px;font-weight:500}
  .navlinks a{color:var(--ink-mid);transition:color .15s;cursor:pointer}
  .navlinks a:hover{color:var(--ink)}
  .tbtn{font-size:12px;font-weight:500;border:1px solid var(--rule);background:transparent;color:var(--ink);
    padding:7px 11px;cursor:pointer;transition:border-color .15s;font-family:var(--gothic)}
  .tbtn:hover{border-color:var(--ink)}
  .btn{font-size:13.5px;font-weight:500;padding:12px 22px;border:1px solid var(--ink);cursor:pointer;
    transition:background .15s,color .15s,border-color .15s;display:inline-block;white-space:nowrap;font-family:var(--gothic)}
  .btn.primary{background:var(--ink);color:var(--paper)}
  .btn.primary:hover{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
  .btn.ghost{background:transparent;color:var(--ink);border-color:var(--rule)}
  .btn.ghost:hover{border-color:var(--ink)}

  .mk{display:flex;align-items:baseline;gap:11px;margin-bottom:24px}
  .mk .k{font-family:var(--serif);font-size:16px;color:var(--accent);line-height:1}
  .mk .l{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-pale)}
  .mk .ln{flex:1;height:1px;background:var(--rule);align-self:center}
  h2.disp{font-family:var(--serif);font-weight:600;letter-spacing:-.01em;line-height:1.1;margin:0}

  .hero{display:grid;grid-template-columns:1fr 1.02fr;gap:48px;align-items:center;padding:64px 0 76px}
  .hero h1{font-family:var(--serif);font-weight:600;font-size:clamp(44px,6.6vw,92px);line-height:1.04;
    letter-spacing:-.015em;margin:0 0 24px;text-wrap:balance}
  .hero h1 em{font-style:italic;color:var(--accent)}
  .hero .lead{font-size:clamp(16px,1.5vw,19px);color:var(--ink-mid);max-width:38ch;margin:0 0 30px}
  .hero .cta{display:flex;gap:13px;flex-wrap:wrap;align-items:center}
  .hint{font-size:12px;color:var(--ink-pale);margin-top:18px}
  .hint b{color:var(--ink-mid);font-weight:500}

  .canvas{position:relative;height:440px;border:1px solid var(--rule);background:var(--paper2);overflow:hidden;
    cursor:grab;touch-action:none;
    background-image:radial-gradient(var(--rule) 1px,transparent 1px);background-size:22px 22px;background-position:-1px -1px}
  .canvas.grabbing{cursor:grabbing}
  .vp{position:absolute;left:0;top:0;transform-origin:0 0}
  .gedges{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
  .gedges path{fill:none;stroke:var(--ink-pale);stroke-width:1.4}
  .gedges path.dash{stroke-dasharray:4 3}
  .gnode{position:absolute;background:var(--paper);border:2px solid var(--ink);padding:8px 11px;cursor:grab;
    user-select:none;min-width:150px}
  .gnode:hover{outline:2px solid var(--accent);outline-offset:2px}
  .gnode.sel{border-color:var(--accent)}
  .gnode.b-amber{border-color:var(--amber)}
  .gnode.b-crit{border-color:var(--crit)}
  .gnode h4{font-size:12.5px;font-weight:700;color:var(--ink);margin:0 0 3px;line-height:1.35;font-family:var(--gothic)}
  .gnode .id{font-family:var(--mono);font-size:10.5px;font-variant-numeric:tabular-nums;color:var(--ink-pale)}
  .gnode .st{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-top:7px}
  .gnode .st.green{color:var(--green)}
  .gnode .st.pale{color:var(--ink-pale)}
  .chip{display:flex;align-items:center;gap:5px;margin-top:7px}
  .chip .ks{width:15px;height:15px;display:grid;place-items:center;font-family:var(--serif);font-size:11px;
    line-height:1;color:var(--accent-ink);flex:0 0 auto}
  .chip .kl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}
  .chip.amber .ks{background:var(--amber)}
  .chip.amber .kl{color:var(--amber)}
  .chip.crit .ks{background:var(--crit)}
  .chip.crit .kl{color:var(--crit)}
  .tseal{position:absolute;top:-14px;right:-12px;width:31px;height:31px;background:var(--accent);
    color:var(--accent-ink);font-family:var(--serif);font-weight:700;font-size:16px;display:grid;place-items:center;
    transform:rotate(-6deg);box-shadow:inset 0 0 12px rgba(0,0,0,.22)}
  .nbadge{position:absolute;bottom:-10px;right:-9px;background:var(--ink);color:var(--paper);font-size:10px;
    font-weight:700;padding:2px 7px;font-variant-numeric:tabular-nums}
  .pill{position:absolute;display:flex;align-items:center;gap:9px;background:var(--paper);
    border:2px solid var(--crit);border-radius:999px;padding:7px 16px 7px 8px;cursor:grab;user-select:none}
  .pill:hover{outline:2px solid var(--accent);outline-offset:2px}
  .pill .ring{position:relative;width:28px;height:28px;display:grid;place-items:center;flex:0 0 auto}
  .pill .ring::before{content:"";position:absolute;inset:0;border-radius:999px;border:1px dashed var(--crit)}
  .pill .ring span{font-family:var(--serif);font-size:12px;color:var(--crit)}
  .pill .nm{font-size:12.5px;font-weight:700;color:var(--ink);font-family:var(--gothic)}
  .pill .rl{font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--crit);font-weight:700;margin-top:1px}

  .premise{padding:92px 0;position:relative;overflow:hidden}
  .premise .ghost{position:absolute;font-family:var(--serif);font-weight:800;font-size:min(46vw,600px);
    color:var(--ink);opacity:.035;right:-4vw;top:50%;transform:translateY(-50%);line-height:.8;pointer-events:none;user-select:none}
  .premise .body{position:relative;max-width:60ch}
  .premise h2{font-size:clamp(30px,4.4vw,54px);max-width:18ch;margin-bottom:26px}
  .premise p{font-size:17px;color:var(--ink-mid);margin:0 0 18px}
  .premise p.k em{font-style:normal;color:var(--ink);font-weight:500}

  .caps{padding:92px 0;background:var(--paper2)}
  .caps h2{font-size:clamp(28px,3.8vw,48px);margin-bottom:8px}
  .caps .sub{color:var(--ink-mid);font-size:16px;margin:0 0 40px}
  .capgrid{border:1px solid var(--rule);background:var(--paper)}
  .caprow{display:grid;grid-template-columns:80px 1fr auto;align-items:center;gap:18px;padding:26px 28px}
  .caprow+.caprow{border-top:1px solid var(--rule)}
  .caprow .n{font-family:var(--serif);font-size:44px;color:var(--accent);line-height:1}
  .caprow h3{font-family:var(--serif);font-weight:600;font-size:24px;margin:0 0 5px;letter-spacing:-.01em}
  .caprow h3 .k{font-family:var(--serif);font-size:15px;color:var(--ink-pale);margin-left:11px;letter-spacing:.08em}
  .caprow p{margin:0;font-size:14.5px;color:var(--ink-mid);max-width:56ch}
  .tier{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;text-align:right;white-space:nowrap}
  .tier .t{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--rule);padding:6px 11px}
  .tier .t .d{width:9px;height:9px;background:currentColor;display:inline-block}
  .tier .t.open{color:var(--green)}
  .tier .t.paid{color:var(--accent);border-color:var(--accent)}
  .tier small{display:block;color:var(--ink-pale);margin-top:7px;font-size:10.5px;font-weight:500;letter-spacing:0}

  .person{padding:92px 0}
  .person .head{max-width:60ch;margin-bottom:36px}
  .person h2{font-size:clamp(28px,3.8vw,48px);margin-bottom:12px}
  .person .sub{color:var(--ink-mid);font-size:16px;margin:0}
  .screen{border:1px solid var(--rule);background:var(--paper);box-shadow:0 1px 0 var(--rule)}
  .screen .bar{display:flex;align-items:center;gap:12px;padding:11px 18px;border-bottom:1px solid var(--rule);
    font-size:12px;color:var(--ink-pale)}
  .screen .bar .back{color:var(--ink-mid);display:flex;align-items:center;gap:5px}
  .screen .bar .meta{margin-left:auto;font-variant-numeric:tabular-nums}
  .pbody{display:grid;grid-template-columns:280px minmax(0,1fr);gap:0}
  .spine{border-right:1px solid var(--rule);padding:26px 24px}
  .spine .inkan{position:relative;width:44px;height:44px;display:grid;place-items:center;flex:0 0 auto}
  .spine .inkan::before{content:"";position:absolute;inset:0;border-radius:999px;border:1px solid var(--accent)}
  .spine .inkan::after{content:"";position:absolute;inset:3px;border-radius:999px;border:1px solid color-mix(in oklch,var(--accent) 35%,transparent)}
  .spine .inkan span{font-family:var(--serif);font-size:18px;color:var(--accent);line-height:1}
  .spine .who{display:flex;align-items:flex-start;gap:12px}
  .spine .who h3{font-family:var(--serif);font-weight:600;font-size:24px;margin:0;line-height:1.12}
  .spine .who .rl{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-pale);margin-top:6px}
  .regstrip{margin-top:22px;border:1px solid var(--rule)}
  .regstrip .r{display:flex;align-items:center;gap:11px;padding:11px;background:var(--paper2)}
  .regstrip .r+.r{border-top:1px solid var(--rule)}
  .chk{width:32px;height:32px;display:grid;place-items:center;font-family:var(--serif);font-size:16px;
    color:var(--paper);flex:0 0 auto}
  .chk.crit{background:var(--crit)}
  .chk.green{background:var(--green)}
  .regstrip .tx{min-width:0}
  .regstrip .tx b{font-size:12.5px;color:var(--ink);font-weight:700}
  .regstrip .tx .cur{font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--crit)}
  .regstrip .tx small{color:var(--ink-mid);font-size:11.5px}
  .roster{padding:22px 24px;min-width:0}
  .roster table{width:100%;border-collapse:collapse}
  .roster th{text-align:left;text-transform:uppercase;font-size:10px;letter-spacing:.1em;color:var(--ink-pale);
    font-weight:500;padding:0 12px 6px 0;border-bottom:1px solid var(--rule)}
  .roster td{padding:10px 12px 10px 0;border-bottom:1px solid var(--rule);vertical-align:top;font-size:12.5px}
  .roster .co{font-weight:700;color:var(--ink)}
  .roster .co.rm{text-decoration:line-through;color:var(--ink-mid);text-decoration-color:var(--ink-wash)}
  .roster .co .id{font-family:var(--mono);font-size:10.5px;font-variant-numeric:tabular-nums;color:var(--ink-pale);
    font-weight:400;margin-top:2px;text-decoration:none}
  .stampline{display:flex;align-items:center;gap:7px;margin-top:6px}
  .fsq{width:18px;height:18px;display:grid;place-items:center;font-family:var(--serif);font-size:10.5px;
    color:var(--paper);flex:0 0 auto}
  .fsq.crit{background:var(--crit)}
  .fsq.wash{background:var(--ink-mid)}
  .fsq.amber{background:var(--amber)}
  .stampline .sl{font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;font-weight:700}
  .stampline .sl.crit{color:var(--crit)}
  .stampline .sl.wash{color:var(--ink-pale)}
  .roster .role{color:var(--accent);white-space:nowrap}
  .roster .role.off{color:var(--ink-mid)}
  .roster .tag{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--rule);padding:1px 6px;
    margin-left:8px;font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-mid)}
  .roster .held{font-family:var(--mono);font-size:11px;color:var(--ink-pale);white-space:nowrap;font-variant-numeric:tabular-nums}
  .roster .status{font-size:10px;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap}
  .roster .status.green{color:var(--green)}
  .roster .status.crit{color:var(--crit);font-weight:700}
  .roster .status.pale{color:var(--ink-pale)}

  .how{padding:92px 0;background:var(--paper2)}
  .how h2{font-size:clamp(28px,3.8vw,48px);margin-bottom:44px;max-width:20ch}
  .steps{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--rule);background:var(--paper)}
  .steps .s{padding:28px 24px 32px}
  .steps .s+.s{border-left:1px solid var(--rule)}
  .steps .top{display:flex;align-items:baseline;gap:9px}
  .steps .rn{font-family:var(--serif);font-style:italic;font-size:19px;color:var(--ink-pale)}
  .steps .k{font-family:var(--serif);font-size:15px;color:var(--accent);letter-spacing:.16em}
  .steps h3{font-family:var(--serif);font-weight:600;font-size:22px;margin:16px 0 9px;letter-spacing:-.01em}
  .steps p{margin:0;font-size:14px;color:var(--ink-mid)}

  .access{padding:92px 0}
  .access h2{font-size:clamp(28px,3.8vw,48px);margin-bottom:42px;max-width:22ch}
  .lg{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--rule)}
  .lay{padding:40px 36px}
  .lay+.lay{border-left:1px solid var(--rule)}
  .lay .tg{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:700;text-transform:uppercase;
    letter-spacing:.08em;margin-bottom:20px}
  .lay .tg .d{width:11px;height:11px;display:inline-block}
  .lay.open .tg{color:var(--green)}
  .lay.open .tg .d{background:var(--green)}
  .lay.paid .tg{color:var(--accent)}
  .lay.paid .tg .d{background:var(--accent)}
  .lay h3{font-family:var(--serif);font-weight:600;font-size:clamp(26px,3vw,38px);margin:0 0 5px;letter-spacing:-.01em}
  .lay .jp{font-family:var(--serif);font-size:13px;color:var(--ink-pale);letter-spacing:.16em;margin-bottom:22px}
  .lay ul{list-style:none;padding:0;margin:0 0 24px}
  .lay li{font-size:15px;padding:14px 0;border-top:1px solid var(--rule);color:var(--ink)}
  .lay li:first-child{border-top:0}
  .lay li span{display:block;color:var(--ink-mid);font-size:13.5px;margin-top:3px}
  .lay .pr{font-size:14.5px;color:var(--ink-mid);border-top:1px solid var(--rule);padding-top:18px}
  .lay .pr b{color:var(--ink);font-weight:600}
  .lay .pr em{font-style:italic;color:var(--ink)}

  .final{padding:100px 0;text-align:center}
  .final .hk{width:88px;height:88px;margin:0 auto 30px;font-size:50px}
  .final h2{font-size:clamp(34px,4.6vw,60px);margin-bottom:16px}
  .final p{color:var(--ink-mid);font-size:17px;max-width:42ch;margin:0 auto 30px}
  footer{border-top:1px solid var(--rule);padding:40px 0;display:flex;justify-content:space-between;
    align-items:center;gap:18px;flex-wrap:wrap;font-size:12.5px;color:var(--ink-pale)}
  footer .fb{font-family:var(--serif);font-size:16px;color:var(--ink)}
  footer .fb .jp{font-size:11px;color:var(--ink-pale);margin-left:8px;letter-spacing:.2em}

  @media (max-width:900px){
    .hero{grid-template-columns:1fr;gap:34px;padding:44px 0 56px}
    .canvas{order:2;height:400px}
    .pbody{grid-template-columns:1fr}
    .spine{border-right:0;border-bottom:1px solid var(--rule)}
    .steps{grid-template-columns:1fr 1fr}
    .steps .s:nth-child(3),.steps .s:nth-child(4){border-top:1px solid var(--rule)}
    .steps .s:nth-child(3){border-left:0}
    .lg{grid-template-columns:1fr}
    .lay+.lay{border-left:0;border-top:1px solid var(--rule)}
    .caprow{grid-template-columns:52px 1fr;gap:14px}
    .caprow .n{font-size:32px}
    .tier{grid-column:2;text-align:left;margin-top:8px}
    .navlinks .hd{display:none}
  }
}
:root[data-theme="light"] .mland{color-scheme:light}
:root[data-theme="dark"] .mland{color-scheme:dark}
`;

const BODY = `
<div class="wrap">
  <div class="strip">
    <span><span class="sq"></span>Aotearoa New Zealand</span>
    <span class="sep">&#9474;</span><span>Corporate and property due diligence</span>
    <span class="sep">&#9474;</span><span>Open for early access</span>
  </div>
  <nav>
    <a class="brand" href="#top" aria-label="Mitsuketa home">
      <span class="seal mark" aria-hidden="true">&#35211;</span>
      <span><span class="nm">Mitsuketa</span><br><span class="jp">&#35211;&#12388;&#12369;&#12383;</span></span>
    </a>
    <div class="navlinks">
      <a class="hd" href="#premise">Premise</a>
      <a class="hd" href="#find">What you find</a>
      <a class="hd" href="#person">Individual search</a>
      <a class="hd" href="#access">Access</a>
      <button class="tbtn" id="theme" type="button" aria-label="Toggle light or dark theme">Dark</button>
      <button class="btn primary js-enter" type="button">Start searching</button>
    </div>
  </nav>
</div>

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
      <div class="pr"><em>Nothing about the result is kept.</em> The names return to you and are never stored.</div>
    </div>
  </div>
</div></section>

<section class="final"><div class="wrap">
  <div class="seal hk" aria-hidden="true">&#35211;</div>
  <h2 class="disp">Start with a name.</h2>
  <p>Enter a company or a person. The structure comes back in seconds.</p>
  <button class="btn primary js-enter" type="button">Start searching</button>
</div></section>

<div class="wrap"><footer>
  <span class="fb">Mitsuketa<span class="jp">&#35211;&#12388;&#12369;&#12383;</span></span>
  <span>Built in New Zealand. Public registers, one view.</span>
  <span>&#169; 2026 Mitsuketa &#183; Aotearoa NZ</span>
</footer></div>
`;

interface LandingProps {
  onEnter: () => void;
}

const Landing: React.FC<LandingProps> = ({ onEnter }) => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = rootRef.current;
    if (!container) return;
    const rootEl = document.documentElement;

    // ── theme: same keys/attrs the app uses (mitsuketa_theme + data-theme + .dark)
    const applyTheme = (t: 'light' | 'dark') => {
      rootEl.setAttribute('data-theme', t);
      rootEl.classList.toggle('dark', t === 'dark');
      try { localStorage.setItem('mitsuketa_theme', t); } catch { /* private mode */ }
    };
    let stored: string | null = null;
    try { stored = localStorage.getItem('mitsuketa_theme'); } catch { /* private mode */ }
    const sysDark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const initial: 'light' | 'dark' = stored === 'light' || stored === 'dark' ? stored : (sysDark ? 'dark' : 'light');
    applyTheme(initial);
    const themeBtn = container.querySelector<HTMLButtonElement>('#theme');
    const setLabel = (t: 'light' | 'dark') => { if (themeBtn) themeBtn.textContent = t === 'dark' ? 'Light' : 'Dark'; };
    setLabel(initial);
    const onTheme = () => {
      const cur = rootEl.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const next: 'light' | 'dark' = cur === 'dark' ? 'light' : 'dark';
      applyTheme(next); setLabel(next);
    };
    themeBtn?.addEventListener('click', onTheme);

    // ── let the marketing page scroll (the app pins body to overflow:hidden)
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'auto';

    // ── enter the app
    const enterEls = Array.from(container.querySelectorAll<HTMLElement>('.js-enter'));
    const onEnterClick = (e: Event) => { e.preventDefault(); onEnter(); };
    enterEls.forEach(el => el.addEventListener('click', onEnterClick));

    // ── interactive ownership graph: drag nodes, pan canvas, live edges
    const canvas = container.querySelector<HTMLElement>('#canvas');
    const vp = container.querySelector<HTMLElement>('#vp');
    const svg = container.querySelector<SVGSVGElement>('#edges');
    const edges: Array<[string, string, string?]> = [
      ['n-parent', 'n-akatsuki'], ['n-parent', 'n-hoshino'],
      ['n-parent', 'n-dir', 'dash'], ['n-hoshino', 'n-sub'],
    ];
    const pan = { x: 20, y: 10 };
    let drag: { node?: HTMLElement; pan?: boolean; sx: number; sy: number; ox: number; oy: number } | null = null;

    const setVp = () => { if (vp) vp.style.transform = `translate(${pan.x}px,${pan.y}px)`; };
    const anchor = (el: HTMLElement, edge: 'top' | 'bottom') => {
      const x = el.offsetLeft, y = el.offsetTop, w = el.offsetWidth, h = el.offsetHeight;
      return edge === 'top' ? { x: x + w / 2, y } : { x: x + w / 2, y: y + h };
    };
    const draw = () => {
      if (!svg || !container) return;
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
      if (!canvas) return;
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
    const onUp = () => { drag = null; canvas?.classList.remove('grabbing'); };
    canvas?.addEventListener('pointerdown', onDown);
    canvas?.addEventListener('pointermove', onMove);
    canvas?.addEventListener('pointerup', onUp);
    canvas?.addEventListener('pointercancel', onUp);

    return () => {
      themeBtn?.removeEventListener('click', onTheme);
      enterEls.forEach(el => el.removeEventListener('click', onEnterClick));
      document.body.style.overflow = prevOverflow;
      canvas?.removeEventListener('pointerdown', onDown);
      canvas?.removeEventListener('pointermove', onMove);
      canvas?.removeEventListener('pointerup', onUp);
      canvas?.removeEventListener('pointercancel', onUp);
    };
  }, [onEnter]);

  return (
    <div className="mland" ref={rootRef}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div dangerouslySetInnerHTML={{ __html: BODY }} />
    </div>
  );
};

export default Landing;
