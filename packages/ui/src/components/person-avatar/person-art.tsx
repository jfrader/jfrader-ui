import { PERSON_ART_COLORS } from '@jfrader/tokens';
import type { PersonAppearance } from './appearance';
import type { PersonAvatarAttire, PersonAvatarKit } from './kit';
import { KitArt } from './art/kit-art';
import { StaffArt } from './art/staff-art';
import {
  PERSON_EYE_COLORS,
  PERSON_HAIR_COLORS,
  PERSON_SKIN_TONES,
  type PersonAccessory,
  type PersonBrowStyle,
  type PersonEyeStyle,
  type PersonFaceShape,
  type PersonFacialHairStyle,
  type PersonHairStyle,
  type PersonMarking,
  type PersonMouthStyle,
  type PersonNoseStyle,
} from './appearance';
type SkinPalette = (typeof PERSON_SKIN_TONES)[keyof typeof PERSON_SKIN_TONES];
type EyePalette = (typeof PERSON_EYE_COLORS)[keyof typeof PERSON_EYE_COLORS];

const AVATAR_OUTLINE = PERSON_ART_COLORS.outline;
const AVATAR_EYE = PERSON_ART_COLORS.pupil;
const AVATAR_EYE_WHITE = PERSON_ART_COLORS.eyeWhite;
const AVATAR_MOUTH = PERSON_ART_COLORS.mouth;

