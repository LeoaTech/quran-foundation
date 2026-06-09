# Mobile Responsive Design Guide

## Overview

The Quran Foundation LMS frontend has been updated with comprehensive mobile
responsiveness across all screen sizes. This guide documents the responsive
design system and best practices.

## Breakpoints

The following breakpoints are used throughout the application:

| Breakpoint  | Screen Size    | Device                    |
| ----------- | -------------- | ------------------------- |
| **Mobile**  | < 640px        | Small phones, portrait    |
| **Tablet**  | 640px - 1024px | Tablets, landscape phones |
| **Desktop** | > 1024px       | Desktops, large screens   |

### CSS Media Queries

```css
/* Mobile-first approach */
@media (max-width: 640px) {
  /* Mobile styles */
}
@media (max-width: 768px) {
  /* Tablet styles */
}
@media (max-width: 1024px) {
  /* Large devices */
}
```

## Layout Components

### Sidebar Navigation

- **Desktop (> 640px)**: Fixed sidebar (220px wide)
- **Tablet (640px - 1024px)**: Fixed sidebar (280px wide)
- **Mobile (< 640px)**: Collapsible sidebar with hamburger menu, full-width
  overlay

**Features:**

- Hamburger menu button appears on mobile
- Sidebar slides in/out with animation
- Overlay click closes sidebar
- Sidebar auto-closes on route navigation
- Mobile overlay semi-transparent backdrop

### Top Bar

- Adaptive padding (28px → 16px on mobile)
- Hamburger button positioned on mobile (left of title)
- Title font size reduces on mobile (16px → 14px)
- Badge remains visible but optimized for space

### Content Area

- **Desktop**: 28px padding
- **Tablet**: 20px padding
- **Mobile**: 16px padding

## Grid Layouts

### Responsive Grid Classes

```html
<!-- 2-column grid that stacks on mobile -->
<div class="two-col">...</div>
<!-- Stacks to 1 column on tablets and mobiles -->

<!-- 3-column grid that adapts -->
<div class="three-col">...</div>
<!-- 3 cols (desktop) → 2 cols (tablet) → 1 col (mobile) -->

<!-- 60/40 split that stacks on mobile -->
<div class="col-63">...</div>
<!-- Stacks to 1 column on tablets and mobiles -->
```

### Metrics Grid

```css
.metrics-grid.cols-4
  Desktop: 4 columns
  Tablet: 2 columns
  Mobile: 1 column

.metrics-grid.cols-3
  Desktop: 3 columns
  Tablet: 2 columns
  Mobile: 1 column
```

## Card Components

### Card Responsive Padding

| Breakpoint | Padding |
| ---------- | ------- |
| Desktop    | 20px    |
| Tablet     | 16px    |
| Mobile     | 14px    |

**Best Practices:**

- Cards use `.card-header`, `.card-body` classes for automatic responsive
  padding
- Content wraps flexibly inside cards
- Card titles adjust font size on mobile

### Metric Cards

- **Desktop**: 32px font for values, 20px padding
- **Tablet**: 24px font for values, 16px padding
- **Mobile**: 20px font for values, 14px padding

## Tables

### Table Responsiveness

Tables use `.table-wrapper` class for horizontal scrolling on mobile:

```html
<div class="table-wrapper">
  <table class="tbl">
    ...
  </table>
</div>
```

**Features:**

- Horizontal scroll on small screens (never truncate)
- Reduced font sizes on mobile (13px → 12px → 11px)
- Compressed padding for density

**Future Enhancement:**

- Consider card-based table view on mobile (priority columns only)
- Stack rows as expandable cards with full details

## Forms

### Form Layouts

```css
.form-grid.cols-2
  Desktop: 2 columns
  Tablet & Mobile: 1 column (stacks vertically)
```

**Input Sizing:**

- Font reduces: 13px → 12px → 11px
- Padding reduces: 10px → 9px → 8px
- Full-width on mobile

### Form Groups

- Labels always stack above inputs
- Inputs expand to fill width on mobile
- 2-column field rows become single column on tablets

## Authentication Screen

- **Desktop**: Left panel (42% blue) + Right panel (58% white form)
- **Tablet**: Stacked vertically (blue panel on top)
- **Mobile**: Full-screen, blue panel hidden (logo at top)

**Mobile Features:**

- Responsive typography (28px → 20px headline)
- Field row becomes single column
- Tab navigation text size reduces
- Full-width form inputs

## Typography

### Responsive Font Sizes

| Element      | Desktop | Tablet | Mobile |
| ------------ | ------- | ------ | ------ |
| Page H2      | 26px    | 22px   | 18px   |
| Card Title   | 14px    | 13px   | 13px   |
| Body Text    | 13px    | 12px   | 11px   |
| Labels       | 12px    | 11px   | 11px   |
| Metric Value | 32px    | 24px   | 20px   |

