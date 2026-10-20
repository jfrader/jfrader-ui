'use client';

import { createContext, useContext, useEffect, useId, useMemo, useState, type ComponentPropsWithRef } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { motionDurationMs } from '../../styling/motion-timings';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { useControlledState } from '../../utils/use-controlled-state';
import { useReducedMotion } from '../../utils/use-reduced-motion';
import { Skeleton, type SkeletonProps } from './skeleton-placeholder';

export type SkeletonMorphValue = 'loading' | 'ready';

export interface SkeletonMorphProps extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue'>, SxProps {
  /** Changes the accepted loading presentation; no request callback is emitted. */
  value?: SkeletonMorphValue;
  /** Sets the initial uncontrolled presentation. Defaults to `loading`. */
  defaultValue?: SkeletonMorphValue;
  /** Announces the loading state in the polite live region. */
  loadingLabel: string;
  /** Announces the ready state. Defaults to `null`, which clears the live region. */
  readyLabel?: string | null;
  /** Animates shell and block geometry. Defaults to true. */
  animateLayout?: boolean;
}

export interface SkeletonBlockProps extends ComponentPropsWithRef<'div'>, SxProps {
  /** Sets the placeholder or line-group width in pixels or a CSS length. Defaults to full width for noncircular placeholders. */
  width?: SkeletonProps['width'];
  /** Sets single-block height in pixels or a CSS length. Ignored in line mode. */
  height?: SkeletonProps['height'];
  /** Rounds a single placeholder into a circle whose height follows its width unless `height` is set. Ignored in line mode. */
  circle?: boolean;
  /** Sets placeholder corner radii in pixels or a CSS length. Ignored for a circular placeholder. */
  radius?: SkeletonProps['radius'];
  /** Positive integer line count; invalid values use one block instead. */
  lines?: number;
  /** Sets each line's height in pixels or a CSS length. Defaults to `1.5em`; used only in line mode. */
  lineHeight?: SkeletonProps['height'];
  /** Sets the final line's width in pixels or a CSS length. Defaults to `75%`; applies only when there are multiple lines. */
  lastLineWidth?: SkeletonProps['width'];
}

const MorphContext = createContext<{ ready: boolean; animateLayout: boolean } | null>(null);
const rootStyle = css({ minInlineSize: 0, '&:focus': focusRingOutset });
const blockStyle = css({ minInlineSize: 0 });
const linesStyle = css({ display: 'grid', gap: vars.space[2] });
const transition = { duration: motionDurationMs.base / 1000 };

function Div({
  nativeProps,
  ...props
}: ComponentPropsWithRef<'div'> & { nativeProps: ComponentPropsWithRef<'div'> }) {
  return <div {...nativeProps} {...props} style={{ ...nativeProps.style, ...props.style }} />;
}
const Layout = motion.create(Div);

function parkFocusOnDetach(element: HTMLDivElement | null) {
  if (!element) return;
  return () => {
    if (element.contains(element.ownerDocument.activeElement)) {
      element.closest<HTMLElement>('[data-ui="skeleton-morph"]')?.focus({ preventScroll: true });
    }
  };
}

function MorphRoot({
  ref,
  value,
  defaultValue = 'loading',
  loadingLabel,
  readyLabel = null,
  animateLayout = true,
  children,
  className,
  sx,
  'aria-describedby': describedBy,
  ...rest
}: SkeletonMorphProps) {
  const [state] = useControlledState(value, defaultValue);
  const ready = state === 'ready';
  const reduced = useReducedMotion();
  const statusId = useId();
  const [announcement, setAnnouncement] = useState('');
  const context = useMemo(() => ({ ready, animateLayout: animateLayout && !reduced }), [ready, animateLayout, reduced]);
  useEffect(() => {
    setAnnouncement(ready ? readyLabel ?? '' : loadingLabel);
  }, [ready, readyLabel, loadingLabel]);

  return (
    <MorphContext.Provider value={context}>
      <WithSx className={className} styles={rootStyle} sx={sx}>
        {(className) => (
          <Layout
            nativeProps={rest}
            ref={ref}
            className={className}
            data-ui="skeleton-morph"
            data-state={state}
            aria-busy={!ready}
            tabIndex={rest.tabIndex ?? -1}
            aria-describedby={[describedBy, statusId].filter(Boolean).join(' ')}
            layout={animateLayout && !reduced}
            transition={transition}
          >
            {children}
          </Layout>
        )}
      </WithSx>
      <span id={statusId} role="status" aria-live="polite" aria-atomic="true" css={visuallyHiddenStyle}>
        {announcement}
      </span>
    </MorphContext.Provider>
  );
}

export function SkeletonMorph(props: SkeletonMorphProps) {
  return (
    <MotionConfig reducedMotion="user">
      <MorphRoot {...props} />
    </MotionConfig>
  );
}
SkeletonMorph.displayName = 'Skeleton.Morph';

export function SkeletonBlock({
  ref,
  width,
  height,
  circle,
  radius,
  lines,
  lineHeight = '1.5em',
  lastLineWidth = '75%',
  children,
  className,
  sx,
  ...rest
}: SkeletonBlockProps) {
  const context = useContext(MorphContext);
  if (!context) throw new Error('Skeleton.Block must be rendered inside <Skeleton.Morph>.');
  const { ready, animateLayout } = context;
  const lineCount = lines !== undefined && Number.isSafeInteger(lines) && lines > 0 ? lines : undefined;

  return (
    <WithSx className={className} styles={blockStyle} sx={sx}>
      {(className) => (
        <Layout
          nativeProps={rest}
          ref={ref}
          className={className}
          data-ui="skeleton-block"
          data-state={ready ? 'ready' : 'loading'}
          layout={animateLayout}
          transition={transition}
        >
          {ready ? (
            <div key="content" ref={parkFocusOnDetach}>
              {children}
            </div>
          ) : (
            <div
              key="placeholder"
              aria-hidden="true"
              inert
              css={lineCount ? linesStyle : undefined}
              style={lineCount ? { inlineSize: width } : undefined}
            >
              {lineCount ? Array.from({ length: lineCount }, (_, index) => (
                <Skeleton
                  key={index}
                  width={index === lineCount - 1 && lineCount > 1 ? lastLineWidth : '100%'}
                  height={lineHeight}
                  radius={radius}
                />
              )) : <Skeleton width={width} height={height} circle={circle} radius={radius} />}
            </div>
          )}
        </Layout>
      )}
    </WithSx>
  );
}
SkeletonBlock.displayName = 'Skeleton.Block';