function Hair({ style, base, highlight }: { style: PersonHairStyle; base: string; highlight: string }) {
  let shape;

  if (style === "bald") {
    shape = (
      <>
        <rect x="16" y="7" width="16" height="2" fill={base} opacity="0.14" />
        <rect x="15" y="9" width="3" height="3" fill={base} opacity="0.16" />
        <rect x="30" y="9" width="3" height="3" fill={base} opacity="0.16" />
        <rect x="20" y="6" width="7" height="1" fill={PERSON_ART_COLORS.glint} opacity="0.12" />
        <rect x="17" y="8" width="2" height="1" fill={highlight} opacity="0.12" />
        <rect x="29" y="8" width="2" height="1" fill={highlight} opacity="0.12" />
      </>
    );
  } else if (style === "undercut") {
    shape = (
      <>
        <rect x="14" y="3" width="20" height="7" fill={base} />
        <rect x="14" y="9" width="3" height="2" fill={base} opacity="0.25" />
        <rect x="31" y="9" width="3" height="2" fill={base} opacity="0.25" />
        <rect x="16" y="3" width="14" height="2" fill={highlight} />
        <rect x="16" y="9" width="14" height="1" fill={highlight} opacity="0.5" />
      </>
    );
  } else if (style === "curtains") {
    shape = (
      <>
        <rect x="14" y="4" width="20" height="5" fill={base} />
        <rect x="13" y="7" width="4" height="9" fill={base} />
        <rect x="31" y="7" width="4" height="8" fill={base} />
        <rect x="16" y="9" width="4" height="4" fill={base} />
        <rect x="28" y="9" width="4" height="4" fill={base} />
        <rect x="22" y="4" width="4" height="2" fill={highlight} />
        <rect x="16" y="9" width="2" height="3" fill={highlight} />
      </>
    );
  } else if (style === "mohawk") {
    shape = (
      <>
        <rect x="21" y="1" width="6" height="11" fill={base} />
        <rect x="16" y="8" width="16" height="3" fill={base} opacity="0.22" />
        <rect x="22" y="2" width="4" height="3" fill={highlight} />
        <rect x="21" y="6" width="2" height="2" fill={highlight} opacity="0.6" />
      </>
    );
  } else if (style === "mullet") {
    shape = (
      <>
        <rect x="15" y="5" width="18" height="5" fill={base} />
        <rect x="12" y="9" width="4" height="18" fill={base} />
        <rect x="32" y="9" width="4" height="18" fill={base} />
        <rect x="14" y="25" width="20" height="4" fill={base} opacity="0.3" />
        <rect x="19" y="4" width="12" height="2" fill={highlight} />
        <rect x="13" y="14" width="2" height="8" fill={highlight} opacity="0.6" />
      </>
    );
  } else if (style === "ponytail") {
    shape = (
      <>
        <rect x="14" y="5" width="20" height="6" fill={base} />
        <rect x="13" y="8" width="3" height="7" fill={base} />
        <rect x="32" y="8" width="3" height="7" fill={base} />
        <rect x="34" y="12" width="4" height="10" fill={base} />
        <rect x="35" y="20" width="3" height="4" fill={base} />
        <rect x="18" y="5" width="13" height="2" fill={highlight} />
        <rect x="35" y="14" width="2" height="6" fill={highlight} opacity="0.7" />
      </>
    );
  } else if (style === "topKnot") {
    shape = (
      <>
        <rect x="20" y="0" width="8" height="5" fill={base} />
        <rect x="22" y="4" width="4" height="2" fill={base} />
        <rect x="15" y="5" width="18" height="6" fill={base} />
        <rect x="13" y="8" width="4" height="6" fill={base} />
        <rect x="31" y="8" width="4" height="5" fill={base} />
        <rect x="21" y="1" width="5" height="2" fill={highlight} />
        <rect x="18" y="6" width="10" height="1" fill={highlight} opacity="0.7" />
      </>
    );
  } else if (style === "braids") {
    shape = (
      <>
        <rect x="14" y="4" width="20" height="8" fill={base} />
        <rect x="13" y="8" width="4" height="7" fill={base} />
        <rect x="31" y="8" width="4" height="6" fill={base} />
        <rect x="16" y="4" width="2" height="8" fill={highlight} />
        <rect x="20" y="4" width="2" height="8" fill={highlight} />
        <rect x="24" y="4" width="2" height="8" fill={highlight} />
        <rect x="28" y="4" width="2" height="8" fill={highlight} />
      </>
    );
  } else if (style === "dreadlocks") {
    shape = (
      <>
        <rect x="13" y="3" width="22" height="8" fill={base} />
        <rect x="12" y="8" width="4" height="14" fill={base} />
        <rect x="32" y="8" width="4" height="14" fill={base} />
        <rect x="12" y="20" width="3" height="6" fill={base} />
        <rect x="33" y="20" width="3" height="5" fill={base} />
        <rect x="15" y="4" width="2" height="4" fill={highlight} />
        <rect x="22" y="3" width="2" height="5" fill={highlight} />
        <rect x="29" y="4" width="2" height="4" fill={highlight} />
        <rect x="13" y="13" width="2" height="6" fill={highlight} opacity="0.6" />
      </>
    );
  } else if (style === "buzz") {
    shape = (
      <>
        <rect x="15" y="8" width="18" height="3" fill={base} />
        <rect x="14" y="9" width="2" height="3" fill={base} />
        <rect x="32" y="9" width="2" height="3" fill={base} />
        <rect x="18" y="7" width="11" height="1" fill={base} opacity="0.6" />
        <rect x="20" y="8" width="2" height="1" fill={highlight} opacity="0.4" />
        <rect x="27" y="8" width="2" height="1" fill={highlight} opacity="0.4" />
      </>
    );
  } else if (style === "crewCut") {
    shape = (
      <>
        <rect x="14" y="6" width="20" height="5" fill={base} />
        <rect x="18" y="3" width="12" height="4" fill={base} />
        <rect x="13" y="8" width="3" height="5" fill={base} />
        <rect x="32" y="8" width="3" height="5" fill={base} />
        <rect x="19" y="3" width="10" height="1" fill={highlight} />
        <rect x="16" y="6" width="14" height="1" fill={highlight} opacity="0.5" />
      </>
    );
  } else if (style === "sidePart") {
    shape = (
      <>
        <rect x="14" y="5" width="20" height="5" fill={base} />
        <rect x="13" y="6" width="5" height="6" fill={base} />
        <rect x="17" y="5" width="2" height="4" fill={highlight} />
        <rect x="20" y="4" width="14" height="2" fill={highlight} />
        <rect x="28" y="6" width="6" height="1" fill={highlight} />
      </>
    );
  } else if (style === "slickBack") {
    shape = (
      <>
        <rect x="14" y="5" width="20" height="6" fill={base} />
        <rect x="13" y="8" width="4" height="7" fill={base} />
        <rect x="31" y="7" width="4" height="6" fill={base} />
        <rect x="19" y="4" width="15" height="2" fill={highlight} />
        <rect x="27" y="6" width="7" height="1" fill={highlight} />
      </>
    );
  } else if (style === "curls") {
    shape = (
      <>
        <rect x="13" y="5" width="22" height="7" fill={base} />
        <rect x="14" y="3" width="6" height="5" fill={base} />
        <rect x="20" y="1" width="8" height="6" fill={base} />
        <rect x="27" y="2" width="7" height="6" fill={base} />
        <rect x="16" y="4" width="3" height="1" fill={highlight} />
        <rect x="23" y="2" width="3" height="2" fill={highlight} />
        <rect x="29" y="3" width="2" height="1" fill={highlight} />
      </>
    );
  } else if (style === "afro") {
    shape = (
      <>
        <rect x="12" y="4" width="24" height="9" fill={base} />
        <rect x="15" y="1" width="18" height="5" fill={base} />
        <rect x="11" y="7" width="4" height="10" fill={base} />
        <rect x="33" y="7" width="4" height="10" fill={base} />
        <rect x="15" y="3" width="5" height="3" fill={highlight} />
        <rect x="22" y="1" width="5" height="2" fill={highlight} />
      </>
    );
  } else if (style === "highTop") {
    shape = (
      <>
        <rect x="15" y="1" width="18" height="11" fill={base} />
        <rect x="13" y="7" width="4" height="8" fill={base} />
        <rect x="18" y="2" width="12" height="2" fill={highlight} />
        <rect x="16" y="5" width="3" height="4" fill={highlight} />
      </>
    );
  } else if (style === "fade") {
    shape = (
      <>
        <rect x="15" y="5" width="18" height="5" fill={base} />
        <rect x="13" y="8" width="2" height="4" fill={base} opacity="0.3" />
        <rect x="33" y="8" width="2" height="4" fill={base} opacity="0.3" />
        <rect x="15" y="9" width="2" height="2" fill={base} opacity="0.55" />
        <rect x="31" y="9" width="2" height="2" fill={base} opacity="0.55" />
        <rect x="17" y="10" width="2" height="1" fill={base} opacity="0.7" />
        <rect x="29" y="10" width="2" height="1" fill={base} opacity="0.7" />
        <rect x="18" y="5" width="11" height="1" fill={highlight} />
      </>
    );
  } else if (style === "quiff") {
    shape = (
      <>
        <rect x="14" y="7" width="20" height="5" fill={base} />
        <rect x="13" y="9" width="4" height="5" fill={base} />
        <rect x="18" y="3" width="15" height="6" fill={base} />
        <rect x="27" y="0" width="8" height="5" fill={base} />
        <rect x="20" y="3" width="12" height="2" fill={highlight} />
        <rect x="16" y="7" width="2" height="1" fill={highlight} />
      </>
    );
  } else if (style === "long") {
    shape = (
      <>
        <rect x="13" y="4" width="22" height="7" fill={base} />
        <rect x="11" y="8" width="5" height="18" fill={base} />
        <rect x="32" y="8" width="5" height="18" fill={base} />
        <rect x="15" y="4" width="14" height="2" fill={highlight} />
        <rect x="12" y="11" width="2" height="9" fill={highlight} />
      </>
    );
  } else if (style === "receding") {
    shape = (
      <>
        <rect x="13" y="9" width="4" height="5" fill={base} />
        <rect x="31" y="9" width="4" height="5" fill={base} />
        <rect x="17" y="6" width="4" height="4" fill={base} />
        <rect x="27" y="6" width="4" height="4" fill={base} />
        <rect x="15" y="10" width="2" height="3" fill={highlight} opacity="0.6" />
        <rect x="19" y="6" width="2" height="2" fill={highlight} opacity="0.5" />
        <rect x="29" y="6" width="2" height="2" fill={highlight} opacity="0.5" />
      </>
    );
  } else if (style === "messy") {
    shape = (
      <>
        <rect x="13" y="4" width="22" height="7" fill={base} />
        <rect x="14" y="2" width="5" height="6" fill={base} />
        <rect x="20" y="1" width="7" height="6" fill={base} />
        <rect x="28" y="2" width="6" height="5" fill={base} />
        <rect x="12" y="8" width="4" height="6" fill={base} />
        <rect x="32" y="8" width="4" height="6" fill={base} />
        <rect x="16" y="3" width="3" height="2" fill={highlight} />
        <rect x="22" y="2" width="3" height="2" fill={highlight} />
        <rect x="29" y="3" width="2" height="1" fill={highlight} />
      </>
    );
  } else if (style === "spiky") {
    shape = (
      <>
        <rect x="14" y="6" width="20" height="5" fill={base} />
        <rect x="13" y="9" width="4" height="4" fill={base} />
        <rect x="31" y="9" width="4" height="4" fill={base} />
        <rect x="17" y="3" width="3" height="5" fill={base} />
        <rect x="21" y="1" width="2" height="6" fill={base} />
        <rect x="25" y="2" width="3" height="5" fill={base} />
        <rect x="29" y="4" width="2" height="4" fill={base} />
        <rect x="18" y="4" width="2" height="1" fill={highlight} />
        <rect x="22" y="2" width="1" height="1" fill={highlight} />
        <rect x="26" y="3" width="1" height="1" fill={highlight} />
      </>
    );
  } else if (style === "flatTop") {
    shape = (
      <>
        <rect x="17" y="1" width="14" height="3" fill={base} />
        <rect x="15" y="3" width="18" height="7" fill={base} />
        <rect x="13" y="8" width="4" height="5" fill={base} />
        <rect x="31" y="8" width="4" height="5" fill={base} />
        <rect x="18" y="1" width="12" height="1" fill={highlight} />
        <rect x="17" y="5" width="14" height="1" fill={highlight} opacity="0.5" />
      </>
    );
  } else {
    shape = (
      <>
        <rect x="14" y="5" width="20" height="5" fill={base} />
        <rect x="13" y="8" width="3" height="4" fill={base} />
        <rect x="32" y="8" width="3" height="4" fill={base} />
        <rect x="18" y="4" width="12" height="2" fill={highlight} />
        <rect x="15" y="6" width="16" height="1" fill={highlight} opacity="0.5" />
      </>
    );
  }

  return (
    <g data-avatar-layer="hair" data-avatar-style={style}>
      {shape}
    </g>
  );
}

