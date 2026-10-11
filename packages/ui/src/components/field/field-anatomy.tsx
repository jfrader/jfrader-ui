// Internal field anatomy shared by TextField, Textarea and PasswordField: root, label with
// required marker, description and error parts plus their id wiring. Not exported from the
// package index; each component keeps its own control element and control styles.
import { useId, type AriaAttributes, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';

export interface FieldPartProps {
  className?: string;
  css?: Interpolation<Theme>;
}

export interface FieldSlotProps<Part = FieldPartProps> {
  root?: Part;
  label?: Part;
  control?: Part;
  description?: Part;
  error?: Part;
}

const rootStyle = css({
  display: 'grid',
  gap: vars.space[1],
  inlineSize: '100%',
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

interface FieldRootProps extends SxProps {
  'data-ui': string;
  className?: string;
  dir?: string;
  part?: FieldPartProps;
  children: ReactNode;
}

export function FieldRoot({ 'data-ui': dataUi, className, dir, sx, part, children }: FieldRootProps) {
  const rootClassName = [className, part?.className].filter(Boolean).join(' ') || undefined;
  return (
    <WithSx className={rootClassName} styles={[rootStyle, part?.css]} sx={sx}>
      {(className) => (
        <div data-ui={dataUi} dir={dir} className={className}>
          {children}
        </div>
      )}
    </WithSx>
  );
}

interface FieldLabelProps {
  id?: string;
  htmlFor: string;
  required?: boolean;
  part?: FieldPartProps;
  children: ReactNode;
}

export function FieldLabel({ id, htmlFor, required, part, children }: FieldLabelProps) {
  if (!isRenderable(children)) return null;
  return (
    <label id={id} htmlFor={htmlFor} className={part?.className} css={[labelStyle, part?.css]}>
      {children}
      {required && (
        <span aria-hidden css={requiredMarkStyle}>
          {' *'}
        </span>
      )}
    </label>
  );
}

interface FieldMessageProps {
  id: string;
  part?: FieldPartProps;
  children: ReactNode;
}

export function FieldDescription({ id, part, children }: FieldMessageProps) {
  if (!isRenderable(children)) return null;
  return (
    <span id={id} className={part?.className} css={[descriptionStyle, part?.css]}>
      {children}
    </span>
  );
}

export function FieldError({ id, part, children }: FieldMessageProps) {
  if (!isRenderable(children)) return null;
  return (
    <span id={id} role="alert" className={part?.className} css={[errorStyle, part?.css]}>
      {children}
    </span>
  );
}
