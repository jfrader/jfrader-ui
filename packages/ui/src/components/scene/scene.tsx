'use client';

// Semantics: inline SVG artwork element.
// When an accessible name is available (via `alt`, `aria-label` or defaulting to `seed`),
// the SVG carries `role="img"` and `aria-label`. When marked decorative (via `aria-hidden`
// or `alt=""`), the SVG carries `aria-hidden="true"` and no role. Not interactive.
import type { ComponentPropsWithRef } from 'react';
import { css, type SerializedStyles } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import {
  generateSceneParts,
  generateSceneSvg,
  SCENE_VIEW_BOX,
  type SceneGrade,
  type SceneVariant,
} from './scene-generator';

export type { SceneGrade, SceneVariant } from './scene-generator';

export type SceneSize = 'sm' | 'md' | 'lg' | 'full';

export interface SceneOptions {
  /** Visual variant of the scene. Defaults to 'landscape'. */
  variant?: SceneVariant;
  /** Colour grade of the same scene: `warm` recolours it without moving anything. Defaults to 'raw'. */
  grade?: SceneGrade;
}

export interface SceneSourceOptions extends SceneOptions {}

export interface SceneProps
  extends Omit<ComponentPropsWithRef<'svg'>, 'children'>,
    SxProps {
  /** Deterministic seed string. Identical seeds produce identical scenes across platforms. */
  seed: string;
  /** Visual variant of the scene. Defaults to 'landscape'. */
  variant?: SceneVariant;
  /** Colour grade of the same scene: `warm` recolours it without moving anything. Defaults to 'raw'. */
  grade?: SceneGrade;
  /**
   * Accessible description of the scene.
   * If omitted, falls back to `aria-label` or the seed string.
   * Pass an empty string or `aria-hidden` to mark the scene as decorative.
   */
  alt?: string;
  /**
   * Sizing preset: 'sm' (120px), 'md' (240px), 'lg' (480px), or 'full' (100%).
   * Defaults to 'full'.
   */
  size?: SceneSize;
}

const rootStyle = css({
  display: 'block',
  boxSizing: 'border-box',
  verticalAlign: 'middle',
  userSelect: 'none',
});

const sizeStyles: Record<SceneSize, SerializedStyles> = {
  sm: css({ inlineSize: '120px', blockSize: 'auto', aspectRatio: '3 / 2' }),
  md: css({ inlineSize: '240px', blockSize: 'auto', aspectRatio: '3 / 2' }),
  lg: css({ inlineSize: '480px', blockSize: 'auto', aspectRatio: '3 / 2' }),
  full: css({ inlineSize: '100%', blockSize: '100%' }),
};

/**
 * Returns a `data:image/svg+xml` URL representing the seeded procedural scene.
 * Suitable for image-slot APIs (such as Avatar `src` or gallery image items)
 * without requiring React runtime components.
 */
export function sceneSource(seed: string, options?: SceneSourceOptions): string {
  return `data:image/svg+xml,${encodeURIComponent(generateSceneSvg(seed, options?.variant, options?.grade))}`;
}

export function Scene({
  ref,
  seed,
  variant = 'landscape',
  grade = 'raw',
  alt,
  size = 'full',
  className,
  sx,
  'aria-hidden': ariaHidden,
  preserveAspectRatio = 'xMidYMid slice',
  ...rest
}: SceneProps) {
  const isDecorative = ariaHidden === true || ariaHidden === 'true' || alt === '';
  const accessibleName = isDecorative || Boolean(rest['aria-labelledby'])
    ? undefined
    : (alt ?? rest['aria-label'] ?? seed);

  const { defs, content } = generateSceneParts(seed, variant, grade);

  return (
    <WithSx className={className} styles={[rootStyle, sizeStyles[size]]} sx={sx}>
      {(rootClass) => (
        <svg
          {...rest}
          ref={ref}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={SCENE_VIEW_BOX}
          preserveAspectRatio={preserveAspectRatio}
          role={isDecorative ? undefined : 'img'}
          aria-label={accessibleName}
          aria-hidden={isDecorative ? true : undefined}
          data-ui="scene"
          data-variant={variant}
          data-grade={grade}
          data-seed={seed}
          className={rootClass}
          dangerouslySetInnerHTML={{ __html: `<defs>${defs}</defs>${content}` }}
        />
      )}
    </WithSx>
  );
}

Scene.displayName = 'Scene';