function Face({ shape, skin }: { shape: PersonFaceShape; skin: SkinPalette }) {
  const chin =
    shape === "square"
      ? { x: 17, width: 14, y: 30 }
      : shape === "round"
        ? { x: 18, width: 12, y: 29 }
        : shape === "long"
          ? { x: 20, width: 8, y: 31 }
          : shape === "diamond"
            ? { x: 21, width: 6, y: 30 }
            : shape === "heart"
              ? { x: 20, width: 8, y: 29 }
              : { x: 19, width: 10, y: 30 };

  const cheekWidth =
    shape === "square" ? 5 : shape === "round" ? 5 : shape === "long" ? 3 : shape === "diamond" ? 3 : 4;
  const cheekX = shape === "long" || shape === "diamond" ? 12 : 11;
  const cheekRightX = shape === "long" || shape === "diamond" ? 32 : 33;

  return (
    <g data-avatar-layer="face" data-avatar-style={shape}>
      <rect x="13" y="7" width="22" height="21" fill={AVATAR_OUTLINE} />
      <rect x="15" y="5" width="18" height="27" fill={AVATAR_OUTLINE} />
      <rect x={cheekX} y="16" width={cheekWidth} height="10" fill={AVATAR_OUTLINE} />
      <rect x={cheekRightX} y="16" width={cheekWidth} height="10" fill={AVATAR_OUTLINE} />
      <rect x={cheekX + 1} y="17" width={cheekWidth - 1} height="8" fill={skin.shadow} />
      <rect x={cheekRightX + 1} y="17" width={cheekWidth - 1} height="8" fill={skin.shadow} />
      <rect x="13" y="19" width="2" height="4" fill={skin.base} />
      <rect x="33" y="19" width="2" height="4" fill={skin.base} />
      <rect x="15" y="8" width="18" height="20" fill={skin.base} />
      <rect x="17" y="6" width="14" height="24" fill={skin.base} />
      <rect x={chin.x} y={chin.y} width={chin.width} height="2" fill={skin.shadow} />
      <rect x="17" y="10" width="3" height={shape === "long" ? 14 : 13} fill={skin.highlight} />
      <rect x="29" y="10" width="2" height={shape === "long" ? 20 : 17} fill={skin.shadow} />
      <rect x="18" y="8" width="12" height="1" fill={skin.highlight} opacity="0.7" />
      <rect x="18" y="22" width="3" height="2" fill={skin.highlight} opacity="0.45" />
      {shape === "square" && (
        <>
          <rect x="14" y="28" width="3" height="3" fill={skin.shadow} />
          <rect x="31" y="28" width="3" height="3" fill={skin.shadow} />
          <rect x="17" y="31" width="14" height="1" fill={skin.shadow} opacity="0.6" />
        </>
      )}
      {shape === "round" && (
        <>
          <rect x="15" y="27" width="2" height="2" fill={skin.shadow} />
          <rect x="31" y="27" width="2" height="2" fill={skin.shadow} />
          <rect x="17" y="7" width="14" height="1" fill={skin.highlight} opacity="0.4" />
        </>
      )}
      {shape === "long" && (
        <>
          <rect x="14" y="27" width="2" height="3" fill={skin.shadow} />
          <rect x="32" y="27" width="2" height="3" fill={skin.shadow} />
        </>
      )}
      {shape === "diamond" && (
        <>
          <rect x="15" y="24" width="2" height="4" fill={skin.shadow} />
          <rect x="31" y="24" width="2" height="4" fill={skin.shadow} />
          <rect x="20" y="6" width="8" height="1" fill={skin.highlight} />
        </>
      )}
      {shape === "heart" && (
        <>
          <rect x="15" y="23" width="2" height="5" fill={skin.shadow} />
          <rect x="31" y="23" width="2" height="5" fill={skin.shadow} />
          <rect x="18" y="6" width="12" height="1" fill={skin.highlight} />
        </>
      )}
    </g>
  );
}

