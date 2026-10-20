// Internal field anatomy shared by the field components: root, label with required marker,
// description and error parts plus their id wiring. Not exported from the package index; each
// component keeps its own control element and control styles.
import { useId, type AriaAttributes, type ComponentType, type ComponentPropsWithRef, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { isRenderable } from '../../utils/renderable';
import { FieldSlot, type FieldElementProps } from './field-slot';

/**
 * Where the field's label sits. `hidden` keeps the label as the control's accessible name but
 * removes it from layout, so a labeled field is exactly as tall as its control.
 */
export type FieldLabelPlacement = 'above' | 'hidden';

/**
 * Column recipe for fields whose control is a button rather than a native input: Select and
 * MultiSelect share it so their labeled boxes stay identical.
 */
export const fieldColumnStyle = css({
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: vars.space[1],
  maxInlineSize: '100%',
});

export interface FieldPartProps {
  [attribute: `data-${string}`]: unknown;
  className?: string;
  sx?: Interpolation<Theme>;
}

const rootStyle = css({
  display: 'grid',
  gap: vars.space[1],
  inlineSize: '100%',
  minInlineSize: 0,
});

const labelStyle = css({
  display: 'inline-flex',
  gap: vars.space[1],
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.text,
});

const requiredMarkStyle = css({
  color: vars.color.dangerText,
});

const descriptionStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});

const errorStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.dangerText,
});

interface FieldAnatomyOptions {
  id?: string;
  description?: ReactNode;
  error?: ReactNode;
  'aria-describedby'?: string;
  'aria-invalid'?: AriaAttributes['aria-invalid'];
}

// External aria-describedby is merged with the internal ids; an error forces aria-invalid,
// otherwise the consumer's value is preserved.
export function useFieldAnatomy({
  id: idProp,
  description,
  error,
  'aria-describedby': ariaDescribedByProp,
  'aria-invalid': ariaInvalidProp,
}: FieldAnatomyOptions) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const hasDescription = isRenderable(description);
  const hasError = isRenderable(error);
  const describedBy =
    [ariaDescribedByProp, hasDescription && descriptionId, hasError && errorId].filter(Boolean).join(' ') || undefined;
  const ariaInvalid = hasError ? true : ariaInvalidProp;
  return { id, descriptionId, errorId, describedBy, ariaInvalid };
}

interface FieldRootProps extends Omit<FieldElementProps<'div'>, 'part' | 'css'>, SxProps {
  'data-ui': string;
  className?: string;
  dir?: string;
  part?: FieldElementProps<'div'>;
  component?: ComponentType<ComponentPropsWithRef<'div'>>;
  children: ReactNode;
}

export function FieldRoot({ component, part, ...props }: FieldRootProps) {
  return (
    <FieldSlot element="div" root component={component} slotProps={part} {...props} styles={rootStyle} />
  );
}

interface FieldLabelProps {
  id?: string;
  htmlFor: string;
  required?: boolean;
  /** Visually hidden, still the accessible name. Removed from layout, not from the a11y tree. */
  hidden?: boolean;
  part?: FieldElementProps<'label'>;
  component?: ComponentType<ComponentPropsWithRef<'label'>>;
  children: ReactNode;
}

export function FieldLabel({ id, htmlFor, required, hidden, part, component, children }: FieldLabelProps) {
  if (!isRenderable(children)) return null;
  return (
    <FieldSlot
      element="label"
      component={component}
      slotProps={part}
      id={id}
      htmlFor={htmlFor}
      styles={[labelStyle, hidden && visuallyHiddenStyle]}
    >
      {children}
      {required && (
        <span aria-hidden css={requiredMarkStyle}>
          {' *'}
        </span>
      )}
    </FieldSlot>
  );
}

interface FieldMessageProps {
  id: string;
  part?: FieldElementProps<'span'>;
  component?: ComponentType<ComponentPropsWithRef<'span'>>;
  children: ReactNode;
}

export function FieldDescription({ id, part, component, children }: FieldMessageProps) {
  if (!isRenderable(children)) return null;
  return (
    <FieldSlot element="span" component={component} slotProps={part} id={id} styles={descriptionStyle}>
      {children}
    </FieldSlot>
  );
}

export function FieldError({ id, part, component, children }: FieldMessageProps) {
  if (!isRenderable(children)) return null;
  return (
    <FieldSlot element="span" component={component} slotProps={part} id={id} role="alert" styles={errorStyle}>
      {children}
    </FieldSlot>
  );
}
