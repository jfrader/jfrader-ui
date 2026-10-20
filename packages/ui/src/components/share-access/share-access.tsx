'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
} from 'react';
import { MotionConfig, motion, useReducedMotion } from 'motion/react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { useControlledState } from '../../utils/use-controlled-state';
import { Avatar } from '../avatar';
import { Button, type ButtonProps } from '../button';
import { Combobox, type ComboboxInputProps } from '../combobox';
import { Select, type SelectEasyProps } from '../select';
import { ShareSheet, type ShareSheetProps } from '../share-sheet';

export type ShareRole = 'editor' | 'commenter' | 'viewer';
export type ShareGeneralAccess = 'restricted' | 'link';
export interface ShareAccessContact {
  email: string;
  name?: string;
  src?: string;
}
export interface ShareAccessMember extends ShareAccessContact {
  id: string;
  role: 'owner' | ShareRole;
  pending?: boolean;
}
export interface ShareAccessEvent {
  type:
    | 'chip-added'
    | 'chip-removed'
    | 'invite-started'
    | 'invite-succeeded'
    | 'invite-failed'
    | 'member-role'
    | 'member-removed'
    | 'member-restored'
    | 'invite-role'
    | 'access'
    | 'link-role'
    | 'copied'
    | 'copy-failed';
  name?: string;
  role?: ShareRole;
}
export interface ShareAccessMessages {
  noResults: string;
  inviteLabel: string;
  inviteAction: string;
  sending: string;
  invalidEmail: string;
  inviteFailed: string;
  duplicateEmail: string;
  owner: string;
  self: string;
  pending: string;
  copy: string;
  copied: string;
  copyFailed: string;
  done: string;
  undo: string;
  dismissUndo: string;
  people: string;
  chips: string;
  removed: string;
  inviteRole: string;
  linkRole: string;
  access: string;
  roles: Record<ShareRole, string>;
  accessLabels: Record<ShareGeneralAccess, string>;
  heading: (title: string) => string;
  remove: (name: string) => string;
  roleFor: (name: string, role: ShareRole) => string;
  announce: (event: ShareAccessEvent) => string;
}
type NativeSlot<E extends 'section' | 'ul' | 'div'> = ComponentPropsWithRef<E> & SxProps;
type ActionSlot = Omit<ButtonProps, 'sx'> & SxProps;
type RoleSlot = Omit<SelectEasyProps, 'sx' | 'options'> & SxProps;
export interface ShareAccessSlotProps {
  root?: NativeSlot<'section'>;
  /** Uses `Combobox.Input` by default. */
  inviteField?: Omit<ComboboxInputProps, 'sx'> & SxProps;
  chipList?: NativeSlot<'ul'>;
  memberList?: NativeSlot<'ul'>;
  undoList?: NativeSlot<'ul'>;
  inviteRole?: RoleSlot;
  memberRole?: RoleSlot;
  linkRole?: RoleSlot;
  inviteButton?: ActionSlot;
  removeButton?: ActionSlot;
  undoButton?: ActionSlot;
  dismissUndoButton?: ActionSlot;
  doneButton?: ActionSlot;
  status?: NativeSlot<'div'>;
  heading?: ComponentPropsWithRef<'h2'> & SxProps;
  copyButton?: ActionSlot;
  sheet?: Omit<ShareSheetProps, 'title' | 'link' | 'people' | 'accessOptions' | 'sx'> & SxProps;
}
export interface ShareAccessSlots {
  root?: ComponentType<ComponentPropsWithRef<'section'>>;
  /** Uses `Combobox.Input` by default. */
  inviteField?: ComponentType<ComboboxInputProps>;
  chipList?: ComponentType<ComponentPropsWithRef<'ul'>>;
  memberList?: ComponentType<ComponentPropsWithRef<'ul'>>;
  undoList?: ComponentType<ComponentPropsWithRef<'ul'>>;
  inviteRole?: ComponentType<SelectEasyProps>;
  memberRole?: ComponentType<SelectEasyProps>;
  linkRole?: ComponentType<SelectEasyProps>;
  inviteButton?: ComponentType<ButtonProps>;
  removeButton?: ComponentType<ButtonProps>;
  undoButton?: ComponentType<ButtonProps>;
  dismissUndoButton?: ComponentType<ButtonProps>;
  doneButton?: ComponentType<ButtonProps>;
  status?: ComponentType<ComponentPropsWithRef<'div'>>;
  heading?: ComponentType<ComponentPropsWithRef<'h2'>>;
  copyButton?: ComponentType<ButtonProps>;
  sheet?: ComponentType<ShareSheetProps>;
}
export interface ShareAccessProps
  extends
    Omit<ComponentPropsWithRef<'section'>, 'title' | 'defaultValue' | 'onChange' | 'children'>,
    SxProps {
  /** Names the shared resource in the heading. */
  title: string;
  /** Sets the sharing URL copied by the copy action. */
  link: string;
  /** Controls the members with access and their roles. */
  value?: readonly ShareAccessMember[];
  /** Sets the initial members when uncontrolled. Defaults to an empty list. */
  defaultValue?: readonly ShareAccessMember[];
  /** Receives members after invitations, role changes, removals or undo. */
  onValueChange?: (next: ShareAccessMember[]) => void;
  /** Controls whether access is restricted or available through the link. */
  access?: ShareGeneralAccess;
  /** Sets initial general access when uncontrolled. Defaults to `restricted`. */
  defaultAccess?: ShareGeneralAccess;
  /** Receives changes to general access. */
  onAccessChange?: (next: ShareGeneralAccess) => void;
  /** Controls the role granted to anyone with the link. */
  linkRole?: ShareRole;
  /** Sets the initial link role when uncontrolled. Defaults to `viewer`. */
  defaultLinkRole?: ShareRole;
  /** Receives changes to the link role. */
  onLinkRoleChange?: (next: ShareRole) => void;
  /** Controls the role assigned to new invitations. */
  inviteRole?: ShareRole;
  /** Sets the initial invitation role when uncontrolled. Defaults to `editor`. */
  defaultInviteRole?: ShareRole;
  /** Receives changes to the invitation role. */
  onInviteRoleChange?: (next: ShareRole) => void;
  /** Supplies contacts suggested while entering invitation recipients. */
  directory?: readonly ShareAccessContact[];
  /** Identifies the member marked as you in the access list. */
  selfId?: string;
  /** Sends selected invitations. A rejected promise shows an error without adding members. */
  onInvite?: (people: ShareAccessContact[], role: ShareRole) => void | Promise<void>;
  /** Receives the sharing URL after a successful copy. */
  onCopyLink?: (link: string) => void;
  /** Handles the Done action. Omit to hide its button. */
  onDone?: () => void;
  /** Overrides labels, validation messages and live announcements. */
  messages?: Partial<ShareAccessMessages>;
  /** Replaces the section root. `slots.root` takes precedence. */
  component?: ShareAccessSlots['root'];
  /** Replaces sharing controls and structural parts. */
  slots?: ShareAccessSlots;
  /** Passes props to sharing controls and structural parts. */
  slotProps?: ShareAccessSlotProps;
}
const EMPTY: readonly ShareAccessMember[] = [];
const ROLES: readonly ShareRole[] = ['editor', 'commenter', 'viewer'];
const SPRING = { type: 'spring', stiffness: 420, damping: 38 } as const;
const DEFAULT_MESSAGES: ShareAccessMessages = {
  noResults: 'No matching contacts',
  inviteLabel: 'Name or email',
  inviteAction: 'Invite',
  sending: 'Sending…',
  invalidEmail: 'Enter a valid email address.',
  inviteFailed: 'Could not invite. Try again.',
  duplicateEmail: 'This email already has access or is in the invitation list.',
  owner: 'Owner',
  self: '(you)',
  pending: 'Invited',
  copy: 'Copy link',
  copied: 'Copied',
  copyFailed: 'Could not copy link. Try again.',
  done: 'Done',
  undo: 'Undo',
  dismissUndo: 'Dismiss removal',
  people: 'People with access',
  chips: 'Invitations',
  removed: 'Removed',
  inviteRole: 'Invitation role',
  linkRole: 'Link role',
  access: 'General access',
  roles: { editor: 'Editor', commenter: 'Commenter', viewer: 'Viewer' },
  accessLabels: { restricted: 'Restricted', link: 'Anyone with the link' },
  heading: (title) => `Share ${title}`,
  remove: (name) => `Remove ${name}`,
  roleFor: (name) => `Role for ${name}`,
  announce: (event) =>
    ({
      'chip-added': `Added ${event.name ?? ''}`,
      'chip-removed': `Removed ${event.name ?? ''}`,
      'invite-started': 'Sending invitations',
      'invite-succeeded': 'Invitations sent',
      'invite-failed': 'Invitations failed',
      'member-role': `Updated role for ${event.name ?? ''}`,
      'member-removed': `Removed ${event.name ?? ''}`,
      'member-restored': `Restored ${event.name ?? ''}`,
      'invite-role': 'Invitation role updated',
      access: 'General access updated',
      'link-role': 'Link role updated',
      copied: 'Copied link',
      'copy-failed': 'Could not copy link. Try again.',
    })[event.type],
};
const rootStyle = css({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '100%',
  minInlineSize: 0,
  fontFamily: vars.font.sans,
  color: vars.color.text,
});
const listStyle = css({
  display: 'grid',
  gap: vars.space[3],
  listStyle: 'none',
  margin: 0,
  padding: 0,
  minInlineSize: 0,
});
const rowStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[2],
  minInlineSize: 0,
});
// A labeled field is taller than its control; align the action to the control's bottom edge
// instead of centering it against the label.
const inviteRowStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  gap: vars.space[2],
  minInlineSize: 0,
});
// Every member row keeps one height even when only some rows carry a role picker.
const memberRowStyle = css({
  minBlockSize: vars.space[12],
});
const identityStyle = css({
  flex: '1 1 8rem',
  minInlineSize: 0,
  overflowWrap: 'anywhere',
  fontSize: vars.textSize.sm,
});
const errorStyle = css({
  margin: 0,
  color: vars.color.dangerText,
  fontSize: vars.textSize.sm,
});
const chipStyle = css({
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  paddingInline: vars.space[2],
  '&[data-selected=true]': { outline: `2px solid ${vars.color.focusRing}` },
});
const sheetStyle = css({ display: 'block', inlineSize: '100%' });
const key = (email: string) => email.trim().toLocaleLowerCase('en-US');
interface Removal {
  member: ShareAccessMember;
  before?: string;
  after?: string;
}
interface DraftContact extends ShareAccessContact {
  invalid: boolean;
}
function validEmail(email: string, document: Document) {
  const validator = document.createElement('input');
  validator.type = 'email';
  validator.value = email;
  return !!validator.value && validator.validity.valid;
}

