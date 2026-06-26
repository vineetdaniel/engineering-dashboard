# Plan: Integrate Planning Pages with Existing Dashboard Shell

## Problem
The new `/sprints`, `/sprints/[id]`, and `/resources` pages render as standalone full-width pages. They do not include the existing CTO Dash sidebar, header, command menu, or mobile navigation, so users lose the app context when they click "Planning".

## Goal
Render the planning pages inside the same dashboard shell (sidebar + header + mobile nav + command menu) used by the main dashboard, so the transition feels like switching sections rather than leaving the app.

## Approach
Extract the layout shell from `DashboardClient` into a reusable `DashboardShell` component, then wrap the planning pages with it.

### Files to change
- `frontend/components/DashboardShell.tsx` — new reusable wrapper with Sidebar, Header, MobileNav, MobileBottomNav, CommandMenu.
- `frontend/components/DashboardClient.tsx` — use `DashboardShell` instead of inline layout.
- `frontend/components/Sidebar.tsx` — keep the planning link as already added.
- `frontend/app/sprints/page.tsx`, `frontend/app/sprints/[id]/page.tsx`, `frontend/app/resources/page.tsx` — wrap content with `DashboardShell` and remove their own back buttons/title bars.
- Planning components: remove duplicate "Resource manager" / "Sprint planning" titles and back buttons since the shell already provides navigation context.

### Details

1. **DashboardShell props**
   - `children: React.ReactNode`
   - `activeSection?: string` — defaults to `"planning"` for planning pages; can also be used elsewhere.
   - Reuses existing `Header`, but Header expects dashboard filters/refresh. For planning pages we will:
     - Keep filters visible but no-op (they only apply to dashboard sections).
     - Keep refresh button as a page soft-refresh (`router.refresh()`).
   - Reuses `CommandMenu` so keyboard navigation still works.

2. **Planning page wrappers**
   - Convert `/sprints/page.tsx`, `/sprints/[id]/page.tsx`, `/resources/page.tsx` from full-page layouts to content panels inside `DashboardShell`.
   - Remove the standalone `min-h-screen bg-background p-6` wrappers and back arrows.
   - Keep content width `max-w-7xl` and padding inside the shell’s main area.

3. **Header adaptation**
   - The existing `Header` always shows `GlobalFilters`, critical/incident badges, refresh, etc. For planning pages these are harmless but slightly misleading.
   - Short-term: keep the existing Header exactly as-is to minimize changes. Filters and refresh are still useful.
   - Long-term (out of scope unless requested): add a mode prop to Header that hides dashboard-specific chrome when not on a dashboard section.

## Alternative considered
Make planning a dashboard section rendered inside `DashboardClient` (like Product, Engineering, etc.). This would require routing via `?section=planning` and merging planning state into the dashboard data model. Rejected because planning needs its own URL space (`/sprints`, `/sprints/[id]`, `/resources`) per the task spec and deep-linking requirements.

## Validation
- `npm run build` passes.
- Clicking "Planning" in the sidebar keeps the sidebar and header visible.
- Navigating between `/sprints`, `/sprints/1`, and `/resources` keeps the shell.
- Mobile nav and command menu still work.
