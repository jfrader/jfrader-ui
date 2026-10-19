import { PERSON_ART_COLORS } from '@jfrader/tokens';

export function StaffArt({ accent }: { accent: string }) {
  return (
    <>
      <path d="M6 48V42H10V39H15V36H33V39H38V42H42V48Z" fill={PERSON_ART_COLORS.staffJacket} />
      <rect x="6" y="42" width="8" height="6" fill={PERSON_ART_COLORS.staffJacket} />
      <rect x="34" y="42" width="8" height="6" fill={PERSON_ART_COLORS.staffJacket} />
      <path d="M18 36H30V48H18Z" fill={PERSON_ART_COLORS.staffShirt} />
      <path d="M15 36H21L24 41L19 48H14V39Z" fill={PERSON_ART_COLORS.staffLapel} />
      <path d="M27 36H33L34 39V48H29L24 41Z" fill={PERSON_ART_COLORS.staffLapel} />
      <rect x="23" y="37" width="2" height="3" fill={accent} />
      <path d="M22 40H26L25 47H23Z" fill={accent} />
      <rect x="15" y="36" width="18" height="1" fill={PERSON_ART_COLORS.glint} opacity="0.12" />
    </>
  );
}
