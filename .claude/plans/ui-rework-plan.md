# CTO Dash UI Rework Plan

## Current state
The existing UI is a functional first-pass dashboard built with Next.js 15, Tailwind, shadcn/ui, and Recharts. It already has the right sections (Overview, Engineering, Product, Operations, Security, Cost, Team) but the implementation is generic and flat:

- **Visual identity:** light glassmorphism everywhere, low contrast, no dark mode.
- **Information density:** large empty cards, repetitive KPI grids, no progressive disclosure.
- **Action orientation:** data is displayed but rarely highlights what needs attention.
- **Navigation:** sidebar tabs swap the entire page content, making cross-section comparison impossible.
- **Responsiveness:** mobile nav is a horizontal scroll; cards do not reflow gracefully.
- **Polish:** no command palette, no global filters, no consistent skeletons, no theme toggle.

## Goal
Transform the dashboard into a **fintech-grade engineering command center** that is dense, scannable, and action-oriented: every widget should answer *"Is there something I need to act on, escalate, or celebrate?"*

## Guiding design principles
1. **Status-first:** critical items (incidents, SLA-breached CVEs, blocked tickets) are visually loudest.
2. **Density without clutter:** use a 12-column grid, compact KPIs, and progressive disclosure.
3. **Consistency:** every widget shares the same header, loading, error, and empty states.
4. **Theme-aware:** full light/dark support via CSS variables.
5. **Responsive:** sidebar collapses to a rail; content reflows from 4→2→1 columns.
6. **Accessible:** WCAG 2.1 AA contrast, keyboard navigation, reduced-motion support.

## Proposed changes

### 1. Design-system upgrade
- Replace ad-hoc glass styles with a stricter token set: `background`, `foreground`, `card`, `muted`, `accent`, `danger`, `warning`, `success`, `ring`, `radius`.
- Add a dark variant of every token.
- Introduce semantic colors used across the app: `status-open`, `status-closed`, `severity-critical`, `severity-high`, etc.
- Keep shadcn/ui primitives (Button, Card, Badge, Avatar, Separator, Tooltip) but override them to use the new tokens.
- Add a `ThemeProvider` + `ThemeToggle` using `next-themes` (light/dark/system).

### 2. Layout overhaul
- **Header (sticky, glass):**
  - Left: command-center title + global search trigger (`⌘K`).
  - Center: global filters (date range, squad, environment) as a single compact bar.
  - Right: alert pill (P0/P1 incidents + critical CVEs), refresh button with spinner, theme toggle, user avatar.
- **Sidebar:** collapsible rail (64 px) on desktop with tooltips; bottom sheet / drawer on mobile; active section indicator.
- **Dashboard body:**
  - **Overview:** dense mosaic of the most important signals only (connector health strip, 6 KPIs, 4 charts, 2 tables).
  - **Section pages:** show the full set of widgets for that domain instead of the same KPIs repeated.
  - Introduce `SectionHeader` with title, description, and a contextual "action" slot (e.g. "View all incidents").

### 3. New reusable widget primitives
Create a `widgets/` folder with the following shared building blocks so future sections look identical:

| Component | Purpose |
|-----------|---------|
| `Widget` | Container with consistent padding, radius, shadow, loading & error states. |
| `WidgetHeader` | Title, subtitle, optional badge, action link/button. |
| `Stat` | Compact numeric KPI with change indicator, sparkline, and target comparison. |
| `Sparkline` | Tiny SVG line chart for KPI context. |
| `TrendChart` | Larger Recharts area/bar/composed chart with legend, reference lines, and better tooltips. |
| `DataTable` | Replaces `StatusTable`: sortable-looking headers, avatars, status pills, severity chips, empty state. |
| `Timeline` | Vertical incident/activity feed with timestamps, severity dots, and owners. |
| `ProgressList` | Epic/release list with progress bars and owners. |
| `SeverityBadge` / `StatusBadge` / `TrendBadge` | Unified semantic badges. |
| `SkeletonGrid` / `SkeletonWidget` | Section-aware loading placeholders. |

### 4. Enhanced existing widgets
- **KPI cards → Stat widgets:** smaller footprint, inline sparkline, trend arrow + absolute change, optional "vs target" suffix.
- **TrendChart:** add chart-type variants (area, bar, composed), reference line for targets/SLOs, custom tooltip, legend, and empty state.
- **StatusTable → DataTable:** columnar layout, sticky header, hover row, severity ordering, row-level actions.
- **ConnectorStatus:** horizontal "health strip" instead of a full card; inline reconnect action; last-sync timestamp.