function Brows({ style, color }: { style: PersonBrowStyle; color: string }) {
  if (style === "arched") {
    return (
      <>
        <rect x="17" y="17" width="2" height="1" fill={color} />
        <rect x="19" y="16" width="3" height="1" fill={color} />
        <rect x="26" y="16" width="3" height="1" fill={color} />
        <rect x="29" y="17" width="2" height="1" fill={color} />
      </>
    );
  }
  if (style === "soft") {
    return (
      <>
        <rect x="18" y="17" width="4" height="1" fill={color} />
        <rect x="27" y="17" width="4" height="1" fill={color} />
      </>
    );
  }
  if (style === "angled") {
    return (
      <>
        <rect x="17" y="17" width="3" height="1" fill={color} />
        <rect x="20" y="16" width="2" height="1" fill={color} />
        <rect x="26" y="16" width="2" height="1" fill={color} />
        <rect x="28" y="17" width="3" height="1" fill={color} />
      </>
    );
  }
  if (style === "unibrow") {
    return (
      <>
        <rect x="17" y="16" width="14" height="1" fill={color} />
        <rect x="17" y="17" width="5" height="1" fill={color} />
        <rect x="26" y="17" width="5" height="1" fill={color} />
      </>
    );
  }
  const height = style === "thick" ? 2 : 1;
  return (
    <>
      <rect x="17" y="16" width="5" height={height} fill={color} />
      <rect x="26" y="16" width="5" height={height} fill={color} />
    </>
  );
}

