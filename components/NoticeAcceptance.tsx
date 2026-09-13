import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PRIVACY_DOCUMENT_HTML, TERMS_DOCUMENT_HTML } from './legalContent';

function DocumentReader({ title, html, reachedEnd, onReachedEnd, initiallyOpen = false }: {
    title: string; html: string; reachedEnd: boolean; onReachedEnd: () => void; initiallyOpen?: boolean;
}) {
    const [open, setOpen] = useState(initiallyOpen);
    const viewport = useRef<HTMLDivElement>(null);
    const content = useRef<HTMLDivElement>(null);
    const [expanded,setExpanded]=useState(false);
    const dialog=useRef<HTMLDialogElement>(null);
    const enlarge=useRef<HTMLButtonElement>(null);
    const scrollPosition=useRef(0);
    const checkEnd = () => {
        const node = viewport.current;
        if (open && !reachedEnd && node && node.clientHeight > 0 && node.scrollHeight - node.scrollTop - node.clientHeight <= 2) onReachedEnd();
    };
    useEffect(() => {
        if (!open) return;
        // Recheck font/layout changes and documents that fit without scrolling.
        const observer = new ResizeObserver(checkEnd);
        if (viewport.current) observer.observe(viewport.current);
        if (content.current) observer.observe(content.current);
        checkEnd();
        return () => observer.disconnect();
    }, [open, reachedEnd, html, expanded]);
    useEffect(()=>{
        if(viewport.current)viewport.current.scrollTop=scrollPosition.current;
        if(!expanded)return;
        dialog.current?.showModal();
        const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
        return()=>{document.body.style.overflow=overflow;enlarge.current?.focus();};
    },[expanded]);
    const close=()=>{scrollPosition.current=viewport.current?.scrollTop||0;setExpanded(false);};
    const reader=<div className="sumi-notice-reader" ref={viewport} tabIndex={0} role="region" aria-label={`${title} document`} onScroll={()=>{scrollPosition.current=viewport.current?.scrollTop||0;checkEnd();}}>
        <div className="sumi-notice-text" ref={content} dangerouslySetInnerHTML={{__html:html}} />
        <p className="sumi-notice-end">End of {title.toLowerCase()}</p>
    </div>;
    return <details className="sumi-notice-document" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
        <summary><span>{title}</span><small>{reachedEnd ? 'Reached the end ✓' : 'Scroll to the end'}</small></summary>
        <div className="sumi-reader-tools"><button ref={enlarge} type="button" onClick={()=>setExpanded(true)} aria-label={`Read ${title.toLowerCase()} in a larger window`}>Read larger ↗</button></div>
        {!expanded&&reader}
        {expanded&&createPortal(<dialog ref={dialog} className="sumi-reading-dialog" aria-label={`${title} — larger view`} onCancel={close} onClose={close} onClick={e=>{
            if(e.target===dialog.current){const r=dialog.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}
        }}><header><div><p className="sumi-eyebrow">読 · Read at your pace</p><h2>{title}</h2></div><button type="button" className="sumi-text-action" onClick={close}>Close reader ×</button></header>
            {reader}<footer>{reachedEnd?'Reached the end ✓':'Scroll to the end to complete this document.'}</footer>
        </dialog>,document.body)}
    </details>;
}

export const NoticeAcceptance: React.FC<{ accepted: boolean; onChange: (value: boolean) => void }> = ({ accepted, onChange }) => {
    const [privacyEnd, setPrivacyEnd] = useState(false);
    const [termsEnd, setTermsEnd] = useState(false);
    const root = useRef<HTMLElement>(null);
    const description = useId();
    const ready = privacyEnd && termsEnd;
    useEffect(() => { onChange(false); }, []);
    return <section ref={root} className="sumi-notice-acceptance" aria-label="Review privacy notice and terms" onClick={e => {
        // The terms cross-reference the notice. Keep that link inside this
        // review instead of navigating away and discarding the application.
        if ((e.target as HTMLElement).closest('a')?.getAttribute('href') !== '#/privacy') return;
        e.preventDefault();
        (e.target as HTMLElement).closest('dialog')?.close();
        const privacy = root.current?.querySelector('details');
        if (privacy) privacy.open = true;
        requestAnimationFrame(() => {
            const reader = privacy?.querySelector<HTMLElement>('[role="region"]');
            reader?.focus({ preventScroll: true }); reader?.scrollIntoView({ block: 'nearest' });
        });
    }}>
        <p id={description} className="sumi-notice-progress" role="status">
            {ready ? 'Both documents reached the end. You can now confirm your acceptance.'
                : privacyEnd ? 'Privacy notice complete. Open the terms and scroll to the end to continue.'
                    : termsEnd ? 'Terms complete. Scroll to the end of the privacy notice to continue.'
                        : 'Read both documents below. Acceptance unlocks when you reach the end of each.'}
        </p>
        <DocumentReader title="Privacy notice" html={PRIVACY_DOCUMENT_HTML} reachedEnd={privacyEnd} onReachedEnd={() => setPrivacyEnd(true)} initiallyOpen />
        <DocumentReader title="Terms of use" html={TERMS_DOCUMENT_HTML} reachedEnd={termsEnd} onReachedEnd={() => setTermsEnd(true)} />
        <label className="sumi-notice-confirm">
            <input type="checkbox" disabled={!ready} checked={ready && accepted} aria-describedby={description}
                onChange={e => { if (ready) onChange(e.target.checked); }} />
            <span>I have read and accept the privacy notice and terms and will use property information only for lawful property-related purposes.</span>
        </label>
    </section>;
}
