# School Connect Demo Privacy Notice

This development preview uses synthetic school and child records only. The interactive dashboard stores its demo changes in the current browser's local storage. “Reset data” clears that demo state. Do not enter real student, guardian, attendance, location, health, academic or contact data.

The included local Supabase seed creates synthetic accounts and records. It is intended only for a local development database; the seed script refuses to run when `NODE_ENV=production`. Browser geolocation is requested only when a driver explicitly selects location sharing. The preview does not upload that browser location to a server. Simulated map coordinates are labelled in the interface.

## Consent and authorization workflow required before deployment

The school must document its authority and purpose for each category of student data, provide a clear notice to parents/guardians, obtain and retain any consent required by applicable law, verify guardian identity and authority, and record consent version, scope, timestamp and withdrawal. Access to a student must remain blocked until the guardian link is verified. School administrators must document staff authorization and promptly remove access when roles end. This workflow is not implemented in the demo UI or schema and must be completed before real student data is processed.

## Production review

A qualified India privacy counsel and security reviewer must assess the Digital Personal Data Protection Act, rules in force at deployment, education-sector duties and child-data requirements. Define purpose limitation, retention and deletion periods (especially for GPS), access/export/correction/withdrawal requests, incident response, backups, vendor terms, data residency requirements and school/guardian communication. No advertising trackers are included. This notice is not legal advice or evidence that the demo is production-compliant.