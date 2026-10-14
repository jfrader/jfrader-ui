# Private Intl consolidation

Baseline: `c92d7ff` (`origin/master` when this branch started). All locations in the inventory below refer to that baseline, before imports and extractions shifted lines. Paths are relative to `packages/ui/src/`; component paths omit the `components/` prefix. Production sources were searched for Intl constructors, Date construction/parsing, epoch conversions, locale casing, padding and fixed-precision formatting. Story fixtures are not production policy.

## Shared implementation

`utils/intl.ts` owns timestamp validation/parsing, epoch bounds, browser default locale lookup, locale/time-zone validation and warning text, UTC fallback, signed relative-unit selection, `numeric: 'auto'` relative formatting, and the native number/date formatter entry points. Number options also cover units, percentages and currency. Number/date factories forward options unchanged: undefined locale remains the runtime's Intl default, invalid tags/options still throw, locale extensions remain effective, and no implicit UTC or digit/hour policy is added.

All production NumberFormat and DateTimeFormat constructions now enter through that module. Component-specific options stay at their owners: they are different contracts, not defaults to make uniform. Thread core re-exports its existing private helper names; Calendar utilities re-export `defaultLocale`, preserving their existing internal callers. No package export, prop, type contract or clock ownership changed. No game component changed.

## Timestamp and calendar inventory

| Baseline site | Policy and disposition |
| --- | --- |
| `thread/thread-core.ts:68–106` | UTC default; finite epochs within ±8.64e15; Date.getTime; timezone-bearing four-digit ISO; round-trip month/day validation before Date.parse. Extracted unchanged. Includes native acceptance of 24:00 and arbitrary fractional precision. |
| `timeline/timeline.tsx:151–192` | Same epoch bounds, ISO pattern and impossible-date check. Uses shared parser. Typed timestamp inputs preserved; shared parser also guards unknown non-string values. |
| `thread/thread-core.ts:109–115` | Signed relative delta, truncation, largest whole unit: mean Gregorian year/month, week, day, hour, minute, then seconds. Moved unchanged. |
| `thread/thread-core.ts:117–145` | Caller locale and zone; canonical-tag validation (not forced canonicalization); invalid locale → Intl default, invalid zone → UTC, owner-prefixed diagnostics. Full date + short time, locale-selected hour cycle; relative numeric:auto; default numbers/plurals, conjunction names, short unit facts. Shared validation/factories; list/plural styles retained. |
| `thread/thread-parts.tsx:79–128` | Caller-owned now; parsed timestamp; signed relative visible text and full-date accessible text; valid epoch converted to ISO datetime via new Date. Invalid input has owner label and no time element. No new clock/timer. |
| `timeline/timeline.tsx:195–231` | Same validation/fallback as threads. Machine day parts en-US, Gregorian, Latin digits, explicit zone; display day full, full timestamp full/long, clock short, relative auto. Shared factories/validation, different full-time style retained. |
| `timeline/timeline.tsx:235–259` | ISO day-key padding from formatToParts; Date.parse of UTC midnight divided by 86,400,000 for civil day ordinal; zone-aware grouping and sorting. Machine identifiers/arithmetic, not localized presentation. Retained. |
| `timeline/timeline.tsx:274–287,867` | Relative same-day seconds/minutes/hours with truncation; farther spans use calendar-day distance, not elapsed 24-hour days; yesterday/today/tomorrow headings or full day. ISO datetime serialization. Retained rather than replacing with thread elapsed-unit policy. |
| `chat-thread/chat-thread.tsx:468–479` | Display full day uses resolved thread locale/zone. Machine keys explicitly use en-US-u-ca-iso8601-nu-latn plus numeric year/two-digit month/day. Shared date factory; ISO calendar key contract retained rather than Timeline's Gregorian key formatter. |
| `chat-message/chat-message.tsx`, `comment-thread/comment-thread.tsx`, `chat-thread/chat-thread.tsx` | Existing consumers of thread core/time shell, not independent parsers. Resolve locale/zone through existing adapters. CommentThread creation uses valid caller now or Date.now (`comment-thread:713`). |
| `countdown/countdown.tsx:56–105` | Finite ±8.64e15 bounds now share validEpoch; system Date.now clock; strict ISO field checks: hours ≤23, seconds ≤59, fractions 1–3 digits, offset fields checked and literal years 0–99. Date-based last-day validation, Date.parse, Date.getTime. Deliberately stricter than threads (rejects 24:00); parser retained. |
| `calendar/calendar.utils.ts:14–68` | Date-only Gregorian UTC arithmetic, literal years 0–99 via setUTCFullYear, ISO round trips, day/month shifting/clamping and weekday columns. String padding encodes machine values, not human date names. Retained. |
| `calendar/calendar.utils.ts:91–108` | Intl.Locale week info and Sunday fallback; UTC/Gregorian month long + numeric year, day numeric, date long, weekday short/long. Navigator.language when available, otherwise Intl default. Shared date factory and extracted locale lookup; week policy retained. |
| `calendar/calendar.tsx:221–229` | Local Date fields for today; resolved locale uses prop ?? browser default and civil UTC/Gregorian options. Formatter options and browser/server lookup behavior unchanged. |
| `date-picker/date-picker.tsx:155–187,242–245` | Own civil-date round trip with literal years, local today; duplicated navigator lookup extracted. Resolved locale uses native DateTimeFormat with no options; visible date is UTC/Gregorian medium. Placeholder uses Intl.DisplayNames(dateTimeField) and formatter parts at epoch zero. Deliberate civil-date parser retained. |
| `date-range-picker/date-range-picker.tsx:111,281–289,503–506,860–861` | Calendar civil helpers/default locale; inclusive days from UTC epochs; local today; resolved UTC/Gregorian locale; medium formatRange; default numeric day count. Shared date/number factories; range arithmetic and formatRange retained. |
| `activity-rings/activity-rings.tsx:714–716` | Valid ISO civil dates from Calendar; UTC/Gregorian full date, short weekday, numeric day with supplied locale. Shared date factory; date-only semantics retained. |
| `time-picker/time-picker.tsx:79–83,213–218,236,258` | Civil HH:mm parsing/padding; minutes × milliseconds/minute creates an epoch for display only; UTC hour numeric/minute two-digit; optional explicit hourCycle, otherwise locale choice. Shared date factory; no timezone timestamp parser applied. |
| `sortable-data-table/sortable-data-table.tsx:190–199,242–247` | Invalid Date.getTime treated as missing; Date values compare by epoch. Caller dateFormatOptions, optional truthy timeZone overrides them; absent zone remains native local zone. Shared number/date factories; sorting and missing-value policy retained. |

