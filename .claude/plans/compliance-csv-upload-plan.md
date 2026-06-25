# Plan: Compliance controls CSV/Excel upload

## Goal
Let users upload a spreadsheet that lists PCI DSS and ISO 27001 controls directly into CTO Dash, so the Compliance section shows real control status, evidence links, owners, and review dates without needing a dedicated GRC tool.

## Approach
1. Define a simple spreadsheet template with one row per control.
2. Add a backend endpoint that accepts the uploaded file, validates required columns, parses CSV (and optionally `.xlsx`), and writes controls into the existing `Metric`/`Event` tables under the source `compliance_manual`.
3. Make the upload idempotent: each upload deletes previous `compliance_manual` rows and inserts fresh data, matching the existing `POST /sync/{source}` behavior.
4. Add a frontend upload panel in the Compliance section with a download-template link, drag-and-drop file input, and a summary of the uploaded controls.
5. Render the uploaded controls in a new `ComplianceControlsTable` widget and use them to enrich the existing `ComplianceWidget` framework scores.

## Backend changes

### New endpoint: `POST /compliance/upload`
- Accepts `multipart/form-data` with a single `file` field.
- Allowed extensions: `.csv`, `.xlsx`.
- Required columns (case-insensitive header matching):
  - `framework` — `pci_dss` or `iso_27001` (also accept `PCI DSS`, `ISO 27001`).
  - `control_id` — e.g., `PCI-1.1`, `ISO-A.9.1.2`.
  - `title` — short description.
  - `status` — `passed`, `failed`, `partial`, `not_applicable`, `pending`.
  - Optional but useful: `requirement`, `owner`, `severity`, `evidence_url`, `reviewed_at`, `next_review_at`, `notes`.
- Validation rules:
  - Reject empty `framework`, `control_id`, `title`, `status`.
  - Normalize `framework` to `pci_dss` or `iso_27001`.
  - Normalize `status` to lowercase.
  - Parse dates in `YYYY-MM-DD` or ISO 8601 format; store as ISO strings in `meta`.
- Storage:
  - One `Metric` per row:
    - `source`: `compliance_manual`
    - `metric_type`: `compliance_control_status`
    - `entity`: `control_id`
    - `value`: `1` for passed, `0` for failed, `0.5` for partial, `null` for not_applicable/pending
    - `meta`: `{ framework, control_id, title, requirement, owner, status, severity, evidence_url, reviewed_at, next_review_at, notes }`
    - `is_seed`: `False`
  - One `Event` per row when:
    - `status` is `failed` → `event_type: compliance_finding`, `severity: high` (or provided severity).
    - `status` is `partial` or `pending` → `event_type: compliance_review_needed`, `severity: medium`.
    - `next_review_at` is within 30 days and status is not `failed` → `event_type: evidence_expiry`, `severity: low`.
- Response:
  ```json
  {
    "source": "compliance_manual",
    "metrics": 150,
    "events": 23,
    "errors": []
  }
  ```

### New Pydantic schemas
- `ComplianceUploadOut` with `source`, `metrics`, `events`, `errors: list[str]`.

### Dependency updates
- Add `openpyxl>=3.1.0` to `backend/requirements.txt` for `.xlsx` parsing.
- Keep CSV parsing in the Python standard library (`csv.DictReader`).

## Frontend changes

### New API wrapper
- In `frontend/lib/api.ts`:
  ```ts
  export const uploadComplianceFile = (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api("/compliance/upload", { method: "POST", body: form });
  };
  ```

### New component: `ComplianceUploadPanel`
- Place in `frontend/components/widgets/ComplianceUploadPanel.tsx`.
- Features:
  - Download template link (`.csv`) with sample PCI/ISO rows.
  - File input accepting `.csv,.xlsx`.
  - Upload button with loading state.
  - Inline summary after upload: "150 controls uploaded, 23 findings/reviews created".
  - List per-row validation errors if any.

### New widget: `ComplianceControlsTable`
- Place in `frontend/components/widgets/ComplianceControlsTable.tsx`.
- Render uploaded controls from `metrics` where `metric_type === "compliance_control_status"`.
- Columns: Control ID, Framework, Title, Owner, Status, Evidence, Reviewed, Next review.
- Status badges with color coding: passed (green), failed (red), partial/pending (amber), not_applicable (gray).
- Filter by framework and status.

### Update `ComplianceSection`
- Add `ComplianceUploadPanel` near the top of the section.
- Add `ComplianceControlsTable` below the existing "Open Audit Findings" table.
- Drive `ComplianceWidget` framework scores from uploaded `compliance_control_status` metrics when available; fall back to existing `compliance_framework_score` metrics or seed data.

### Re-export widgets
- Add `ComplianceUploadPanel` and `ComplianceControlsTable` to `frontend/components/widgets/index.ts`.

## Template file
- Create `templates/compliance_controls_template.csv` in the repo root with sample rows for:
  - PCI DSS (e.g., req 1 firewall, req 3 data encryption, req 8 identity, req 10 logging).
  - ISO 27001 (e.g., A.5.1 policies, A.9.1 access, A.12.2 malware, A.16.1 incident).
- Frontend download link serves this static file via `fetch('/templates/compliance_controls_template.csv')`, or we can embed it as a data URI.

## Files to modify
1. `backend/api/main.py` — add `POST /compliance/upload` and helper functions.
2. `backend/api/schemas.py` — add `ComplianceUploadOut`.
3. `backend/requirements.txt` — add `openpyxl`.
4. `frontend/lib/api.ts` — add `uploadComplianceFile`.
5. `frontend/components/widgets/ComplianceUploadPanel.tsx` — new.
6. `frontend/components/widgets/ComplianceControlsTable.tsx` — new.
7. `frontend/components/widgets/index.ts` — re-exports.
8. `frontend/components/sections/ComplianceSection.tsx` — wire new widgets.
9. `templates/compliance_controls_template.csv` — new sample file.

## Validation
- Run `python -m compileall backend` after backend edits.
- Run `npm run build` after frontend edits.
- Manually test upload with the sample CSV and verify counts and dashboard rendering.

## Open decision
- **Date format:** Require `YYYY-MM-DD` only, or also accept `MM/DD/YYYY` and `DD/MM/YYYY`? I recommend requiring `YYYY-MM-DD` (unambiguous) and ISO 8601 in the docs, because mixed locale dates are a common source of upload errors.
- **Per-control merge vs. replace-all:** I recommend replace-all on each upload because it matches existing sync semantics, keeps the implementation simple, and avoids stale controls accumulating from old spreadsheets. If you later need incremental updates, we can add a separate `POST /compliance/row` endpoint.

## Why this design
- Reuses the existing `Metric`/`Event` model and dashboard widgets, so no new DB tables are needed.
- CSV-first keeps the template editable in Excel/Sheets without forcing the user to install a new dependency.
- Mapping each control to a metric plus conditional events makes the uploaded data visible in both the Compliance section tables and the live activity feed.
