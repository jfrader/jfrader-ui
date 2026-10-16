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

const USAGE_NOTES = `- Map your domain result to \`outcome\` ("victoria" etc are consumer labels).
- Slots receive consumer content; title should be a heading in the page hierarchy.
- Celebration slot receives your effect (positioned as overlay). The library does not ship emoji rain or particles.
- Recipe for deterministic celebration (respects reduced motion): mount a stable seed (match id), use MotionConfig + useReducedMotion, compute fixed positions from seed (no Math.random per render), run the animation to its end state; under reduced motion render the final positions instantly and skip the travel. Example:
  const seed = matchId;
  const reduced = useReducedMotion();
  <MotionConfig reducedMotion="user">
    {positionsFromSeed(seed).map((p, i) => (
      <motion.div
        key={i}
        initial={reduced ? p.final : p.start}
        animate={p.final}
        transition={{ duration: reduced ? 0 : 0.6, delay: i * 0.03 }}
      />
    ))}
  </MotionConfig>`;

const meta = {
  title: 'Games/GameResult',
  component: GameResult,
  parameters: {
    docs: {
      description: {
        component:
          'Presentational panel for match end. Exposes outcome data; consumers supply labels, copy, actions and any celebration effect.',
      },
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

/** Win panel with reward and actions. Consumer owns labels and next actions. */
export const Win: Story = {
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
      source: {
        code: `<GameResult
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

/** Loss panel. */
export const Loss: Story = {
  args: {
    outcome: 'lost',
    eyebrow: 'Partida finalizada',
    title: 'Derrota',
    summary: 'Perdiste 1–3.',
    actions: <Button size="sm">Volver al lobby</Button>,
  },
  parameters: {
    docs: {
      source: {
        code: `<GameResult
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

/** Draw state for completeness. */
export const Draw: Story = {
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

/** Light theme variant (globals provide the rest). */
export const Light: Story = {
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