function Eyes({ style, skin, iris }: { style: PersonEyeStyle; skin: SkinPalette; iris: EyePalette }) {
  if (style === "narrow") {
    return (
      <>
        <rect x="18" y="18" width="4" height="1" fill={skin.shadow} opacity="0.7" />
        <rect x="27" y="18" width="4" height="1" fill={skin.shadow} opacity="0.7" />
        <rect x="18" y="19" width="4" height="2" fill={AVATAR_EYE_WHITE} />
        <rect x="27" y="19" width="4" height="2" fill={AVATAR_EYE_WHITE} />
        <rect x="19" y="19" width="2" height="2" fill={iris.iris} />
        <rect x="28" y="19" width="2" height="2" fill={iris.iris} />
        <rect x="19" y="20" width="2" height="1" fill={AVATAR_EYE} />
        <rect x="28" y="20" width="2" height="1" fill={AVATAR_EYE} />
      </>
    );
  }
  if (style === "wide") {
    return (
      <>
        <rect x="17" y="18" width="4" height="1" fill={skin.shadow} opacity="0.6" />
        <rect x="27" y="18" width="4" height="1" fill={skin.shadow} opacity="0.6" />
        <rect x="17" y="19" width="4" height="3" fill={AVATAR_EYE_WHITE} />
        <rect x="27" y="19" width="4" height="3" fill={AVATAR_EYE_WHITE} />
        <rect x="18" y="19" width="3" height="3" fill={iris.light} />
        <rect x="27" y="19" width="3" height="3" fill={iris.light} />
        <rect x="19" y="20" width="2" height="2" fill={AVATAR_EYE} />
        <rect x="27" y="20" width="2" height="2" fill={AVATAR_EYE} />
        <rect x="18" y="20" width="1" height="1" fill={AVATAR_EYE_WHITE} />
        <rect x="29" y="20" width="1" height="1" fill={AVATAR_EYE_WHITE} />
      </>
    );
  }
  if (style === "downturned") {
    return (
      <>
        <rect x="18" y="19" width="1" height="1" fill={skin.shadow} />
        <rect x="30" y="19" width="1" height="1" fill={skin.shadow} />
        <rect x="18" y="20" width="3" height="2" fill={AVATAR_EYE_WHITE} />
        <rect x="28" y="20" width="3" height="2" fill={AVATAR_EYE_WHITE} />
        <rect x="19" y="20" width="2" height="2" fill={iris.iris} />
        <rect x="28" y="20" width="2" height="2" fill={iris.iris} />
        <rect x="19" y="21" width="1" height="1" fill={AVATAR_EYE} />
        <rect x="29" y="21" width="1" height="1" fill={AVATAR_EYE} />
      </>
    );
  }
  const top = style === "hooded" ? 20 : 19;
  return (
    <>
      {style === "hooded" && (
        <>
          <rect x="18" y="19" width="3" height="1" fill={skin.shadow} />
          <rect x="27" y="19" width="3" height="1" fill={skin.shadow} />
        </>
      )}
      <rect x="18" y={top} width="3" height="3" fill={AVATAR_EYE_WHITE} />
      <rect x="27" y={top} width="3" height="3" fill={AVATAR_EYE_WHITE} />
      <rect x="19" y={top} width="2" height="3" fill={iris.light} />
      <rect x="27" y={top} width="2" height="3" fill={iris.light} />
      <rect x="19" y={top + 1} width="2" height="2" fill={AVATAR_EYE} />
      <rect x="27" y={top + 1} width="2" height="2" fill={AVATAR_EYE} />
      <rect x="20" y={top} width="1" height="1" fill={AVATAR_EYE_WHITE} />
      <rect x="28" y={top} width="1" height="1" fill={AVATAR_EYE_WHITE} />
    </>
  );
}

function Nose({ style, skin }: { style: PersonNoseStyle; skin: SkinPalette }) {
  if (style === "hooked") {
    return (
      <>
        <rect x="23" y="20" width="2" height="5" fill={skin.shadow} />
        <rect x="25" y="22" width="1" height="3" fill={skin.shadow} />
        <rect x="24" y="25" width="3" height="1" fill={skin.shadow} />
        <rect x="23" y="21" width="1" height="3" fill={skin.highlight} />
      </>
    );
  }
  const height = style === "short" ? 4 : 5;
  return (
    <>
      <rect x="23" y="20" width="2" height={height} fill={skin.shadow} />
      <rect x={style === "broad" ? 22 : 24} y="24" width={style === "broad" ? 5 : 2} height="1" fill={skin.shadow} />
      <rect x={style === "angular" ? 25 : 24} y="24" width="1" height="1" fill={skin.highlight} />
      <rect x="23" y="21" width="1" height={height - 2} fill={skin.highlight} opacity="0.55" />
    </>
  );
}

