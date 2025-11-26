# Dashboard Redesign Guide
_Converting our current admin dashboard to the “Academy Dashboard” layout_

---

## 1. Goals of the Redesign

We want our admin dashboard to look and feel like the attached “Academy” dashboard:

- Clean, bright, minimal UI
- Strong visual hierarchy: metrics → charts → tables
- Fixed left sidebar + top navigation bar
- Card-based layout with consistent spacing and rounded corners
- Modern icons, soft colors, clear typography

This document explains **how to rebuild our existing dashboard** into this layout using our stack (React/Next.js, Tailwind, shadcn/ui, Recharts or similar).

---

## 2. High-Level Anatomy of the Target Dashboard

From top to bottom and left to right, the page is structured as follows:

1. **Global Shell**
  - **Left**: Vertical sidebar with logo, main sections, grouped menus.
  - **Top**: Horizontal topbar (search, quick actions, user profile).
  - **Main content**: Card grid.

2. **Row 1 – KPI Cards**
  - 5 small cards (“Students”, “Teachers”, “Parents”, “Earnings”, “Awards”).
  - Each card shows: label, main value, small change indicator (“24.24% ↑ Since last week”), and an icon badge.

3. **Row 2 – Charts + Right Panel**
  - **Left (2/3 width)**: “Performance” area chart with two series (This Week vs Last Week) and legend.
  - **Right (1/3 width)**: “Upcoming Live Sessions” card with:
    - Title, small “Live” tag
    - 2–3 info rows (date, duration, instructor), each with icon
    - CTA button (“Join the Session”)
    - Illustration on the right side.

4. **Row 3 – Tables / Additional Charts**
  - **Left (2/3 width)**: “All Courses” table (columns: #, Course Name, Category, Duration, Price, Status, Action).
  - **Right (1/3 width)**: “Course Schedule” stacked bar chart.

All blocks are white cards on a very light gray background.

---

## 3. Design System Foundation

Before touching components, we need to standardize the design tokens so the whole app keeps the same look.

### 3.1 Colors

Use a **light theme**:

- **Background**
  - `body`: `#F5F7FB` (light gray/blue)
- **Cards / Surfaces**
  - `card`: `#FFFFFF`
- **Text**
  - `text-primary`: `#111827`
  - `text-secondary`: `#6B7280`
- **Borders**
  - `border-subtle`: `#E5E7EB`
- **Accent colors** (examples, adjust to our brand):
  - Blue: `#2563EB`
  - Green: `#16A34A`
  - Orange: `#F97316`
  - Yellow: `#FACC15`
  - Red: `#EF4444`
- **Status Pills**
  - Available: soft green background + green text
  - Limited: soft yellow background + yellow/dark text

Implementation:

- Define them as **Tailwind theme extensions** or a **`theme.ts` tokens file**.
- Ensure all new components use these tokens, not arbitrary hex codes.

### 3.2 Typography

- Base font: System or Inter (recommended).
- Sizes:
  - Page title: `text-2xl` / `font-semibold`
  - Section title: `text-lg` / `font-semibold`
  - Card label: `text-sm` / `font-medium`
  - KPI number: `text-2xl` / `font-semibold`
  - Table text: `text-sm`
- Line-height: slightly relaxed (`leading-5/6`) for readability.

### 3.3 Spacing & Radii

- Spacing scale:
  - Card padding: `p-4` (small cards), `p-5` or `p-6` (large sections).
  - Gap between cards: `gap-4`.
  - Section vertical spacing: `space-y-6`.
- Radius:
  - Cards: `rounded-xl` or `rounded-2xl`.
  - Icon badges: `rounded-full`.

### 3.4 Shadows

- Soft, consistent shadows:
  - Example: `shadow-sm` or custom `shadow-[0_10px_30px_rgba(15,23,42,0.05)]`.

---

## 4. Layout Structure & Implementation

### 4.1 Page Layout Skeleton

Create a reusable **`DashboardLayout`** component:

```tsx
// components/layouts/DashboardLayout.tsx
export default function DashboardLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-white">
        {/* Logo + nav here */}
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-200 bg-white">
          {/* Left: breadcrumbs / page title, right: search + icons + profile */}
        </header>

        {/* Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
