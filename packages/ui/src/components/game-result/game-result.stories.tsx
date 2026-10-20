import type { ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { GameResult, type GameResultOutcome, type GameResultPartProps } from './index';


const OUTCOMES = ['won', 'lost', 'draw'] as const satisfies readonly GameResultOutcome[];

const Row = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[6],
  padding: vars.space[3],
});

const USAGE_NOTES = `### Match end
Use your game's language for result text and give players a next action. Your application decides the match result and handles navigation.

### Accessibility and motion
The result is an atomic status announcement. Keep the title consistent with the page's heading hierarchy. Any celebration effect belongs to your application: keep positions stable between renders and skip travel when reduced motion is requested.`;

const meta = {
  title: 'Games/GameResult',
  component: GameResult,
  parameters: {
    docs: {
      description: {
        component:
          'Show a match result with rewards and next actions.',
      },
      sections: [
        { title: 'Match results', stories: ['Win', 'Loss', 'Draw'] },
        { title: 'Composition', stories: ['TitleReplacement'] },
      ],
      usage: USAGE_NOTES,
    },
  },
  argTypes: {
    outcome: { control: 'radio', options: OUTCOMES },
  },
  decorators: [
    (Story) => (
      <Row>
        <Story />
      </Row>
    ),
  ],
} satisfies Meta<typeof GameResult>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Match-end win panel showing earned rewards and follow-up actions. */
export const Win: Story = {
  name: 'Win',
  args: {
    outcome: 'won',
    eyebrow: 'Partida finalizada',
    title: 'Victoria',
    summary: 'Ganaste 3–1. +120 puntos.',
    reward: 'Recompensa: +120 pts • +1 carta',
    actions: (
      <>
        <Button size="sm">Volver al lobby</Button>
        <Button size="sm" variant="ghost">
          Ver replay
        </Button>
      </>
    ),
  },
  parameters: {
    docs: {
      description: { story: 'Show earned rewards with lobby and replay actions.' },
      source: {
        language: 'tsx',
        code: `import { Button } from '@jfrader/ui/button';
import { GameResult } from '@jfrader/ui/game-result';

<GameResult
  outcome="won"
  eyebrow="Partida finalizada"
  title="Victoria"
  summary="Ganaste 3–1. +120 puntos."
  reward="Recompensa: +120 pts • +1 carta"
  actions={
    <>
      <Button size="sm">Volver al lobby</Button>
      <Button size="sm" variant="ghost">Ver replay</Button>
    </>
  }
/>`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const root = within(canvasElement).getByRole('status');
    await expect(root).toHaveAttribute('data-ui', 'game-result');
    await expect(root).toHaveAttribute('data-outcome', 'won');
    await expect(root).toHaveAttribute('data-tone', 'success');
    await expect(root).toHaveAttribute('role', 'status');
    await expect(root).toHaveAttribute('aria-atomic', 'true');
    await expect(within(root).getByText('Victoria')).toBeInTheDocument();
    await expect(within(root).getByText(/Recompensa/)).toBeInTheDocument();
    const accent = root.querySelector('[data-ui="game-result-accent"]');
    await expect(accent).toBeTruthy();
  },
};

/** Match-end loss panel with single return action. */
export const Loss: Story = {
  name: 'Loss',
  args: {
    outcome: 'lost',
    eyebrow: 'Partida finalizada',
    title: 'Derrota',
    summary: 'Perdiste 1–3.',
    actions: <Button size="sm">Volver al lobby</Button>,
  },
  parameters: {
    docs: {
      description: { story: 'Show a loss with a single return action.' },
      source: {
        language: 'tsx',
        code: `import { Button } from '@jfrader/ui/button';
import { GameResult } from '@jfrader/ui/game-result';

<GameResult
  outcome="lost"
  eyebrow="Partida finalizada"
  title="Derrota"
  summary="Perdiste 1–3."
  actions={<Button size="sm">Volver al lobby</Button>}
/>`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const root = within(canvasElement).getByRole('status');
    await expect(root).toHaveAttribute('data-outcome', 'lost');
    await expect(root).toHaveAttribute('data-tone', 'danger');
    await expect(within(root).getByText('Derrota')).toBeInTheDocument();
  },
};

/** Match-end draw panel with neutral styling. */
export const Draw: Story = {
  name: 'Draw',
  parameters: {
    docs: {
      description: { story: 'Show a tied match without a reward or follow-up action.' },
      source: {
        language: 'tsx',
        code: `import { GameResult } from '@jfrader/ui/game-result';

<GameResult
  outcome="draw"
  eyebrow="Partida finalizada"
  title="Empate"
  summary="1–1. Sin cambios en ranking."
/>`,
      },
    },
  },
  args: {
    outcome: 'draw',
    eyebrow: 'Partida finalizada',
    title: 'Empate',
    summary: '1–1. Sin cambios en ranking.',
  },
  play: async ({ canvasElement }) => {
    const root = within(canvasElement).getByRole('status');
    await expect(root).toHaveAttribute('data-outcome', 'draw');
    await expect(root).toHaveAttribute('data-tone', 'neutral');
  },
};

/** Match-end result panel in light theme. */
export const Light: Story = {
  name: 'Light theme',
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ThemeRoot } from '@jfrader/ui';
import { GameResult } from '@jfrader/ui/game-result';

<ThemeRoot theme="light">
  <GameResult
    outcome="won"
    eyebrow="Match ended"
    title="You won"
    summary="Score 3-1"
  />
</ThemeRoot>`,
      },
    },
  },
  args: {
    outcome: 'won',
    eyebrow: 'Match ended',
    title: 'You won',
    summary: 'Score 3-1',
  },
  decorators: [withLightTheme],
  play: async ({ canvasElement }) => {
    const root = within(canvasElement).getByRole('status');
    await expect(root).toHaveAttribute('data-outcome', 'won');
  },
};

function ReplacementTitle(props: ComponentPropsWithRef<'div'> & GameResultPartProps) {
  return <div {...props} data-replacement="custom-title" />;
}

/** Supply a custom title element through slots.title. */
export const TitleReplacement: Story = {
  name: 'Custom title',
  parameters: {
    docs: {
      description: { story: 'Render the result title through a custom element.' },
      source: {
        language: 'tsx',
        code: `import type { ComponentPropsWithRef } from 'react';
import { GameResult, type GameResultPartProps } from '@jfrader/ui/game-result';

function ReplacementTitle(props: ComponentPropsWithRef<'div'> & GameResultPartProps) {
  return <div {...props} data-replacement="custom-title" />;
}

<GameResult
  outcome="won"
  eyebrow="Partida finalizada"
  title="Victoria"
  summary="Ganaste 3–1."
  slots={{ title: ReplacementTitle }}
  slotProps={{
    title: {
      'data-ui': 'custom-title-ui',
    },
  }}
/>`,
      },
    },
  },
  args: {
    outcome: 'won',
    eyebrow: 'Partida finalizada',
    title: 'Victoria',
    summary: 'Ganaste 3–1.',
    slots: { title: ReplacementTitle },
    slotProps: {
      title: {
        ref: fn(),
        'data-ui': 'custom-title-ui',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const root = within(canvasElement).getByRole('status');
    const titleElement = canvasElement.querySelector<HTMLElement>('[data-replacement="custom-title"]')!;
    await expect(titleElement).toBeInTheDocument();
    await expect(titleElement).toHaveAttribute('data-replacement', 'custom-title');
    await expect(titleElement.className).not.toBe('');
    await expect(titleElement).toHaveAttribute('data-ui', 'game-result-title custom-title-ui');
    await expect(args.slotProps?.title?.ref).toHaveBeenCalledWith(titleElement);
    await expect(root).toHaveAttribute('data-outcome', 'won');
    await expect(root).toHaveAttribute('data-tone', 'success');
    await expect(titleElement).toHaveTextContent('Victoria');
  },
};
