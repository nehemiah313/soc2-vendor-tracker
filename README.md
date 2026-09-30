# SOC 2 Vendor & Subservice Organization Tracker

A static, offline-capable web app for tracking vendor risk reviews as part of SOC 2 readiness. Built on the AICPA Trust Services Criteria dataset, it focuses on **CC9.2** (vendor and business partner risk management) and **P6.4 / P6.5** (vendor privacy commitments and breach notification).

## What it does

- Vendor register: name, service, data/system access, criticality, SOC 2 report status (date + Type I/II), DPA or privacy commitments, review dates, risk notes.
- Dashboard: total vendors, critical vendors, vendors missing a current SOC 2 report, reviews due within 30 days, overdue reviews.
- Flagged list: critical vendors without a SOC 2 report dated within the last 12 months.
- Annual review workflow: "Mark reviewed" stamps today and sets the next review 12 months out.
- Exports: CSV register and Markdown vendor risk summary.
- All data stays in your browser (localStorage key `soc2vendors`). No backend, no CDNs, works offline.

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
cd soc2-vendor-tracker
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Data

`data/tsc.json` is a copy of the machine-readable AICPA Trust Services Criteria dataset (61 criteria, 2017 TSP Section 100 with 2022 revised points of focus). Source repo: https://github.com/nehemiah313/tsc-dataset. Summaries and evidence suggestions are original plain-English guidance, not AICPA text.

## Verify logic

```bash
node verify.js
```

**Readiness aid only. Not an audit, attestation, CPA opinion, or legal advice.**

Built by AI Tech Pros. MIT License.
