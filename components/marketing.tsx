import { useEffect, RefObject } from 'react';

/**
 * Shared chrome for the marketing pages (Home, About, Terms): the scoped sumi
 * stylesheet, the nav and footer markup, and the hook that wires the theme
 * toggle, "Start searching" buttons and page scrolling. Each page renders its
 * own content between navHTML() and FOOTER_HTML inside a `.mland` root.
 */

export const MARKETING_CSS = `
.mland{
  /* Sumi tokens defined locally so the marketing pages are self-contained (the
     app's index.css is a Tailwind v4 source and isn't compiled by the current
     Vite setup). Values mirror index.css exactly. */
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
  .navlinks a:hover,.navlinks a.active{color:var(--ink)}
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

  .canvas{position:relative;height:480px;border:1px solid var(--rule);background:var(--paper2);overflow:hidden;
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

  /* ── shared page chrome: heads, prose, faq, legal clauses ── */
  .pagehead{padding:60px 0 4px;max-width:60ch}
  .pagehead h1{font-family:var(--serif);font-weight:600;font-size:clamp(40px,5.4vw,76px);letter-spacing:-.015em;
    margin:0 0 20px;line-height:1.04;text-wrap:balance}
  .pagehead .lead{font-size:clamp(17px,1.6vw,20px);color:var(--ink-mid);max-width:48ch;margin:0}
  .sec{padding:72px 0;border-top:1px solid var(--rule)}
  .sec.alt{background:var(--paper2)}
  .sec h2{font-size:clamp(26px,3.4vw,44px);margin:0 0 26px;max-width:22ch}
  .prose{max-width:66ch}
  .prose p{font-size:16.5px;color:var(--ink-mid);margin:0 0 20px}
  .prose p:last-child{margin-bottom:0}
  .prose strong{color:var(--ink);font-weight:600}
  .prose em{font-style:italic;color:var(--ink)}
  .prose a{color:var(--accent);text-decoration:underline;text-underline-offset:2px}
  .whywrap{max-width:66ch;margin-top:44px}
  .whywrap h3{font-family:var(--serif);font-weight:600;font-size:24px;margin:0 0 16px;letter-spacing:-.01em}

  .faq details{border-top:1px solid var(--rule)}
  .faq details:last-child{border-bottom:1px solid var(--rule)}
  .faq summary{list-style:none;cursor:pointer;padding:22px 0;display:flex;justify-content:space-between;gap:24px;
    align-items:baseline;font-family:var(--serif);font-weight:500;font-size:20px;color:var(--ink)}
  .faq summary::-webkit-details-marker{display:none}
  .faq summary .plus{font-family:var(--gothic);font-weight:400;font-size:24px;color:var(--accent);flex:0 0 auto;
    transition:transform .2s;line-height:1}
  .faq details[open] summary .plus{transform:rotate(45deg)}
  .faq .ans{padding:0 0 26px;max-width:70ch}
  .faq .ans p{font-size:15.5px;color:var(--ink-mid);margin:0 0 14px}
  .faq .ans p:last-child{margin:0}
  .faq .ans a{color:var(--accent);text-decoration:underline;text-underline-offset:2px}

  .draftbar{border:1px solid var(--accent);background:color-mix(in oklch,var(--accent) 8%,var(--paper));
    padding:18px 22px;font-size:14.5px;color:var(--ink-mid);margin-top:36px}
  .draftbar b{color:var(--ink);font-weight:600}
  .clause{border-top:1px solid var(--rule);padding:30px 0;display:grid;grid-template-columns:56px 1fr;gap:22px;align-items:start}
  .clause .cn{font-family:var(--serif);font-size:28px;color:var(--accent);line-height:1;font-weight:600}
  .clause h3{font-family:var(--serif);font-weight:600;font-size:21px;margin:0 0 12px;letter-spacing:-.01em}
  .clause p{font-size:15px;color:var(--ink-mid);margin:0 0 12px;max-width:70ch}
  .clause p:last-child{margin-bottom:0}
  .clause ul{margin:0 0 12px;padding-left:20px}
  .clause li{font-size:15px;color:var(--ink-mid);margin:0 0 7px}
  .clause .src{font-size:12px;color:var(--ink-pale);margin-top:6px}
  .legalnote{font-size:13px;color:var(--ink-pale);margin-top:32px;max-width:70ch}

  .final{padding:100px 0;text-align:center}
  .final .hk{width:88px;height:88px;margin:0 auto 30px;font-size:50px}
  .final h2{font-size:clamp(34px,4.6vw,60px);margin-bottom:16px}
  .final p{color:var(--ink-mid);font-size:17px;max-width:42ch;margin:0 auto 30px}
  footer{border-top:1px solid var(--rule);padding:40px 0;display:flex;justify-content:space-between;
    align-items:center;gap:18px;flex-wrap:wrap;font-size:12.5px;color:var(--ink-pale)}
  footer .fb{font-family:var(--serif);font-size:16px;color:var(--ink)}
  footer .fb .jp{font-size:11px;color:var(--ink-pale);margin-left:8px;letter-spacing:.2em}
  footer .fnav a{color:var(--ink-mid);transition:color .15s}
  footer .fnav a:hover{color:var(--ink)}

  @media (max-width:900px){
    .hero{grid-template-columns:1fr;gap:34px;padding:44px 0 56px}
    .canvas{order:2;height:470px}
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
    .clause{grid-template-columns:1fr;gap:10px}
    .navlinks{gap:16px}
  }
}
:root[data-theme="light"] .mland{color-scheme:light}
:root[data-theme="dark"] .mland{color-scheme:dark}
`;