// One line of mouth, never a block: anything thicker fights the moustache and
// beard pixels that sit immediately above and below it.
function Mouth({ style, y }: { style: PersonMouthStyle; y: number }) {
  if (style === "smile") {
    return (
      <>
        <rect x="21" y={y} width="1" height="1" fill={AVATAR_MOUTH} />
        <rect x="22" y={y + 1} width="5" height="1" fill={AVATAR_MOUTH} />
        <rect x="27" y={y} width="1" height="1" fill={AVATAR_MOUTH} />
      </>
    );
  }
  if (style === "wide") return <rect x="20" y={y} width="7" height="1" fill={AVATAR_MOUTH} />;
  if (style === "serious") {
    return (
      <>
        <rect x="21" y={y + 1} width="6" height="1" fill={AVATAR_MOUTH} />
        <rect x="27" y={y} width="1" height="1" fill={AVATAR_MOUTH} />
      </>
    );
  }
  if (style === "grin") {
    return (
      <>
        <rect x="21" y={y} width="6" height="1" fill={AVATAR_MOUTH} />
        <rect x="22" y={y + 1} width="4" height="1" fill={AVATAR_MOUTH} />
      </>
    );
  }
  if (style === "smirk") {
    return (
      <>
        <rect x="21" y={y + 1} width="5" height="1" fill={AVATAR_MOUTH} />
        <rect x="26" y={y} width="2" height="1" fill={AVATAR_MOUTH} />
      </>
    );
  }
  return <rect x="21" y={y} width="6" height="1" fill={AVATAR_MOUTH} />;
}

function FacialHair({ style, color }: { style: PersonFacialHairStyle; color: string }) {
  let shape = null;

  if (style === "moustache") {
    shape = (
      <>
        <rect x="17" y="24" width="2" height="1" fill={color} />
        <rect x="19" y="24" width="3" height="1" fill={color} />
        <rect x="26" y="24" width="3" height="1" fill={color} />
        <rect x="29" y="24" width="2" height="1" fill={color} />
        <rect x="19" y="25" width="3" height="1" fill={color} />
        <rect x="26" y="25" width="3" height="1" fill={color} />
      </>
    );
  } else if (style === "stubble") {
    shape = (
      <>
        <rect x="20" y="24" width="1" height="1" fill={color} />
        <rect x="24" y="24" width="1" height="1" fill={color} />
        <rect x="28" y="24" width="1" height="1" fill={color} />
        <rect x="17" y="25" width="1" height="1" fill={color} />
        <rect x="22" y="25" width="1" height="1" fill={color} />
        <rect x="26" y="25" width="1" height="1" fill={color} />
        <rect x="30" y="25" width="1" height="1" fill={color} />
        <rect x="19" y="26" width="1" height="1" fill={color} />
        <rect x="24" y="26" width="1" height="1" fill={color} />
        <rect x="29" y="26" width="1" height="1" fill={color} />
        <rect x="20" y="27" width="1" height="1" fill={color} />
        <rect x="25" y="27" width="1" height="1" fill={color} />
        <rect x="22" y="28" width="1" height="1" fill={color} />
        <rect x="27" y="28" width="1" height="1" fill={color} />
      </>
    );
  } else if (style === "goatee") {
    shape = (
      <>
        <rect x="21" y="24" width="1" height="2" fill={color} />
        <rect x="26" y="24" width="1" height="2" fill={color} />
        <rect x="22" y="25" width="4" height="2" fill={color} />
        <rect x="23" y="27" width="2" height="4" fill={color} />
      </>
    );
  } else if (style === "shortBeard") {
    shape = (
      <>
        <rect x="17" y="24" width="2" height="5" fill={color} />
        <rect x="29" y="24" width="2" height="5" fill={color} />
        <rect x="19" y="28" width="10" height="3" fill={color} />
        <rect x="20" y="24" width="3" height="1" fill={color} />
        <rect x="25" y="24" width="3" height="1" fill={color} />
      </>
    );
  } else if (style === "fullBeard") {
    shape = (
      <>
        <rect x="17" y="23" width="2" height="7" fill={color} />
        <rect x="29" y="23" width="2" height="7" fill={color} />
        <rect x="19" y="28" width="10" height="4" fill={color} />
        <rect x="19" y="24" width="3" height="2" fill={color} />
        <rect x="26" y="24" width="3" height="2" fill={color} />
        <rect x="20" y="23" width="3" height="1" fill={color} />
        <rect x="25" y="23" width="3" height="1" fill={color} />
      </>
    );
  } else if (style === "chinstrap") {
    shape = (
      <>
        <rect x="16" y="24" width="2" height="5" fill={color} />
        <rect x="30" y="24" width="2" height="5" fill={color} />
        <rect x="18" y="29" width="12" height="2" fill={color} />
        <rect x="18" y="24" width="1" height="2" fill={color} />
        <rect x="29" y="24" width="1" height="2" fill={color} />
      </>
    );
  } else if (style === "sideburns") {
    shape = (
      <>
        <rect x="16" y="18" width="1" height="7" fill={color} />
        <rect x="31" y="18" width="1" height="7" fill={color} />
        <rect x="17" y="23" width="1" height="3" fill={color} />
        <rect x="30" y="23" width="1" height="3" fill={color} />
      </>
    );
  } else if (style === "handlebar") {
    shape = (
      <>
        <rect x="18" y="24" width="4" height="2" fill={color} />
        <rect x="26" y="24" width="4" height="2" fill={color} />
        <rect x="16" y="23" width="2" height="2" fill={color} />
        <rect x="30" y="23" width="2" height="2" fill={color} />
        <rect x="15" y="22" width="1" height="2" fill={color} />
        <rect x="32" y="22" width="1" height="2" fill={color} />
      </>
    );
  } else if (style === "circleBeard") {
    shape = (
      <>
        <rect x="17" y="24" width="5" height="1" fill={color} />
        <rect x="26" y="24" width="5" height="1" fill={color} />
        <rect x="19" y="25" width="1" height="4" fill={color} />
        <rect x="28" y="25" width="1" height="4" fill={color} />
        <rect x="20" y="29" width="8" height="2" fill={color} />
      </>
    );
  } else if (style === "longBeard") {
    shape = (
      <>
        <rect x="17" y="23" width="2" height="8" fill={color} />
        <rect x="29" y="23" width="2" height="8" fill={color} />
        <rect x="19" y="24" width="3" height="2" fill={color} />
        <rect x="26" y="24" width="3" height="2" fill={color} />
        <rect x="19" y="29" width="10" height="4" fill={color} />
        <rect x="21" y="33" width="6" height="3" fill={color} />
        <rect x="20" y="23" width="3" height="1" fill={color} />
        <rect x="25" y="23" width="3" height="1" fill={color} />
      </>
    );
  } else if (style === "muttonChops") {
    shape = (
      <>
        <rect x="15" y="17" width="3" height="9" fill={color} />
        <rect x="30" y="17" width="3" height="9" fill={color} />
        <rect x="17" y="24" width="4" height="3" fill={color} />
        <rect x="27" y="24" width="4" height="3" fill={color} />
        <rect x="17" y="24" width="5" height="1" fill={color} />
        <rect x="26" y="24" width="5" height="1" fill={color} />
      </>
    );
  }

  return (
    <g data-avatar-layer="facial-hair" data-avatar-style={style}>
      {shape}
    </g>
  );
}

