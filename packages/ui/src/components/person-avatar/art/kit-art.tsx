import { PERSON_ART_COLORS } from '@jfrader/tokens';
import type { PersonAvatarKit, PersonShirtPattern, PersonShortsPattern, PersonSocksPattern } from '../kit';

const AVATAR_OUTLINE = PERSON_ART_COLORS.outline;

export function ShirtPatternArt({ pattern, secondary }: { pattern: PersonShirtPattern; secondary: string }) {
  if (pattern === "solid") return null;

  if (pattern === "split") {
    return <rect x="24" y="36" width="14" height="12" fill={secondary} />;
  }

  if (pattern === "hoops") {
    return (
      <g>
        <rect x="10" y="39" width="28" height="3" fill={secondary} />
        <rect x="8" y="46" width="32" height="2" fill={secondary} />
      </g>
    );
  }

  if (pattern === "shoulders") {
    return (
      <g>
        <rect x="10" y="35" width="28" height="4" fill={secondary} />
        <rect x="7" y="38" width="7" height="3" fill={secondary} />
        <rect x="34" y="38" width="7" height="3" fill={secondary} />
      </g>
    );
  }

  return <rect x="21" y="36" width="6" height="12" fill={secondary} />;
}

export function ShortsPatternArt({ pattern, accent }: { pattern: PersonShortsPattern; accent: string }) {
  if (pattern === "sideStripe") {
    return (
      <>
        <rect x="15" y="49" width="2" height="5" fill={accent} />
        <rect x="31" y="49" width="2" height="5" fill={accent} />
      </>
    );
  }
  if (pattern === "split") return <rect x="24" y="49" width="9" height="5" fill={accent} />;
  if (pattern === "waistBand") return <rect x="15" y="49" width="18" height="2" fill={accent} />;
  return null;
}

export function SocksPatternArt({ pattern, accent }: { pattern: PersonSocksPattern; accent: string }) {
  if (pattern !== 'turnover') return null;
  return (
    <>
      <rect x="17" y="54" width="4" height="2" fill={accent} />
      <rect x="27" y="54" width="4" height="2" fill={accent} />
    </>
  );
}

export function KitArt({ kit, fullKit }: { kit: PersonAvatarKit; fullKit: boolean }) {
  const { shirt, accent: shirtAccent, shirtPattern, shorts, shortsAccent, shortsPattern, socks, socksAccent, socksPattern } = kit;
  return <>
    <path
      d={
        fullKit
          ? "M6 47V42H10V39H15V36H33V39H38V42H42V47H33V49H15V47Z"
          : "M6 48V42H10V39H15V36H33V39H38V42H42V48Z"
      }
      fill={shirt}
    />
    <rect x="6" y="42" width="8" height={fullKit ? 5 : 6} fill={shirtAccent} />
    <rect x="34" y="42" width="8" height={fullKit ? 5 : 6} fill={shirtAccent} />
    <ShirtPatternArt pattern={shirtPattern} secondary={shirtAccent} />
    <rect x="14" y="36" width="20" height="2" fill={PERSON_ART_COLORS.glint} opacity="0.16" />
    {fullKit && (
      <>
        <rect x="13" y="48" width="22" height="7" fill={AVATAR_OUTLINE} />
        <rect x="15" y="49" width="18" height="5" fill={shorts} />
        <ShortsPatternArt pattern={shortsPattern} accent={shortsAccent} />
        <rect x="15" y="54" width="7" height="6" fill={AVATAR_OUTLINE} />
        <rect x="26" y="54" width="7" height="6" fill={AVATAR_OUTLINE} />
        <rect x="17" y="54" width="4" height="4" fill={socks} />
        <rect x="27" y="54" width="4" height="4" fill={socks} />
        <SocksPatternArt pattern={socksPattern} accent={socksAccent} />
        <rect x="14" y="58" width="8" height="2" fill={AVATAR_OUTLINE} />
        <rect x="26" y="58" width="8" height="2" fill={AVATAR_OUTLINE} />
      </>
    )}
  </>;
}
