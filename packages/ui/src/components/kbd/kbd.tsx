// Keyboard input label. Renders the native <kbd> element, which is the HTML semantic for user
// input (keys, key combinations, typed commands); it has no ARIA role and is not interactive.
// Kbd.Group lays out a combination as one <kbd> per key with a visual "+" between them. The "+"
// is aria-hidden, so assistive tech reads the keys in order ("Cmd K").
import { Children, Fragment, type ComponentPropsWithRef } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';

export type KbdProps = ComponentPropsWithRef<'kbd'>;

export type KbdGroupProps = ComponentPropsWithRef<'span'>;

const KEY_SEPARATOR = '+';

// The spacing scale has no 2px/6px steps; a key chip sits tighter than any control.
const KEY_PADDING_BLOCK = '2px';
const KEY_PADDING_INLINE = '6px';
// Thicker bottom edge gives the key-cap depth.
const KEY_CAP_EDGE = '2px';

const rootStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  boxSizing: 'border-box',
  paddingBlock: KEY_PADDING_BLOCK,
  paddingInline: KEY_PADDING_INLINE,
  backgroundColor: vars.color.surfaceHover,
  border: `1px solid ${vars.color.borderSubtle}`,
  borderBlockEndColor: vars.color.borderStrong,
  borderBlockEndWidth: KEY_CAP_EDGE,
  borderRadius: vars.radius.sm,
  fontFamily: vars.font.mono,
  fontSize: vars.textSize.xs,
  fontWeight: vars.fontWeight.medium,
  lineHeight: vars.lineHeight.tight,
  color: vars.color.text,
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
});

const groupStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[1],
  verticalAlign: 'middle',
});

const separatorStyle = css({
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
});

function KbdRoot({ ref, ...props }: KbdProps) {
  return <kbd {...props} ref={ref} data-ui="kbd" css={rootStyle} />;
}

KbdRoot.displayName = 'Kbd';

function KbdGroup({ ref, children, ...rest }: KbdGroupProps) {
  return (
    <span {...rest} ref={ref} data-ui="kbd-group" css={groupStyle}>
      {Children.toArray(children).map((child, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <span aria-hidden data-ui="kbd-separator" css={separatorStyle}>
              {KEY_SEPARATOR}
            </span>
          )}
          {child}
        </Fragment>
      ))}
    </span>
  );
}

KbdGroup.displayName = 'Kbd.Group';

export const Kbd = Object.assign(KbdRoot, { Group: KbdGroup });
