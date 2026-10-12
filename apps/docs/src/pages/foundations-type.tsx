import { vars } from '@jfrader/tokens/vars';

const sizes = Object.entries(vars.textSize as unknown as Record<string, string>);
const weights = Object.entries(vars.fontWeight as unknown as Record<string, string>);
const families = Object.entries((vars as unknown as { font?: Record<string, string> }).font ?? {});

export function TypePage() {
  return (
    <>
      <div className="crumb">Foundations / Typography</div>
      <h1>Typography</h1>
      <p className="lede">
        The type scale and weights components read from the token source. Sizes are shown at their real value, so this
        page is a specimen, not a screenshot.
      </p>

      {families.length > 0 ? (
        <>
          <h2>Family</h2>
          {families.map(([name, reference]) => (
            <div className="scale-row" key={name}>
              <span className="meta">
                {name} · {reference}
              </span>
              <span style={{ fontFamily: reference, fontSize: '20px' }}>jfrader/ui — the quick brown fox jumps over the lazy dog</span>
            </div>
          ))}
        </>
      ) : null}

      <h2>Scale</h2>
      {sizes.map(([name, reference]) => (
        <div className="scale-row" key={name}>
          <span className="meta">
            {name} · {reference}
          </span>
          <span style={{ fontSize: reference }}>Save changes · 0123456789</span>
        </div>
      ))}

      <h2>Weights</h2>
      {weights.map(([name, reference]) => (
        <div className="scale-row" key={name}>
          <span className="meta">
            {name} · {reference}
          </span>
          <span style={{ fontWeight: reference as unknown as number, fontSize: '18px' }}>
            jfrader/ui documentation
          </span>
        </div>
      ))}

      <h2>Rules</h2>
      <ul>
        <li>Line-height and size pair up through tokens; components never set raw <code>font-size</code> values.</li>
        <li>Numbers that change live (counters, timers, sliders) use tabular figures so they do not jitter.</li>
      </ul>
    </>
  );
}
