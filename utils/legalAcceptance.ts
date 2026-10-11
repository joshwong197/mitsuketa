// Server-only. Fingerprint the actual published text, never an unpublished draft.
import { createHash } from 'node:crypto';
import { PRIVACY_DOCUMENT_HTML, TERMS_DOCUMENT_HTML } from '../components/legalContent.js';
export const LINZ_LICENCE_URL = 'https://data.linz.govt.nz/license/linz-licence-for-personal-data-23/';
export const LINZ_LICENCE_VERSION = '2.3';
export function legalRelease() { return process.env.PROPERTY_LEGAL_RELEASE?.trim() || ''; }
export function legalDocuments() {
    const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
    const termsHash=hash(TERMS_DOCUMENT_HTML), privacyHash=hash(PRIVACY_DOCUMENT_HTML);
    return { release:legalRelease(), termsHash, privacyHash, linzVersion:LINZ_LICENCE_VERSION, linzUrl:LINZ_LICENCE_URL,
        documentSet:hash(JSON.stringify([legalRelease(),termsHash,privacyHash,LINZ_LICENCE_VERSION,LINZ_LICENCE_URL])) };
}
export function validLegalAcceptance(body:any) {
    return body?.documentSet===legalDocuments().documentSet && body?.acceptTerms===true && body?.acknowledgePrivacy===true && body?.acceptLinz===true;
}