### 5. New widgets per plan.md
- **Engineering:** deployment frequency + lead time + MTTR + change-failure rate DORA cards; PRs stuck >48 h list; CI pass-rate chart.
- **Product Delivery:** active sprint burndown chart; velocity trend (last 6 sprints); epic progress list; release calendar mini-list.
- **Operations:** service uptime/SLO grid; open incident timeline; on-call load distribution; p95 latency + error-rate charts.
- **Security:** CVE severity distribution (donut/bar); critical >SLA list; secrets-scanning findings; compliance control pass/fail grid.
- **Cost:** MTD spend vs budget progress; cost-per-transaction trend; top cost drivers table.
- **Team:** capacity mini-cards; hiring pipeline funnel; key dates list.

For this rework, the **data stays mocked/sampled** where the backend does not yet provide it; the focus is the presentation shell and layout.

### 6. Interactions & polish
- **Command palette (`⌘K`):** search sections, navigate, trigger sync (using shadcn Command dialog).
- **Refresh:** spinner on the refresh icon, section-level skeletons, "last updated" timestamp.
- **Filters:** date-range and squad filters update displayed data client-side for now.
- **Tooltips:** every KPI and chart element explains the metric and source.
- **Hover states:** cards lift slightly, rows highlight, action buttons appear on hover.
- **Transitions:** CSS transitions only for theme toggle; `prefers-reduced-motion` disables them.

### 7. Responsiveness
- Desktop: 256 px sidebar + 12-column grid.
- Tablet: collapsible rail + 2-column grids.
- Mobile: bottom sheet nav + single-column stacked widgets.

## Files to change / create

### Modify
- `frontend/app/globals.css` — new token set + dark tokens, refined utilities.
- `frontend/app/layout.tsx` — wrap with `ThemeProvider`.
- `frontend/app/page.tsx` — pass filter context down.
- `frontend/components/DashboardClient.tsx` — new section-based layout, global filters, command palette integration.
- `frontend/components/Header.tsx` — command-center header with filters, alerts, theme toggle.
- `frontend/components/Sidebar.tsx` — collapsible rail + mobile sheet.
- `frontend/components/KpiCard.tsx` → refactor to `Stat`.
- `frontend/components/TrendChart.tsx` — add variants, tooltip, legend, empty state.
- `frontend/components/StatusTable.tsx` → refactor to `DataTable`.
- `frontend/components/ConnectorStatus.tsx` — health strip.
- `frontend/tailwind.config.ts` — extend tokens (radius, shadows, status colors).
- `frontend/package.json` — add `next-themes` and `date-fns`.

### Create
- `frontend/components/providers/ThemeProvider.tsx`
- `frontend/components/ui/command.tsx` (shadcn Command primitive)
- `frontend/components/widgets/Widget.tsx`
- `frontend/components/widgets/WidgetHeader.tsx`
- `frontend/components/widgets/Stat.tsx`
- `frontend/components/widgets/Sparkline.tsx`
- `frontend/components/widgets/DataTable.tsx`
- `frontend/components/widgets/Timeline.tsx`
- `frontend/components/widgets/ProgressList.tsx`
- `frontend/components/widgets/SkeletonGrid.tsx`
- `frontend/components/GlobalFilters.tsx`
- `frontend/components/CommandMenu.tsx`
- `frontend/components/ThemeToggle.tsx`
- `frontend/components/sections/*` — one component per section (Overview, Engineering, Product, Operations, Security, Cost, Team) using the widget primitives.

## Implementation order
1. **Foundation:** install deps, set up theme tokens, `ThemeProvider`, and base utilities.
2. **Primitives:** build `Widget`, `WidgetHeader`, `Stat`, `Sparkline`, `DataTable`, `Timeline`, `ProgressList`, `SkeletonGrid`.
3. **Shell:** rebuild `Header`, `Sidebar`, add `GlobalFilters`, `CommandMenu`, `ThemeToggle`.
4. **Charts:** upgrade `TrendChart` with variants/tooltips/empty state.
5. **Sections:** rewrite `DashboardClient` to use the new primitives; create section components with the richer widgets from the plan.
6. **Polish:** hover states, transitions, responsive edge cases, skeletons, error states.
7. **Validation:** run `npm run build`, manual responsive check, accessibility spot-check.

## Out of scope (for now)
- Real-time WebSocket updates.
- Backend data expansion beyond what the FastAPI currently exposes.
- User authentication / role-based views.
- Customizable widget layouts (drag-and-drop).
- Email/Slack alerting.

## Dependencies to add
- `next-themes` — theme switching.
- `date-fns` — consistent date formatting.
- `cmdk` (comes with shadcn Command via Radix) if not already present.

## Approval questions
1. Should the default theme be **light**, **dark**, or **system**?
2. Do you want the **sidebar as a collapsible rail** or keep the current expanded sidebar?
3. Are you OK adding `next-themes` and `date-fns` as dependencies?
4. Should the Overview page remain the dense "summary of everything" or become a single focused command view?