## Number, unit and list inventory

Except where noted, locale is the component's optional `locale` prop, undefined means native Intl default, and invalid locale/options retain native exceptions. Number formatting has no time zone or hour-cycle setting. Locations with multiple calls list each baseline line.

| Baseline site | Policy |
| --- | --- |
| `utils/attachment.ts:18–32` | Shared ChatMessage/ChatThread/AttachmentList file size: nonfinite/negative → zero; decimal byte/kilobyte/megabyte thresholds, maximum fraction digits 1, native default unitDisplay. Number factory rewired; normalization/scaling unchanged. |
| `file-dropzone/file-dropzone.tsx:252–260,608` | Decimal logarithmic scaling through its byteUnits list, short unitDisplay, maximum fraction digits 1; progress percent with native digits. Not merged with attachment MB cap/default-width policy. |
| `usage-meter/usage-model.ts:30–32` | Amount maximum fraction digits 1 then caller overrides; percent maximum fraction digits 0; index maximum fraction digits 0. Also used by ActivityRings. |
| `metric-card/metric-card.tsx:127,131–134` | Finite primary number with caller options; delta caller options with signDisplay forced exceptZero at zero, always otherwise; owner missing-value label. |
| `toggle-subscription/toggle-subscription.tsx:380–390` | Canonical locale tags serialized into memo key; caller options then forced currency style/currency. Own finite price/previous-price validation and memoization retained. |
| `countdown/countdown.tsx:130–154,443–448` | Spoken seconds long units; optional Intl.DurationFormat long units, otherwise long conjunction ListFormat of long unit numbers. Display unit numbers use caller unitDisplay, minimumIntegerDigits 2 and useGrouping false. Number factories rewired; duration feature detection and list policy retained. |
| `now-playing/now-playing.tsx:237–258` | Caller-bounded seconds floored into hours/minutes/seconds; optional Intl.DurationFormat digital output, otherwise short unit numbers joined by short unit ListFormat, always including seconds. Different from Countdown spoken long conjunction/DurationFormat. |
| `hold-to-confirm/hold-to-confirm.tsx:349–355` | Duration converted ms→seconds, long unit, maximum fraction digits 3, significant digits 3 when duration<1. |
| `typewriter-terminal/typewriter-terminal.tsx:451,456–459,467,586,821` | Seconds maximum fraction digits 1; percent maximum fraction digits 0; ms→seconds with existing literal `s` in readout/announcement. Not changed to translated unit text because this is output-preserving work. |
| `bottom-sheet/bottom-sheet.tsx:360` | Detent fraction as percent, native default digits; caller getValueText override retained. |
| `resizable-panels/resizable-panels.tsx:484` | Percent maximum fraction digits 0. toFixed(5) at :490 is internal layout identity, not visible text. |
| `image-compare/image-compare.tsx:105–109,373` | Percent with maximum fraction digits 2. toPrecision at :307 quantizes values, not formatted text. |
| `lightbox-gallery/lightbox-gallery.tsx:402,404,980` | Default item/count numbers; zoom percent maximum fraction digits 0. |
| `photo-grid/photo-grid.tsx:962` | Default count numbers; English plural rules at :148 serve English labels independently of display digits. toFixed(1) at :1274–1275 creates CSS transform-origin percentages. |
| `pagination/pagination.tsx:134,144` | Prop default is navigator.language, server undefined; duplicated lookup replaced with defaultLocale; default numeric pages. |
| `carousel/carousel.tsx:358` | Default numeric slide index/count. |
| `chip-group/chip-group.tsx:358` | Default numeric hidden count passed to caller moreLabel. |
| `code-block/code-block.tsx:208,277` | Default numeric line counts; English plural rules for English copy retained. |
| `hover-card/hover-card.tsx:583` | Default numeric stats, formatter only constructed when a stat is numeric; strings unchanged. |
| `tag-input/tag-input.tsx:128` | Default numeric tag limit. |
| `avatar-group/avatar-group.tsx:55,177` | Default numeric hidden/total counts; English plural rules for default English label callbacks. Local formatter binding renamed only to avoid imported function collision. |
| `announcement-bar/announcement-bar.tsx:378` | Default numeric position/count; caller message-label override retained. |
| `attachment-list/attachment-list.tsx:94–95` | Default numeric overflow count and caller-locale plural rules. |
| `reaction-group/reaction-group.tsx:48–49` | Default numeric reaction counts and caller-locale plural rules. |
| `json-viewer/json-viewer.tsx:489–490` | Default numeric counts and caller-locale plural rules. |
| `stepper/stepper.tsx:475` | Default numeric step positions/counts passed to label callbacks. |
| `filter-toolbar/filter-toolbar.tsx:90,290` | Default numeric finite nonnegative integer result count; English plural rules for English copy; owner unknown/loading labels. |
| `multi-select/multi-select.tsx:279–285` | Default ListFormat, NumberFormat and PluralRules; search Collator sensitivity base. Number construction centralized, other policies retained. |
| `mention-input/mention-input.tsx:139,425–433` | Default-message native-locale number/plural pair; current component-locale number/plural pair; search Collator base and grapheme Segmenter. Number constructions centralized, others retained. |
| `toast-stack/toast-stack.tsx:267` | Overflow default numeric count with no locale prop; native runtime default retained. |
| `slider/use-slider-interaction.ts:64` | Caller locale and full formatOptions; caller formatValue receives actual Intl.NumberFormat instance. No wrapper around instance or formatted-value behavior. |
| `link-unfurl/link-unfurl.tsx:587` | Short unit ListFormat for metadata. Retained. |
| `thread/thread-core.ts:122–124`, `timeline/timeline.tsx:210` | Caller-locale plural rules; thread conjunction people and short unit facts. Retained, not replaced with English rules or another list style. |

