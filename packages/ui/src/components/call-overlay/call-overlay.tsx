'use client';

import { useEffect, type ComponentPropsWithRef, type ComponentType, type ReactNode } from 'react';
import { MotionConfig, motion, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { motionDurationMs } from '../../styling/motion-timings';
import { WithSx, type SxProps } from '../../styling/sx';
import { useControlledState } from '../../utils/use-controlled-state';

export type CallOverlayTone = 'success' | 'danger' | 'neutral';
export type CallOverlayRootProps = ComponentPropsWithRef<'div'> & { 'data-ui'?: string };
export interface CallOverlaySlots {
  root?: ComponentType<CallOverlayRootProps>;
}
export interface CallOverlaySlotProps {
  root?: CallOverlayRootProps & { css?: Interpolation<Theme> };
}
export interface CallOverlayProps extends CallOverlayRootProps, SxProps {
  /** Announcement content. Children take precedence over label. */
  label?: ReactNode;
  /** Controls visibility; set false then true to replay. */
  open?: boolean;
  /** Initially show an uncontrolled announcement. Defaults to false. */
  defaultOpen?: boolean;
  /** Requests closure after the announcement animation finishes. */
  onOpenChange?: (open: boolean) => void;
  tone?: CallOverlayTone;
  component?: CallOverlaySlots['root'];
  slots?: CallOverlaySlots;
  slotProps?: CallOverlaySlotProps;
}

const rootStyle = css({
  label: 'call-overlay',
  display: 'grid',
  placeItems: 'center',
  pointerEvents: 'none',
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.xl,
  fontWeight: vars.fontWeight.semibold,
  lineHeight: vars.lineHeight.tight,
  textAlign: 'center',
});
const contentStyle = css({
  display: 'inline-block',
  paddingBlock: vars.space[3],
  paddingInline: vars.space[5],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.lg,
  backgroundColor: vars.color.surfaceRaised,
  maxInlineSize: '100%',
  overflowWrap: 'anywhere',
});
const tones = {
  neutral: css({ color: vars.color.accentText }),
  success: css({ color: vars.color.success }),
  danger: css({ color: vars.color.dangerText }),
};

export function CallOverlay({
  children, label, open: openProp, defaultOpen = false, onOpenChange,
  tone = 'neutral', component, slots, slotProps, className, style, sx, ...rest
}: CallOverlayProps) {
  const [open, setOpen] = useControlledState(openProp, defaultOpen, onOpenChange);
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setOpen(false), motionDurationMs.callFade);
    return () => clearTimeout(timer);
  }, [open, setOpen]);
  const reduced = useReducedMotion();
  const Root = slots?.root ?? component ?? 'div';
  const { css: slotCss, className: slotClassName, style: slotStyle, ...rootProps } = slotProps?.root ?? {};
  const marker = [...new Set(['call-overlay', rest['data-ui'], rootProps['data-ui']]
    .flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []))].join(' ');
  return (
    <WithSx styles={[rootStyle, tones[tone], slotCss]} className={[className, slotClassName].filter(Boolean).join(' ')} sx={sx}>
      {(resolvedClassName) => (
        <Root {...rest} {...rootProps} className={resolvedClassName} style={{ ...style, ...slotStyle }}
          data-ui={marker} data-state={open ? 'open' : 'closed'} data-tone={tone}
          data-reduced-motion={reduced ? 'true' : 'false'} role="status" aria-live="polite" aria-atomic="true">
          <MotionConfig reducedMotion="user">
            {open && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }}
                transition={{ duration: motionDurationMs.callFade / 1000, times: [0, 0.1, 0.85, 1] }}
                >
                <motion.span css={contentStyle} initial={reduced ? false : { scale: 2.6 }}
                  animate={reduced ? undefined : { scale: [2.6, 0.94, 1.04, 1], x: [0, -6, 6, -4, 4, 0] }}
                  transition={{
                    scale: { duration: motionDurationMs.callSlam / 1000, ease: 'easeOut' },
                    x: { duration: motionDurationMs.callShake / 1000, delay: motionDurationMs.callShakeDelay / 1000 },
                  }}>
                  {children ?? label}
                </motion.span>
              </motion.span>
            )}
          </MotionConfig>
        </Root>
      )}
    </WithSx>
  );
}
CallOverlay.displayName = 'CallOverlay';