function Marking({ style, skin }: { style: PersonMarking; skin: SkinPalette }) {
  let shape = null;

  if (style === "freckles") {
    shape = (
      <>
        <rect x="18" y="23" width="1" height="1" fill={skin.shadow} />
        <rect x="20" y="24" width="1" height="1" fill={skin.shadow} />
        <rect x="18" y="25" width="1" height="1" fill={skin.shadow} />
        <rect x="29" y="23" width="1" height="1" fill={skin.shadow} />
        <rect x="27" y="24" width="1" height="1" fill={skin.shadow} />
        <rect x="29" y="25" width="1" height="1" fill={skin.shadow} />
      </>
    );
  } else if (style === "cheekScar") {
    shape = (
      <>
        <rect x="29" y="22" width="1" height="4" fill={skin.shadow} />
        <rect x="28" y="23" width="1" height="1" fill={skin.highlight} />
      </>
    );
  } else if (style === "browScar") {
    shape = (
      <>
        <rect x="18" y="14" width="1" height="4" fill={skin.shadow} />
        <rect x="19" y="15" width="1" height="1" fill={skin.highlight} />
      </>
    );
  } else if (style === "beautySpot") {
    shape = <rect x="28" y="26" width="1" height="1" fill={skin.shadow} />;
  } else if (style === "dimples") {
    shape = (
      <>
        <rect x="19" y="27" width="1" height="2" fill={skin.shadow} />
        <rect x="28" y="27" width="1" height="2" fill={skin.shadow} />
      </>
    );
  }

  return (
    <g data-avatar-layer="marking" data-avatar-style={style}>
      {shape}
    </g>
  );
}