/** Manage people and link permissions inside a host Dialog or Popover. The host owns visibility. */
export function ShareAccess({
  title,
  link,
  value,
  defaultValue = EMPTY,
  onValueChange,
  access: accessProp,
  defaultAccess = 'restricted',
  onAccessChange,
  linkRole: linkRoleProp,
  defaultLinkRole = 'viewer',
  onLinkRoleChange,
  inviteRole: inviteRoleProp,
  defaultInviteRole = 'editor',
  onInviteRoleChange,
  directory = [],
  selfId,
  onInvite,
  onCopyLink,
  onDone,
  messages,
  component,
  slots = {},
  slotProps = {},
  className,
  sx,
  ...props
}: ShareAccessProps) {
  const text = { ...DEFAULT_MESSAGES, ...messages };
  const [members = EMPTY, requestMembers] = useControlledState<readonly ShareAccessMember[]>(
    value,
    defaultValue,
    (next) => onValueChange?.([...next]),
  );
  const [access = 'restricted', requestAccess] = useControlledState(
    accessProp,
    defaultAccess,
    onAccessChange,
  );
  const [inviteRole = 'editor', requestInviteRole] = useControlledState(
    inviteRoleProp,
    defaultInviteRole,
    onInviteRoleChange,
  );
  const [linkRole = 'viewer', requestLinkRole] = useControlledState(
    linkRoleProp,
    defaultLinkRole,
    onLinkRoleChange,
  );
  const [query, setQuery] = useState('');
  const [chips, setChips] = useState<DraftContact[]>([]);
  const [selectedChip, setSelectedChip] = useState(false);
  const [suggestions, setSuggestions] = useState(false);
  const [removals, setRemovals] = useState<Removal[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLElement | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const latestMembers = useRef(members);
  const skipLabel = useRef(false);
  const awaiting = useRef<{
    matches: (list: readonly ShareAccessMember[]) => boolean;
    event: ShareAccessEvent;
    emails?: string[];
  } | null>(null);
  const scalarRequests = useRef<Partial<Record<'access' | 'invite-role' | 'link-role', string>>>(
    {},
  );
  const focusUndo = useRef<string | null>(null);
  const focusMember = useRef<string | null>(null);
  const reduced = useReducedMotion();
  const rootRef = useMergeRefs([root, props.ref, slotProps.root?.ref]);
  const inputRef = useMergeRefs([input, slotProps.inviteField?.ref]);
  useLayoutEffect(() => {
    latestMembers.current = members;
  }, [members]);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  useLayoutEffect(() => {
    const axes = { access, 'invite-role': inviteRole, 'link-role': linkRole };
    for (const axis of ['access', 'invite-role', 'link-role'] as const) {
      if (scalarRequests.current[axis] === axes[axis]) {
        delete scalarRequests.current[axis];
        setStatus(text.announce({ type: axis }));
      }
    }
    const request = awaiting.current;
    if (request?.matches(members)) {
      awaiting.current = null;
      setStatus(text.announce(request.event));
      if (request.emails)
        setChips((draft) => draft.filter((person) => !request.emails!.includes(key(person.email))));
    }
    if (focusUndo.current && !members.some((member) => member.id === focusUndo.current)) {
      root.current
        ?.querySelector<HTMLElement>(`[data-undo-id="${CSS.escape(focusUndo.current)}"]`)
        ?.focus();
      focusUndo.current = null;
    }
    if (focusMember.current && members.some((member) => member.id === focusMember.current)) {
      root.current
        ?.querySelector<HTMLElement>(`[data-member-id="${CSS.escape(focusMember.current)}"] button`)
        ?.focus();
      focusMember.current = null;
    }
  }, [members, access, inviteRole, linkRole, text.announce]);
  const announce = (event: ShareAccessEvent) => setStatus(text.announce(event));
  const mutate = (
    next: ShareAccessMember[],
    event: ShareAccessEvent,
    matches: (list: readonly ShareAccessMember[]) => boolean,
  ) => {
    awaiting.current = { matches, event };
    requestMembers(next);
  };
  const add = (person: ShareAccessContact) => {
    if (pending) return;
    if ([...members, ...chips].some((item) => key(item.email) === key(person.email))) {
      setError(text.duplicateEmail);
      return;
    }
    const document = input.current?.ownerDocument;
    setChips((items) => [
      ...items,
      { ...person, invalid: document ? !validEmail(person.email, document) : false },
    ]);
    setQuery('');
    setSelectedChip(false);
    setSuggestions(false);
    setError('');
    announce({ type: 'chip-added', name: person.email });
  };
  const tokenize = () => {
    const draft = query.trim();
    if (!draft) return;
    const contact = directory.find(
      (person) =>
        key(person.email) === key(draft) ||
        person.name?.toLocaleLowerCase() === draft.toLocaleLowerCase(),
    );
    add(contact ?? { email: draft });
  };
  const removeChip = (person: ShareAccessContact) => {
    if (pending) return;
    setChips((draft) => draft.filter((item) => item !== person));
    setSelectedChip(false);
    announce({ type: 'chip-removed', name: person.email });
    input.current?.focus();
  };
  const invite = async () => {
    if (busy.current || !chips.length) return;
    const document = input.current?.ownerDocument;
    if (!document) return;
    if (chips.some((person) => !validEmail(person.email, document))) {
      setError(text.invalidEmail);
      return;
    }
    if (
      chips.some((person) =>
        latestMembers.current.some((member) => key(member.email) === key(person.email)),
      )
    ) {
      setError(text.duplicateEmail);
      return;
    }
    const submitted = chips.map(({ invalid: _invalid, ...person }) => person);
    const role = inviteRole;
    const token = generation.current;
    busy.current = true;
    setPending(true);
    setError('');
    announce({ type: 'invite-started' });
    try {
      await onInvite?.(submitted, role);
      if (token !== generation.current) return;
      const emails = submitted.map((person) => key(person.email));
      const next = [...latestMembers.current];
      for (const person of submitted)
        if (!next.some((member) => key(member.email) === key(person.email)))
          next.push({
            ...person,
            id:
              typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `member-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            role,
            pending: true,
          });
      awaiting.current = {
        emails,
        event: { type: 'invite-succeeded' },
        matches: (list) =>
          emails.every((email) => list.some((member) => key(member.email) === email)),
      };
      requestMembers(next);
    } catch {
      if (token === generation.current) {
        setError(text.inviteFailed);
        setStatus('');
      }
    } finally {
      if (token === generation.current) {
        busy.current = false;
        setPending(false);
      }
    }
  };
  const remove = (member: ShareAccessMember, button: HTMLButtonElement) => {
    if (member.role === 'owner') return;
    const index = members.findIndex((item) => item.id === member.id);
    setRemovals((queue) =>
      queue.some((item) => item.member.id === member.id)
        ? queue
        : [
            ...queue,
            {
              member,
              before: members[index - 1]?.id,
              after: members[index + 1]?.id,
            },
          ],
    );
    if (button.ownerDocument.activeElement === button) focusUndo.current = member.id;
    mutate(
      members.filter((item) => item.id !== member.id),
      { type: 'member-removed', name: member.name ?? member.email },
      (list) => !list.some((item) => item.id === member.id),
    );
  };
  const undo = (removal: Removal, button: HTMLButtonElement) => {
    const member = removal.member;
    if (members.some((item) => item.id === member.id || key(item.email) === key(member.email)))
      return;
    const next = [...members];
    const after = next.findIndex((item) => item.id === removal.after);
    const before = next.findIndex((item) => item.id === removal.before);
    next.splice(after >= 0 ? after : before >= 0 ? before + 1 : next.length, 0, member);
    if (button.ownerDocument.activeElement === button) focusMember.current = member.id;
    mutate(next, { type: 'member-restored', name: member.name ?? member.email }, (list) =>
      list.some((item) => item.id === member.id),
    );
  };
  const Root = slots?.root ?? component ?? 'section';
  const Field = slots?.inviteField ?? Combobox.Input;
  const ChipList = slots?.chipList ?? 'ul';
  const MemberList = slots?.memberList ?? 'ul';
  const UndoList = slots?.undoList ?? 'ul';
  const InviteRole = slots?.inviteRole ?? Select;
  const MemberRole = slots?.memberRole ?? Select;
  const LinkRole = slots?.linkRole ?? Select;
  const Invite = slots?.inviteButton ?? Button;
  const Remove = slots?.removeButton ?? Button;
  const Undo = slots?.undoButton ?? Button;
  const Dismiss = slots?.dismissUndoButton ?? Button;
  const Done = slots?.doneButton ?? Button;
  const Status = slots?.status ?? 'div';
  const Sheet = slots?.sheet ?? ShareSheet;
  const roles = ROLES.map((role) => ({ value: role, label: text.roles[role] }));
  const rootProps = {
    ...props,
    ...slotProps.root,
    style: { ...props.style, ...slotProps.root?.style },
  };
  return (
    <MotionConfig reducedMotion="user">
      <WithSx
        className={[className, slotProps.root?.className].filter(Boolean).join(' ')}
        styles={[rootStyle, slotProps.root?.sx]}
        sx={sx}
      >
        {(resolved) => (
          <Root
            {...rootProps}
            ref={rootRef}
            className={resolved}
            data-ui="share-access"
            aria-label={rootProps['aria-label'] ?? text.heading(title)}
            aria-labelledby={[rootProps['aria-labelledby'], `${id}-heading`]
              .filter(Boolean)
              .join(' ')}
            aria-describedby={
              [rootProps['aria-describedby'], error && `${id}-error`].filter(Boolean).join(' ') ||
              undefined
            }
          >
            <Sheet
              {...withoutSx(slotProps.sheet)}
              title={title}
              link={link}
              people={[]}
              presentation="inline"
              css={[sheetStyle, slotProps.sheet?.sx]}
              slots={{
                ...slotProps.sheet?.slots,
                title: slots?.heading ?? slotProps.sheet?.slots?.title,
                copyButton: slots?.copyButton ?? slotProps.sheet?.slots?.copyButton,
              }}
              slotProps={{
                ...slotProps.sheet?.slotProps,
                title: {
                  ...slotProps.sheet?.slotProps?.title,
                  ...slotProps.heading,
                  id: `${id}-heading`,
                },
                copyButton: {
                  ...slotProps.sheet?.slotProps?.copyButton,
                  ...slotProps.copyButton,
                },
              }}
              accessOptions={(['restricted', 'link'] as const).map((value) => ({
                value,
                label: text.accessLabels[value],
              }))}
              access={access}
              onAccessChange={(next) => {
                scalarRequests.current.access = next;
                requestAccess(next as ShareGeneralAccess);
              }}
              onCopy={() => onCopyLink?.(link)}
              messages={{
                heading: text.heading,
                copy: text.copy,
                copied: text.copied,
                copyFailed: text.copyFailed,
                sendTo: text.access,
                announce: (message) =>
                  message === text.copied
                    ? text.announce({ type: 'copied' })
                    : message === text.copyFailed
                      ? text.announce({ type: 'copy-failed' })
                      : '',
              }}
            >
              <Combobox
                value={null}
                open={suggestions && !pending}
                onOpenChange={setSuggestions}
                onInputChange={(next) => {
                  if (skipLabel.current) {
                    skipLabel.current = false;
                    setQuery('');
                    return;
                  }
                  setQuery(next);
                  setSelectedChip(false);
                }}
                onValueChange={(email) => {
                  const contact = directory.find((item) => item.email === email);
                  if (contact) {
                    skipLabel.current = true;
                    add(contact);
                  }
                }}
                filter={(label, query) =>
                  label
                    .toLocaleLowerCase()
                    .split(/\s+/)
                    .some((part) => part.startsWith(query.toLocaleLowerCase()))
                }
              >
                <Field
                  {...slotProps.inviteField}
                  ref={inputRef}
                  label={text.inviteLabel}
                  disabled={pending}
                  inputValue={query}
                  aria-invalid={!!error || chips.some((person) => person.invalid) || undefined}
                  aria-describedby={
                    [slotProps.inviteField?.['aria-describedby'], error && `${id}-error`]
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                  onKeyDown={(event) => {
                    slotProps.inviteField?.onKeyDown?.(event);
                    if (
                      event.defaultPrevented ||
                      event.nativeEvent.isComposing ||
                      event.nativeEvent.keyCode === 229
                    )
                      return;
                    if (event.key === 'Escape' && suggestions) {
                      event.preventDefault();
                      event.stopPropagation();
                      setQuery('');
                      setSuggestions(false);
                    } else if (event.key === 'Backspace' && !query && chips.length) {
                      event.preventDefault();
                      if (selectedChip) removeChip(chips[chips.length - 1]!);
                      else setSelectedChip(true);
                    } else if (
                      [',', ';', 'Tab'].includes(event.key) ||
                      (event.key === ' ' && query.includes('@'))
                    ) {
                      if (query.trim()) {
                        if (event.key !== 'Tab') event.preventDefault();
                        tokenize();
                      }
                    } else if (
                      event.key === 'Enter' &&
                      !(suggestions && event.currentTarget.getAttribute('aria-activedescendant'))
                    ) {
                      event.preventDefault();
                      if (query.trim()) tokenize();
                      else void invite();
                    }
                  }}
                />
                <Combobox.List>
                  {directory.map((person) => (
                    <Combobox.Item
                      key={person.email}
                      value={person.email}
                      textValue={`${person.name ?? ''} ${person.email}`}
                    >
                      {person.name ?? person.email} {person.name && person.email}
                    </Combobox.Item>
                  ))}
                  <Combobox.Empty>{text.noResults}</Combobox.Empty>
                </Combobox.List>
              </Combobox>
              <ChipList
                {...withoutSx(slotProps.chipList)}
                css={[rowStyle, listStyle, slotProps.chipList?.sx]}
                data-ui="share-access-chip-list"
                aria-label={text.chips}
              >
                {chips.map((person, index) => (
                  <motion.li
                    key={person.email}
                    layout={!reduced}
                    transition={SPRING}
                    css={[rowStyle, chipStyle]}
                    data-selected={selectedChip && index === chips.length - 1}
                  >
                    <span css={identityStyle}>
                      {person.email}
                      {person.invalid && <span css={errorStyle}> — {text.invalidEmail}</span>}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      aria-label={text.remove(person.email)}
                      onClick={() => removeChip(person)}
                    >
                      ×
                    </Button>
                  </motion.li>
                ))}
              </ChipList>
              <div css={inviteRowStyle}>
                <InviteRole
                  {...slotProps.inviteRole}
                  options={roles}
                  label={text.inviteRole}
                  value={inviteRole}
                  onValueChange={(next) => {
                    scalarRequests.current['invite-role'] = next;
                    requestInviteRole(next as ShareRole);
                  }}
                />
                <Invite
                  {...slotProps.inviteButton}
                  data-ui="share-access-invite"
                  aria-describedby={
                    [slotProps.inviteButton?.['aria-describedby'], error && `${id}-error`]
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                  loading={pending}
                  disabled={!chips.length || slotProps.inviteButton?.disabled}
                  onClick={(event) => {
                    slotProps.inviteButton?.onClick?.(event);
                    if (!event.defaultPrevented) void invite();
                  }}
                >
                  {pending ? text.sending : text.inviteAction}
                </Invite>
              </div>
              {error && (
                <p id={`${id}-error`} css={errorStyle} role="alert">
                  {error}
                </p>
              )}
              <MemberList
                {...withoutSx(slotProps.memberList)}
                css={[listStyle, slotProps.memberList?.sx]}
                data-ui="share-access-member-list"
                aria-label={text.people}
              >
                {members.map((member) => (
                  <motion.li
                    key={member.id}
                    layout={!reduced}
                    transition={SPRING}
                    css={[rowStyle, memberRowStyle]}
                    data-member-id={member.id}
                  >
                    <Avatar name={member.name ?? member.email} src={member.src} size="sm" />
                    <span css={identityStyle}>
                      {member.name && <strong>{member.name} </strong>}
                      {member.email} {member.id === selfId && text.self}{' '}
                      {member.pending && text.pending}
                    </span>
                    {member.role === 'owner' ? (
                      <span>{text.owner}</span>
                    ) : (
                      <>
                        <MemberRole
                          {...slotProps.memberRole}
                          options={roles}
                          label={text.roleFor(member.name ?? member.email, member.role)}
                          labelPlacement="hidden"
                          value={member.role}
                          onValueChange={(next) => {
                            const role = next as ShareRole;
                            mutate(
                              members.map((item) =>
                                item.id === member.id ? { ...item, role } : item,
                              ),
                              {
                                type: 'member-role',
                                name: member.name ?? member.email,
                                role,
                              },
                              (list) =>
                                list.some((item) => item.id === member.id && item.role === role),
                            );
                          }}
                        />
                        <Remove
                          {...slotProps.removeButton}
                          variant="ghost"
                          aria-label={text.remove(member.name ?? member.email)}
                          onClick={(event) => {
                            slotProps.removeButton?.onClick?.(event);
                            if (!event.defaultPrevented) remove(member, event.currentTarget);
                          }}
                        >
                          ×
                        </Remove>
                      </>
                    )}
                  </motion.li>
                ))}
              </MemberList>
              <UndoList
                {...withoutSx(slotProps.undoList)}
                css={[listStyle, slotProps.undoList?.sx]}
                data-ui="share-access-undo-list"
                aria-label={text.removed}
              >
                {removals
                  .filter(({ member }) => !members.some((item) => item.id === member.id))
                  .map((removal) => (
                    <li key={removal.member.id} css={rowStyle}>
                      <span css={identityStyle}>{removal.member.name ?? removal.member.email}</span>
                      <Undo
                        {...slotProps.undoButton}
                        data-undo-id={removal.member.id}
                        onClick={(event) => {
                          slotProps.undoButton?.onClick?.(event);
                          if (!event.defaultPrevented) undo(removal, event.currentTarget);
                        }}
                      >
                        {text.undo}
                      </Undo>
                      <Dismiss
                        {...slotProps.dismissUndoButton}
                        variant="ghost"
                        aria-label={`${text.dismissUndo}: ${removal.member.email}`}
                        onClick={(event) => {
                          slotProps.dismissUndoButton?.onClick?.(event);
                          if (!event.defaultPrevented) {
                            setRemovals((items) => items.filter((item) => item !== removal));
                            input.current?.focus();
                          }
                        }}
                      >
                        ×
                      </Dismiss>
                    </li>
                  ))}
              </UndoList>
              {access === 'link' && (
                <LinkRole
                  {...slotProps.linkRole}
                  options={roles}
                  label={text.linkRole}
                  value={linkRole}
                  onValueChange={(next) => {
                    scalarRequests.current['link-role'] = next;
                    requestLinkRole(next as ShareRole);
                  }}
                />
              )}
            </Sheet>
            {onDone && (
              <Done
                {...slotProps.doneButton}
                onClick={(event) => {
                  slotProps.doneButton?.onClick?.(event);
                  if (!event.defaultPrevented) onDone();
                }}
              >
                {text.done}
              </Done>
            )}
            <Status
              {...withoutSx(slotProps.status)}
              data-ui="share-access-status"
              css={[visuallyHiddenStyle, slotProps.status?.sx]}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {status}
            </Status>
          </Root>
        )}
      </WithSx>
    </MotionConfig>
  );
}
ShareAccess.displayName = 'ShareAccess';