/** Top strip + nav. `current` marks the active page link. */
export function navHTML(current: 'home' | 'about' | 'terms'): string {
  const a = (page: string) => (current === page ? ' active' : '');
  return `
<div class="wrap">
  <div class="strip">
    <span><span class="sq"></span>Aotearoa New Zealand</span>
    <span class="sep">&#9474;</span><span>Corporate and property due diligence</span>
    <span class="sep">&#9474;</span><span>Open for early access</span>
  </div>
  <nav>
    <a class="brand" href="#/" aria-label="Mitsuketa home">
      <span class="seal mark" aria-hidden="true">&#35211;</span>
      <span><span class="nm">Mitsuketa</span><br><span class="jp">&#35211;&#12388;&#12369;&#12383;</span></span>
    </a>
    <div class="navlinks">
      <a href="#/" class="${a('home')}">Home</a>
      <a href="#/about" class="${a('about')}">About</a>
      <button class="tbtn" id="theme" type="button" aria-label="Toggle light or dark theme">Dark</button>
      <button class="btn primary js-enter" type="button">Start searching</button>
    </div>
  </nav>
</div>`;
}

export const FOOTER_HTML = `
<div class="wrap"><footer>
  <span class="fb">Mitsuketa<span class="jp">&#35211;&#12388;&#12369;&#12383;</span></span>
  <span class="fnav"><a href="#/about">About</a> &#183; <a href="#/terms">Terms</a></span>
  <span>&#169; 2026 Mitsuketa &#183; Aotearoa NZ</span>
</footer></div>`;

/**
 * Wires the shared chrome inside a `.mland` root: theme toggle (same keys the
 * app uses), the "Start searching" buttons, and letting the page scroll (the
 * app pins body overflow). Pages call this once with their root ref.
 */
export function useMarketingChrome(rootRef: RefObject<HTMLElement>, onEnter: () => void) {
  useEffect(() => {
    const container = rootRef.current;
    if (!container) return;
    const rootEl = document.documentElement;

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

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'auto';

    const enterEls = Array.from(container.querySelectorAll('.js-enter')) as HTMLElement[];
    const onEnterClick = (e: Event) => { e.preventDefault(); onEnter(); };
    enterEls.forEach(el => el.addEventListener('click', onEnterClick));

    return () => {
      themeBtn?.removeEventListener('click', onTheme);
      enterEls.forEach(el => el.removeEventListener('click', onEnterClick));
      document.body.style.overflow = prevOverflow;
    };
  }, [rootRef, onEnter]);
}
