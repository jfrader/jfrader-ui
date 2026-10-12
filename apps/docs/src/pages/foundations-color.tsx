import { vars } from '@jfrader/tokens/vars';

/** Straight from the published token source: add a role to tokens.ts and it appears here. */
const roles = Object.entries(vars.color as unknown as Record<string, string>).sort(([a], [b]) =>
  a.localeCompare(b),
);

export function ColorPage() {
  return (
    <>
      <div className="crumb">Foundations / Color</div>
      <h1>Color</h1>
      <p className="lede">
        {roles.length} color roles, read live from <code>@jfrader/tokens/vars</code>. Dark is the base palette and light
        overrides sit beside it — the toggle in the header switches <code>data-theme</code>, and every swatch below
        follows, exactly as components do.
      </p>

      <h2>Roles</h2>
      <div className="swatches">
        {roles.map(([role, reference]) => (
          <div className="sw" key={role}>
            <div className="c" style={{ background: reference }} />
            <div className="n">
              <b>{role}</b>
              {reference}
            </div>
          </div>
        ))}
      </div>

      <h2>Rules</h2>
      <ul>
        <li>Components never pick a theme: they read these roles and the app sets <code>data-theme</code> (or wraps a subtree in <code>ThemeRoot</code>).</li>
        <li>Control boundaries use <code>borderControl</code> and hold ≥3:1 against the page and the control interior (WCAG 1.4.11).</li>
        <li>Raw hex values are forbidden outside the token package — this page is the only place that shows them.</li>
        <li>State is never signalled by color alone; tones are paired with glyphs, text or outlines.</li>
      </ul>
    </>
  );
}
