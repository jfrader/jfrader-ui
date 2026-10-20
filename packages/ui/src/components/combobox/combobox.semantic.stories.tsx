import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { Combobox, type ComboboxEasyProps, type ComboboxOption } from './index';

const Frame = styled.div({ inlineSize: `min(24rem, calc(100vw - ${vars.space[8]}))`, maxInlineSize: '100%' });
const Result = styled.span({ display: 'grid', gap: vars.space[1], whiteSpace: 'normal', overflowWrap: 'anywhere' });
const Detail = styled.span({ color: vars.color.textMuted, fontSize: vars.textSize.sm, fontFamily: vars.font.sans });
const score = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 0 });
const documents = [
  { id: 'drafts', title: 'Draft recovery', source: 'Editor guide', score: 0.94 },
  { id: 'history', title: 'Version history', source: 'Workspace guide', score: 0.87 },
  { id: 'export', title: 'Export a backup', source: 'Account guide', score: 0 },
] as const;
const options: readonly ComboboxOption[] = documents.map((document) => ({
  value: document.id,
  textValue: document.title,
  label: <Result><span>{document.title}</span><Detail>{document.source} · Match {score.format(document.score)}</Detail></Result>,
}));
const keepRankedResults = () => true;
const snippet = `import { Combobox, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Result = styled.span({ display: 'grid', gap: vars.space[1] });
const Detail = styled.span({ color: vars.color.textMuted });
const percent = new Intl.NumberFormat(locale, { style: 'percent' });

<Combobox label="Search documents" placeholder="Describe what you need"
  options={rankedResults.map(result => ({
    value: result.id,
    textValue: result.title,
    label: <Result><span>{result.title}</span>
      <Detail>{result.source} · {percent.format(result.score)}</Detail>
    </Result>,
  }))}
  filter={() => true}
  onInputChange={requestResults}
  onValueChange={openDocument}
  empty="No matching documents" />`;

function Search(args: ComboboxEasyProps) {
  const [query, setQuery] = useState('');
  return <Frame><Combobox {...args} inputValue={query} onInputChange={(next) => { setQuery(next); args.onInputChange?.(next); }} /></Frame>;
}

const meta = {
  title: 'Inputs/Combobox',
  component: Combobox,
  tags: ['!autodocs'],
  args: { label: 'Search documents', placeholder: 'Describe what you need', options, filter: keepRankedResults,
    empty: 'No matching documents', onValueChange: fn(), onInputChange: fn() },
  render: (args) => <Search {...args} />,
  parameters: { docs: { source: { code: snippet, language: 'tsx' }, description: {
    component: 'Search by meaning and choose a ranked document with the existing combobox.',
  }, usage: 'Supply results in retrieval rank order and disable substring filtering with filter={() => true}. The application owns retrieval, scores, debouncing and stale-response cancellation. These stories use supplied sample ranks, not embeddings or projected distances. textValue keeps source and score text out of the committed query. Options remain listbox options; Up/Down and Home/End move virtual focus, Enter selects, Escape closes, and Tab exits. onInputChange also reports selected-label and Escape writes; use onValueChange to open a document. There is no separate VectorSearch export or animation engine.' } },
} satisfies Meta<ComboboxEasyProps>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SemanticSearch: Story = {
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const input = canvas.getByRole('combobox', { name: 'Search documents' });
    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).toBe(input);
    await expect(getComputedStyle(input).outlineStyle).not.toBe('none');
    await userEvent.type(input, 'keep my work');
    const popup = within(canvasElement.ownerDocument.body);
    const rows = popup.getAllByRole('option');
    await expect(rows).toHaveLength(3);
    await expect(rows[0]).toHaveTextContent('Draft recovery');
    await expect(rows[2]).toHaveTextContent('Match 0%');
    await expect(input.getAttribute('aria-controls')).toBe(popup.getByRole('listbox').id);
    await userEvent.keyboard('{End}{Home}{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('drafts');
    await expect(input).toHaveValue('Draft recovery');
    await expect(input.ownerDocument.activeElement).toBe(input);
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard('{ArrowDown}{Escape}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const SemanticLight: Story = { ...SemanticSearch, globals: { theme: 'light' } };
export const SemanticRanked: Story = { args: { defaultOpen: true, defaultInputValue: 'keep my work' }, render: (args) => <Frame><Combobox {...args} /></Frame> };
export const SemanticEmpty: Story = { args: { options: [], defaultOpen: true } };
export const SemanticReducedMotion: Story = { ...SemanticSearch, name: 'Semantic Reduced Motion' };
