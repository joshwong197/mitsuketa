import React from 'react';
import { PropertyApplication } from './PropertyApplication';

export default function RequestAccessPage() {
    return <main className="sumi-access-page application-page">
        <header><a href="/" className="sumi-access-brand">見 <span>Mitsuketa</span></a><a href="/#/">Back to search</a><a href="/?access=signin">Sign in</a></header>
        <div className="sumi-access-layout">
            <section>
                <p className="sumi-eyebrow">地 · Property access</p>
                <h1>Apply for access</h1>
                <p>Search titles, registered owners and property interests. Tell us what you need the information for so we can review your request.</p>
                <p>Company searches are open to everyone. You only need to apply for property access.</p>
                <ol className="application-steps">
                    <li><strong>Send your application</strong><span>Tell us about yourself and your intended use.</span></li>
                    <li><strong>We review your request</strong><span>We may ask for more information before deciding.</span></li>
                    <li><strong>Set up your account</strong><span>If approved, you’ll receive an email invitation. Follow it to register and complete the access requirements.</span></li>
                </ol>
                <p>Already applied? Sending the form again won’t replace your original answers.</p>
            </section>
            <section className="sumi-access-form" aria-label="Property access application"><PropertyApplication /></section>
        </div>
        <footer><a href="/#/privacy">Privacy notice</a> · <a href="/#/terms">Terms of use</a> · <a href="/#/about">About Mitsuketa</a></footer>
    </main>;
}
