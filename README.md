# AICTE Complaint Intelligence Hub

> **Tagline:** One Platform. Every Complaint. Complete Accountability.  
> **Notice:** Proposed prototype developed for the Smart India Hackathon problem statement *"Integrated Dashboard for Monitoring and Tracking Institution-Related Complaint Cases Across AICTE Bureaus/Cells."* Not an official AICTE system. All seeded records are synthetic demonstration data (`DEMONSTRATION ENVIRONMENT — SAMPLE DATA — NOT OFFICIAL AICTE RECORDS`).

---

## 1. Product Positioning

**AICTE Complaint Intelligence Hub** is a proposed integrated platform that helps authorized stakeholders monitor institutional complaints across configured bureaus and cells, identify backlogs, coordinate investigations, manage escalation, and improve accountability through explainable AI-assisted insights.

---

## 2. Implemented Features

1. **Central Command Dashboard**:
   - Real-time KPIs computed from stored database records (Total Complaints, Intake/Awaiting Assignment, Under Investigation, Awaiting Institution Reply, Overdue SLA, Critical Priority, Escalations, Resolved/Closed, Reopened, Avg Resolution Cycle).
   - Interactive drill-down from any KPI card or heatmap cell to the filtered Complaint Management Workspace.
   - Multi-dimensional filters (Date Window, Bureau/Cell, Institution, Priority, Lifecycle Stage) and one-click CSV Export.
   - **Signature Visualizations**: Monthly Intake vs. Resolution & Escalation Area Chart, Bureau Workload Comparison Bar Chart, **Bureau × Priority Case Ageing Heatmap**, **Workflow Bottleneck Detector**, and **Management Brief Generator**.
2. **Complete 13-Stage Complaint Lifecycle & Workspace**:
   - Enforces explicit state-transition policy (`Received` → `Initial Review` → `Pending Assignment` → `Assigned` → `Under Investigation` → `Awaiting Institution Response` → `Additional Information Required` → `Resolution Proposed` → `Resolution Under Review` → `Resolved` → `Reopened` → `Closed` → `Escalated`).
   - Registry Table View (with search, multi-column sorting, saved views, pagination, bulk assignment, CSV export) and Kanban Lifecycle Board View.
   - 7-Tab Case Detail Workspace (`Overview & Actions`, `Smart Timeline`, `Investigation Notes`, `Institution Responses`, `Explainable AI Assessment`, `Duplicates & Links`, `Attachments & Audit`).
3. **Explainable AI Complaint Intelligence & Deterministic Fallback**:
   - Automatic Category & Subcategory Classification, Transparent Factor-Weighted Priority Recommendation, Jaccard + Institution + Category Duplicate Detection, Structured Summarization (separating reported allegations from verified facts), Urgency Signals, and Contextual Intelligence Assistant.
   - Human-in-the-loop supervisory feedback (`ACCEPTED`, `MODIFIED`, `REJECTED`).
4. **Role-Based Access Control (RBAC) & Row-Level Security**:
   - 5 distinct roles enforced on both backend (`/api/*`) and PostgreSQL RLS (`supabase/migrations/002_rls_policies.sql`): `SUPER_ADMIN`, `CENTRAL_MONITORING_OFFICER`, `BUREAU_OFFICER`, `INSTITUTION_LIAISON`, and `AUDITOR`.
   - `INSTITUTION_LIAISON` is scoped strictly to their institution's records and cannot view `INTERNAL` investigation notes.
   - `AUDITOR` has read-only access to case histories, reports, and immutable audit logs, and is blocked from mutating records.
5. **Smart Escalation Engine, Bureau Coordination, CSV Institution Importer & 11 Reports**:
   - Editable priority SLA targets, Level 1–3 escalation tracking, inter-bureau transfers, validated CSV batch institution importer with duplicate detection, and 11 management report templates.

---

## 3. Project Structure

```text
/
├── server.ts                              # Express + Vite full-stack server & REST API (/api/*)
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql         # Normalized 24-table PostgreSQL schema
│   │   └── 002_rls_policies.sql           # Row Level Security policies & immutable audit trigger
│   └── seed.sql                           # Repeatable PostgreSQL seed script
├── src/
│   ├── App.tsx                            # Main layout shell, role switcher, navigation & judge guide
│   ├── index.css                          # Typography, tabular numerals, reduced-motion & print rules
│   ├── db/
│   │   ├── types.ts                       # TypeScript domain models & schema types
│   │   ├── rules.ts                       # Pure business logic (workflow, RBAC, AI, SLA, CSV, analytics)
│   │   ├── rules.test.ts                  # Automated unit tests (node:test)
│   │   ├── seedData.ts                    # Synthetic 16-case demonstration dataset
│   │   └── repository.ts                  # Persistent transactional JSON store
│   └── components/
│       ├── CommandDashboard.tsx           # Central Command Dashboard, Heatmap, Bottlenecks & Brief
│       ├── ComplaintWorkspace.tsx         # Registry Table, Kanban Board & 7-Tab Case Detail View
│       ├── ComplaintRegistration.tsx      # Intake form, Draft saving & AI Pre-Check
│       ├── AIIntelligenceCenter.tsx       # Contextual Assistant, Duplicate Network & AI Review
│       └── OperationsAndGovernance.tsx    # Escalations, Bureaus, Institutions/CSV, Reports, Audit, Settings
└── .env.example                           # Documented environment variable template
```

---

## 4. Setup, Local Development & Testing Commands

```bash
# 1. Install dependencies
npm install

# 2. Copy environment configuration example
cp .env.example .env

# 3. Run automated unit tests for workflow, RBAC, SLA, AI, and CSV validation
npm test
# or: npx --yes tsx --test src/db/rules.test.ts

# 4. Type-check and build production bundle
npm run lint
npm run build

# 5. Start full-stack server on http://localhost:3000
npm run dev
```

---

## 5. Database Setup & Migration Instructions (PostgreSQL / Supabase)

1. Provision a PostgreSQL 15+ database or Supabase project.
2. Apply the schema migration:
   ```bash
   psql "$DATABASE_URL" -f supabase/migrations/001_initial_schema.sql
   ```
3. Apply Row Level Security policies and immutable audit triggers:
   ```bash
   psql "$DATABASE_URL" -f supabase/migrations/002_rls_policies.sql
   ```
4. Seed initial demonstration roles and bureaus (optional for demo environments):
   ```bash
   psql "$DATABASE_URL" -f supabase/seed.sql
   ```
5. Before an authorized production deployment, remove demonstration records by running:
   ```sql
   DELETE FROM complaints WHERE is_demo_data = TRUE;
   DELETE FROM institution_directory WHERE is_demo_record = TRUE;
   ```

---

## 6. Known Limitations & Production Readiness Checklist

- **Background Scheduled Jobs**: Automatic background cron jobs for SLA scanning are replaced in this container environment with an on-demand `/api/escalations/recalculate` endpoint and real-time SLA calculation on read.
- **External Integrations Requiring Credentials**:
  - Hosted Supabase Auth & Storage (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
  - External Server-Side LLM (`GEMINI_API_KEY`); when unconfigured, the Deterministic Rule-Based Assistance Engine runs automatically.
  - External SMTP Email relay (`SMTP_HOST`, `SMTP_USER`).
- **Pre-Production Security Checklist**:
  - Enable OIDC / SAML single sign-on with MFA for all bureau and supervisory officers.
  - Configure object storage virus scanning for uploaded PDF annexures.
  - Conduct CERT-In / STQC web application security audit before ingesting real student or institutional records.
