'use client';

import { useId, useState, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Switch, type SwitchPartProps, type SwitchProps } from '../switch';

export type ThemeSwitchValue = 'light' | 'dark';
export type ThemeSwitchTransition = 'reveal' | 'eclipse' | 'split' | 'rise';
export interface ThemeSwitchChangeDetails {
  transition: ThemeSwitchTransition;
  trigger: HTMLInputElement;
  reducedMotion: boolean;
}
export interface ThemeSwitchProps extends Omit<
  SwitchProps,
  'value' | 'defaultValue' | 'checked' | 'defaultChecked' | 'onCheckedChange' | 'children' | 'slotProps'
> {
  value?: ThemeSwitchValue;
  defaultValue?: ThemeSwitchValue;
  onValueChange?: (next: ThemeSwitchValue, details: ThemeSwitchChangeDetails) => void;
  label: ReactNode;
  iconOnly?: boolean;
  lightIcon?: ReactNode;
  darkIcon?: ReactNode;
  transition?: ThemeSwitchTransition;
  loading?: boolean;
  slotProps?: SwitchProps['slotProps'] & {
    iconFrame?: SwitchPartProps;
    lightIcon?: SwitchPartProps;
    darkIcon?: SwitchPartProps;
  };
}

const rootStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[2],
  maxInlineSize: '100%',
  minInlineSize: 0,
  '&:has(input:disabled) [data-ui="theme-switch-icon-frame"]': { cursor: 'not-allowed' },
});
const switchRootStyle = css({ minBlockSize: vars.space[8], justifyContent: 'center' });
const frameStyle = css({
  display: 'inline-grid',
  flexShrink: 0,
  inlineSize: vars.space[5],
  blockSize: vars.space[5],
  alignItems: 'center',
  justifyItems: 'center',
  cursor: 'pointer',
  '&[data-animated="true"]': {
    transitionProperty: 'transform',
    transitionDuration: vars.motion.duration.slow,
    transitionTimingFunction: vars.motion.easeStandard,
  },
  [REDUCED_MOTION]: { transform: 'none !important', transitionDuration: '0s !important' },
  [FORCED_COLORS]: { color: 'CanvasText' },
});
const iconStyle = css({
  gridArea: '1 / 1',
  display: 'inline-flex',
  inlineSize: '100%',
  blockSize: '100%',
  opacity: 0,
  transform: 'rotate(-30deg) scale(.8)',
  '&[data-active="true"]': { opacity: 1, transform: 'none' },
  '&[data-animated="true"]': {
    transitionProperty: 'opacity, transform',
    transitionDuration: vars.motion.duration.base,
    transitionTimingFunction: vars.motion.easeStandard,
  },
  [REDUCED_MOTION]: { transform: 'none', transitionDuration: '0s !important' },
});
const cueStyles: Record<ThemeSwitchTransition, SerializedStyles> = {
  reveal: css({ '&[data-value="dark"]': { transform: 'scale(1.08)' } }),
  eclipse: css({
    '&[data-value="dark"]': { transform: `translateX(calc(${vars.space[1]} / -2))` },
    '&:dir(rtl)[data-value="dark"]': { transform: `translateX(calc(${vars.space[1]} / 2))` },
  }),
  split: css({
    '&[data-value="dark"]': { transform: `translateX(calc(${vars.space[1]} / 4))` },
    '&:dir(rtl)[data-value="dark"]': { transform: `translateX(calc(${vars.space[1]} / -4))` },
  }),
  rise: css({ '&[data-value="dark"]': { transform: `translateY(calc(${vars.space[1]} / -2))` } }),
};
const sun = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" focusable="false">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
  </svg>
);
const moon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" focusable="false">
    <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" />
  </svg>
);

/** Requests light or dark appearance; the app applies the theme.
 * Space and clicking the icon toggle Switch. Keep its accessible name the same in both states.
 * The ref points to Switch's input. The icon frame is a hidden label for that input.
 */
export function ThemeSwitch({
  value: valueProp,
  defaultValue = 'light',
  onValueChange,
  label,
  iconOnly = false,
  lightIcon = sun,
  darkIcon = moon,
  transition = 'reveal',
  loading = false,
  className,
  sx,
  slotProps,
  onChange,
  onClick,
  dir,
  id: idProp,
  ...rest
}: ThemeSwitchProps) {
  const generatedId = useId();
  const inputId = idProp ?? generatedId;
  const { iconFrame: iconFrameSlot, lightIcon: lightIconSlot, darkIcon: darkIconSlot, ...switchSlotProps } =
    slotProps ?? {};
  const [value, requestChange] = useControlledState(valueProp, defaultValue);
  const [animated, setAnimated] = useState(false);
  const hasLabel = isRenderable(label) && label !== '';
  const hasLight = isRenderable(lightIcon) && lightIcon !== '';
  const hasDark = isRenderable(darkIcon) && darkIcon !== '';
  const inactive = loading || rest['aria-disabled'] === true || rest['aria-disabled'] === 'true';
  return (
    <WithSx className={className} styles={rootStyle} sx={sx}>
      {(className) => (
        <span
          data-ui="theme-switch"
          data-value={value}
          data-transition={transition}
          dir={dir}
          className={className}
        >
          {(hasLight || hasDark) && (
            <label
              htmlFor={inputId}
              aria-hidden="true"
              data-ui="theme-switch-icon-frame"
              data-value={value}
              data-animated={animated}
              className={iconFrameSlot?.className}
              css={[frameStyle, cueStyles[transition], iconFrameSlot?.css]}
            >
              {hasLight && (
                <span
                  data-ui="theme-switch-light-icon"
                  data-active={value === 'light'}
                  data-animated={animated}
                  className={lightIconSlot?.className}
                  css={[iconStyle, lightIconSlot?.css]}
                >
                  {lightIcon}
                </span>
              )}
              {hasDark && (
                <span
                  data-ui="theme-switch-dark-icon"
                  data-active={value === 'dark'}
                  data-animated={animated}
                  className={darkIconSlot?.className}
                  css={[iconStyle, darkIconSlot?.css]}
                >
                  {darkIcon}
                </span>
              )}
            </label>
          )}
          <Switch
            {...rest}
            id={inputId}
            dir={dir}
            checked={value === 'dark'}
            aria-busy={loading || rest['aria-busy']}
            aria-disabled={inactive || rest['aria-disabled']}
            description={rest.description === '' ? undefined : rest.description}
            slotProps={{
              ...switchSlotProps,
              root: { ...switchSlotProps.root, css: [switchRootStyle, switchSlotProps.root?.css] },
            }}
            onClick={(event) => {
              onClick?.(event);
              if (inactive) event.preventDefault();
            }}
            onChange={(event) => {
              onChange?.(event);
              if (event.defaultPrevented || event.nativeEvent.defaultPrevented || inactive) return;
              const next = event.currentTarget.checked ? 'dark' : 'light';
              if (next === value) return;
              setAnimated(true);
              requestChange(next);
              onValueChange?.(next, {
                transition,
                trigger: event.currentTarget,
                reducedMotion:
                  event.currentTarget.ownerDocument.defaultView?.matchMedia(
                    '(prefers-reduced-motion: reduce)',
                  ).matches ?? false,
              });
            }}
            label={hasLabel ? <span css={iconOnly && visuallyHiddenStyle}>{label}</span> : undefined}
          />
        </span>
      )}
    </WithSx>
  );
}
ThemeSwitch.displayName = 'ThemeSwitch';