## Search/segmentation and other deliberate exceptions

These are locale-related but not date/number formatting defaults; sensitivity, tokenization and English grammar are owner contracts. They remain native operations rather than adding policy-free wrappers.

- `select/select.tsx:76`: runtime-default search Collator, base sensitivity.
- `tree-view/tree-view.tsx:228`: caller-locale search Collator, base sensitivity.
- `tag-input/tag-input.tsx:348`: caller-locale search Collator, accent sensitivity (different duplicate-token contract).
- `sortable-data-table/sortable-data-table.tsx:247`: caller-locale Collator, numeric ordering and base sensitivity.
- `multi-select/multi-select.tsx:282`: caller-locale search Collator, base sensitivity.
- `mention-input/mention-input.tsx:432–433`: caller-locale search Collator base and grapheme Segmenter.
- `typewriter-terminal/typewriter-terminal.tsx:322`: caller-locale grapheme Segmenter.
- `command-palette/command-palette.tsx:76,78`: English plural rules; native-default locale casing for search.
- `combobox/combobox.tsx:90`: native-default locale lowercase matching.
- `thread/thread-parts.tsx:401–406`: caller-locale lowercase prefix matching.
- `json-viewer/json-viewer.tsx:817`: caller-locale lowercase typeahead.
- `calendar/calendar.utils.ts:91`, `date-picker/date-picker.tsx:185`: Intl.Locale week data and Intl.DisplayNames fields, respectively.

