# KOR Supply sąskaitos

Invoicing for UAB Sakorus, built to replace naujasaskaita.lt. The whole app is one file, `index.html`, with no build step.

## What it does

- PVM sąskaitos faktūros, išankstinės and kreditinės sąskaitos, in Lithuanian, English or Polish.
- VAT chosen from the buyer's country: LT 21 %, EU company with a VAT code 0 %, EU private buyer at that country's OSS rate, non-EU 0 % export. Any line can be overridden by hand.
- Any currency per invoice, with the EUR equivalent on the invoice.
- VIES check of the buyer's VAT code when a 0 % EU invoice is issued; the result is stored with the invoice.
- Issued invoices are locked. Mistakes are corrected with a credit note, and numbers run without gaps (SAK continues from 4808).
- PDF matching the current paper invoice, and sending it to the buyer from Gmail with a send log.
- Bank statement import (Swedbank CSV) to mark invoices paid, OSS report, invoice register CSV and a draft i.SAF file for the accountant.
- Company lookup by name, company code or VAT code.

## Running it

Open `index.html` in a browser. On its own it works with example data (series DEMO) kept in that browser only.

Published as a Claude artifact, it uses a shared database, each person's own login, and the Firecrawl (VIES, company search) and Gmail connectors.

## Code layout

`index.html` has three marked parts:

- `/*CORE-START*/ … /*CORE-END*/`: business logic with no dependency on the page (VAT rule, totals, payment status, bank matching, OSS report, amount in words, printable invoice model, PDF definition).
- `/*PLATFORM-START*/ … /*PLATFORM-END*/`: storage, numbering, connectors and file downloads. The comment at the top says what each function becomes on Supabase.
- The rest is the user interface.

The same logic was moved into the CRM (`rokaszelvys1-collab/cmr`, Finansai → Sąskaitos).

## Tests

```
npm install
npm test
```

The tests run the page in jsdom with mocked connectors: browser-only mode, VIES and e-mail, and a shared database with two users and a read-only viewer. `t_pdf.js` writes three sample PDFs to `tests/`.
