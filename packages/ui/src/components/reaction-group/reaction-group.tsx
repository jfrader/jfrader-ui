'use client';

import { useId, useMemo, type ComponentPropsWithRef } from 'react';
import type { SxProps } from '../../styling/sx';
import { numberFormatter } from '../../utils/intl';
import { useControlledState } from '../../utils/use-controlled-state';
import { uniqueBy } from '../thread/thread-core';
import { ReactionGroupView, type ReactionGroupLabels } from './reaction-group-view';

export type { ReactionGroupLabels } from './reaction-group-view';

export interface ReactionCount {
  emoji: string;
  count: number;
  mine?: boolean;
}

export interface ReactionGroupProps extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'onSelect' | 'onToggle'>, SxProps {
  /** Reaction counts and the current user's pressed states. Update these after a toggle request. */
  counts: readonly ReactionCount[];
  /** Emoji offered by the picker. An empty array hides the add button. */
  offeredReactions?: readonly string[];
  /** Called when an existing pill is activated. */
  onToggle?: (emoji: string) => void;
  /** Called when an emoji is chosen from the picker. Defaults to `onToggle`. */
  onSelect?: (emoji: string) => void;
  /** Render counts as text without controls. */
  readOnly?: boolean;
  /** Disable reaction changes and opening the picker. An open picker can still close. */
  disabled?: boolean;
  /** Locale used to format counts. */
  locale?: Intl.LocalesArgument;
  /** Controlled picker visibility. */
  pickerOpen?: boolean;
  /** Initial picker visibility. Defaults to false. */
  defaultPickerOpen?: boolean;
  /** Request a picker visibility change. */
  onPickerOpenChange?: (open: boolean) => void;
  /** Translate control names and reaction counts. */
  labels?: Partial<ReactionGroupLabels>;
}

export function ReactionGroup({
  counts, offeredReactions = [], onToggle, onSelect, readOnly = false, disabled = false,
  locale, pickerOpen: openProp, defaultPickerOpen = false, onPickerOpenChange,
  labels: labelProps, className, sx, ...rootProps
}: ReactionGroupProps) {
  const id = useId();
  const number = useMemo(() => numberFormatter(locale), [locale]);
  const plural = useMemo(() => new Intl.PluralRules(locale), [locale]);
  const labels: ReactionGroupLabels = {
    addReaction: 'Add reaction', closeReactions: 'Close reactions', reactions: 'Reactions',
    reactWith: (emoji) => `React with ${emoji}`,
    reactionCount: (emoji, count, mine) => `${emoji} ${number.format(count)} ${plural.select(count) === 'one' ? 'reaction' : 'reactions'}${mine ? ', including you' : ''}`,
    ...labelProps,
  };
  const [open = false, requestOpen] = useControlledState(openProp, defaultPickerOpen, onPickerOpenChange);
  return (
    <ReactionGroupView
      {...rootProps}
      className={className}
      sx={sx}
      counts={uniqueBy(counts, (reaction) => reaction.emoji)}
      offered={uniqueBy(offeredReactions, (emoji) => emoji)}
      number={number}
      labels={labels}
      readOnly={readOnly}
      disabled={disabled}
      pickerOpen={open}
      onPickerOpenChange={requestOpen}
      onToggle={(emoji) => onToggle?.(emoji)}
      onSelect={(emoji) => (onSelect ?? onToggle)?.(emoji)}
      pickerId={`${id}-picker`}
    />
  );
}

ReactionGroup.displayName = 'ReactionGroup';