Date.now in announcement rotation, JSON/tree typeahead and game flight TTLs is scheduling, not timestamp presentation. Animation-duration and velocity ms↔seconds arithmetic is likewise not human formatting. CSS percentages, ID hashing and ISO/HH:mm serialization must remain ASCII machine values. The held game folders were inventoried only; their files were not changed.

## Identity evidence and gates

- Exact rendered-string assertions added to Timeline Default (`5 minutes ago`, `today`, `yesterday`, full day) and ChatThread InvalidDate (`tomorrow`), alongside existing localized/time-zone/DST/invalid-input tests.
- Timeline SSRConsistency exercises shared parsing/bounds/invalid dates/offsets, 24:00 and literal year 0099, exact fallback diagnostics, signed relative strings, native exception behavior, and byte equality of date/relative/number strings, number parts and resolved options across en-US/en-GB/es-ES/ar-EG/ja-JP/runtime-default locales, zones, currency/percent/unit options and nonfinite numbers.
- No blanket cross-ICU-version equality promise: comparisons hold within the same runtime and inputs. Different engines may legitimately ship different locale data.
- Independent baseline comparison against `c92d7ff` thread core passed 579 exact comparisons: accepted/rejected timestamps, diagnostic arrays, resolved full formatter options, full strings and relative-unit boundaries across locales/locale extensions/zones/invalid inputs. This was a scratch verification, not an additional repository test runner.
- `pnpm typecheck`: passed, including 22 guide examples. Focused Timeline/ChatThread: 66/66 passed. Countdown and EditableDetails passed in the focused follow-up.
- `pnpm build`, `pnpm verify:exports` (113 exports), token/UI package builds, and rendered `verify:docs:layout`: passed. Storybook build includes `verify:docs`.
- Full `pnpm test`: first run 2946/2948 passed, with EditableDetails Action State Form and TimePicker Every Step failures; one full retry 2947/2948 passed, with only TimePicker Every Step exceeding 15 seconds. Focused follow-up still reproduced that timeout. Restoring TimePicker's exact baseline source (`git diff --exit-code HEAD -- .../time-picker.tsx`) and rerunning Every Step also exceeded 15 seconds, establishing that the timeout occurs without this refactor. No timeout/retry settings or unrelated test logic were changed. The full local test gate is not green.
- CI status is recorded separately in the PR. Manual screen-reader testing is not part of this internal refactor's verification.
- Diagnostic only: TimePicker Every Step passed with a one-off CLI `--testTimeout 60000`; this does not turn the unchanged 15-second gate green.

Native option/locale behavior was checked against the current [Intl.DateTimeFormat reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat). Existing ICU data and native constructors remain the implementation, not handwritten locale tables.