## Navigation

### Attendance Grid

- **Desktop**: 150px name + 7 day columns
- **Tablet (768px)**: 120px name + 5 day columns
- **Mobile (640px)**: 80px name + 4 day columns

Font size progressively reduces: 12px → 10px → 9px

## Buttons

### Button Sizing

| Breakpoint | Padding  | Font Size |
| ---------- | -------- | --------- |
| Desktop    | 9px 18px | 13px      |
| Tablet     | 8px 16px | 12px      |
| Mobile     | 8px 14px | 11px      |

## Modal Dialogs

### Modal Responsiveness

- **Desktop**: Centered, max-width based on size (sm/md/lg)
- **Tablet**: Centered, slightly reduced
- **Mobile**: Full-screen slide-up from bottom

**Mobile Features:**

- No border radius (fits screen edge)
- Zero padding on sides (full-width)
- Positioned at bottom (slide-up animation)
- Close button more accessible
- Reduced header padding

## Accessibility Features

- Hamburger button has `aria-label="Toggle navigation"`
- Proper semantic HTML maintained
- Touch targets remain > 44px on mobile
- Color contrast maintained across all breakpoints
- Keyboard navigation preserved

## Performance Considerations

### Viewport Meta Tag

Already included in `index.html`:

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1"
/>
```

### CSS Optimizations

- Media queries organized by breakpoint
- No layout shifts on breakpoint changes
- Transitions smooth between sizes
- Mobile-first CSS approach

## Utility Classes

### Responsive Display

```css
.show-mobile   /* Only on mobile */
.hide-mobile   /* Hidden on mobile, shown on desktop */
```

### Responsive Spacing

```css
.gap-16  /* Adjusts gap based on breakpoint */
.gap-20  /* Adjusts gap based on breakpoint */
.p-16    /* Adjusts padding based on breakpoint */
.p-20    /* Adjusts padding based on breakpoint */
.px-20   /* Adjusts horizontal padding */
```

## Testing Checklist

### Mobile (640px and below)

- [ ] Sidebar toggles with hamburger menu
- [ ] Overlay appears and closes sidebar
- [ ] All grids stack to single column
- [ ] Tables scroll horizontally
- [ ] Forms stack vertically
- [ ] Text remains readable
- [ ] Touch targets are adequate (> 44px)

### Tablet (641px - 1024px)

- [ ] Sidebar remains visible
- [ ] Grids adapt (2 columns where applicable)
- [ ] Attendance grid shows 5 days
- [ ] Forms show 2 columns
- [ ] Spacing is comfortable

### Desktop (1024px+)

- [ ] Full layout displays
- [ ] All grids at full width
- [ ] 4-column metric grids
- [ ] Full attendance week display
- [ ] Maximum information density

## Development Guidelines

### When Adding New Components

1. **Use Responsive Classes**
   - Prefer CSS classes over inline media queries
   - Add responsive versions to globals.css

2. **Follow Breakpoint System**
   - Use defined breakpoints (640px, 768px, 1024px)
   - Start with mobile styles, add desktop enhancements

3. **Test Across Devices**
   - Test on real devices when possible
   - Use Chrome DevTools for quick testing
   - Check landscape/portrait orientations

4. **Maintain Consistency**
   - Follow existing padding/spacing patterns
   - Use design tokens for colors and spacing
   - Keep component sizing proportional

### Component Template

```javascript
import { useState, useEffect } from "react";

export default function ResponsiveComponent() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      style={{
        padding: isMobile ? 16 : 28,
        flexDirection: isMobile ? "column" : "row"
      }}
    >
      {/* Content */}
    </div>
  );
}
```

## Common Patterns

### Stacking Layout

```javascript
// Desktop: side-by-side, Mobile: stacked
<div style={{
  display: 'flex',
  flexDirection: isMobile ? 'column' : 'row',
  gap: isMobile ? 12 : 16,
}}>
```

### Conditional Display

```javascript
{
  !isMobile && <DesktopOnlyFeature />;
}
{
  isMobile && <MobileOnlyFeature />;
}
```

### Responsive Grid

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}
```

## Resources

- **CSS Variables**: See `styles/tokens.css` for design tokens
- **Global Styles**: See `styles/globals.css` for responsive classes
- **Layout**: See `layouts/AppShell.jsx` for responsive navigation
- **Components**: See `components/` for responsive component examples

## Future Enhancements

1. **Progressive Image Loading** - Optimize images for mobile
2. **Touch Gestures** - Swipe to navigate sidebar on mobile
3. **Mobile Tables** - Card-based table view for small screens
4. **Landscape Support** - Handle landscape orientation on tablets
5. **Print Styles** - Enhance print media queries
6. **Dark Mode** - Already supported, ensure responsive in dark mode

---

**Last Updated**: June 2026 **Version**: 1.0
