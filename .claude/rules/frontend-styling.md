# Frontend Styling Rule — No Inline Styles

Frontend UI code must keep styling out of JSX. Inline styles make the React tree noisy, hard to reuse, and painful to theme. Components describe structure and behavior; styles live in the styling layer.

## Rule

- Do **not** add `style={...}` or `style={{ ... }}` in `apps/frontend` React components.
- Use class names and shared styles instead.
- Default styling home: global SCSS/CSS under `apps/frontend/src/styles/`.
- Prefer semantic, reusable class names over one-off component-local styling.
- If touching a component that already has inline styles, move the styles you touch into the shared stylesheet instead of adding more inline styles.

## Tailwind proposal

Tailwind is acceptable as a future styling layer if we intentionally add it to the frontend toolchain and document the decision first. Until Tailwind is configured in this repo, do **not** use Tailwind utility classes as if they were active styling.

If Tailwind is adopted later:

- Keep design tokens and repeated layout patterns centralized.
- Avoid unreadable class soup for complex components; extract reusable component classes or small presentational components.
- Keep global SCSS for base styles, app shell layout, and styles that are clearer as named rules than utilities.

## Exceptions

Inline styles are allowed only for values that are genuinely runtime-computed and cannot be expressed cleanly through classes or CSS custom properties. Prefer setting a CSS variable and consuming it from SCSS when possible.

Example allowed only when justified:

```tsx
<div className="progress" style={{ '--progress': `${percentage}%` } as React.CSSProperties} />
```

If you need an exception, leave a short comment explaining why the value must stay inline.