function Accessory({
  style,
  hair,
  skin,
  attire,
}: {
  style: PersonAccessory;
  hair: string;
  skin: SkinPalette;
  attire: "kit" | "staff";
}) {
  let shape = null;

  if (style === "glasses" && attire === "kit") {
    return (
      <g data-avatar-layer="accessory" data-avatar-style={style}>
        <rect x="0" y="0" width="0" height="0" fill="none" data-glasses-suppressed="true" />
      </g>
    );
  }

  if (style === "headband") {
    shape = (
      <>
        <rect x="14" y="11" width="20" height="3" fill={AVATAR_OUTLINE} />
        <rect x="15" y="12" width="18" height="2" fill={PERSON_ART_COLORS.headband} />
        <rect x="15" y="12" width="18" height="1" fill={PERSON_ART_COLORS.glint} />
      </>
    );
  } else if (style === "earring") {
    shape = (
      <>
        <rect x="13" y="24" width="2" height="2" fill={AVATAR_OUTLINE} />
        <rect x="13" y="24" width="1" height="1" fill={PERSON_ART_COLORS.earring} />
      </>
    );
  } else if (style === "glasses") {
    shape = (
      <>
        <rect x="17" y="18" width="5" height="5" fill={PERSON_ART_COLORS.glint} opacity="0.1" />
        <rect x="26" y="18" width="5" height="5" fill={PERSON_ART_COLORS.glint} opacity="0.1" />
        <rect x="16" y="18" width="7" height="1" fill={AVATAR_OUTLINE} />
        <rect x="16" y="22" width="7" height="1" fill={AVATAR_OUTLINE} />
        <rect x="16" y="19" width="1" height="3" fill={AVATAR_OUTLINE} />
        <rect x="22" y="19" width="1" height="3" fill={AVATAR_OUTLINE} />
        <rect x="25" y="18" width="7" height="1" fill={AVATAR_OUTLINE} />
        <rect x="25" y="22" width="7" height="1" fill={AVATAR_OUTLINE} />
        <rect x="25" y="19" width="1" height="3" fill={AVATAR_OUTLINE} />
        <rect x="31" y="19" width="1" height="3" fill={AVATAR_OUTLINE} />
        <rect x="23" y="19" width="2" height="1" fill={AVATAR_OUTLINE} />
        <rect x="14" y="19" width="2" height="1" fill={AVATAR_OUTLINE} />
        <rect x="32" y="19" width="2" height="1" fill={AVATAR_OUTLINE} />
        <rect x="17" y="18" width="2" height="1" fill={PERSON_ART_COLORS.glint} opacity="0.35" />
      </>
    );
  } else if (style === "taped") {
    shape = (
      <>
        <rect x="14" y="9" width="20" height="3" fill={PERSON_ART_COLORS.tape} />
        <rect x="14" y="9" width="20" height="1" fill={PERSON_ART_COLORS.glint} />
        <rect x="18" y="9" width="1" height="3" fill={skin.shadow} opacity="0.35" />
        <rect x="27" y="9" width="1" height="3" fill={hair} opacity="0.25" />
      </>
    );
  }

  return (
    <g data-avatar-layer="accessory" data-avatar-style={style}>
      {shape}
    </g>
  );
}

export function PersonArt({ appearance, attire, kit, primary, fullKit }: { appearance: PersonAppearance; attire: PersonAvatarAttire; kit: PersonAvatarKit; primary: string; fullKit: boolean }) {
  const skin = PERSON_SKIN_TONES[appearance.skinTone];
  const hair = PERSON_HAIR_COLORS[appearance.hairColor];
  const iris = PERSON_EYE_COLORS[appearance.eyeColor];
  const isStaff = attire === 'staff';
  const shirtAccent = isStaff ? PERSON_ART_COLORS.staffShirt : kit.accent;
  const mouthY = appearance.faceShape === 'long' ? 28 : 27;
  return <>
      <rect x="7" y={fullKit && !isStaff ? 59 : 46} width="34" height="2" fill={PERSON_ART_COLORS.shadow} opacity="0.24" />

      <g data-avatar-layer="kit">
        <path
          d={
            fullKit && !isStaff
              ? "M4 48V41H8V37H14V34H34V37H40V41H44V48H35V50H13V48Z"
              : "M4 48V41H8V37H14V34H34V37H40V41H44V48Z"
          }
          fill={AVATAR_OUTLINE}
        />
        {isStaff ? <StaffArt accent={primary} /> : <KitArt kit={kit} fullKit={fullKit} />}
      </g>

      <g data-avatar-layer="neck">
        <rect x="18" y="27" width="12" height="11" fill={AVATAR_OUTLINE} />
        <rect x="20" y="27" width="8" height="9" fill={skin.base} />
        <rect x="20" y="34" width="8" height="2" fill={skin.shadow} />
        <rect x="20" y="36" width="3" height="2" fill={shirtAccent} />
        <rect x="25" y="36" width="3" height="2" fill={shirtAccent} />
      </g>

      <Face shape={appearance.faceShape} skin={skin} />
      <Hair style={appearance.hairStyle} base={hair.base} highlight={hair.highlight} />

      <g data-avatar-layer="features">
        <g data-avatar-feature="brows" data-avatar-style={appearance.browStyle}>
          <Brows style={appearance.browStyle} color={hair.base} />
        </g>
        <g data-avatar-feature="eyes" data-avatar-style={appearance.eyeStyle}>
          <Eyes style={appearance.eyeStyle} skin={skin} iris={iris} />
        </g>
        <g data-avatar-feature="nose" data-avatar-style={appearance.noseStyle}>
          <Nose style={appearance.noseStyle} skin={skin} />
        </g>
      </g>

      <FacialHair style={appearance.facialHair} color={hair.base} />

      <g data-avatar-feature="mouth" data-avatar-style={appearance.mouthStyle}>
        <Mouth style={appearance.mouthStyle} y={mouthY} />
      </g>

      <Marking style={appearance.marking} skin={skin} />
      <Accessory style={appearance.accessory} hair={hair.base} skin={skin} attire={attire} />
  </>;
}
