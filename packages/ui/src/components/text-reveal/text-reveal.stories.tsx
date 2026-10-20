import { useState, type ComponentPropsWithRef } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { TextReveal } from './index';

const Heading = styled.h2({
  margin: 0,
  fontSize: vars.textSize['3xl'],
  fontWeight: vars.fontWeight.semibold,
  lineHeight: vars.lineHeight.tight,
});
function Root(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-replacement="root" />;
}
function Word(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-replacement="word" />;
}

const meta = {
  title: 'Data display/TextReveal',
  component: TextReveal,
  tags: ['autodocs'],
  args: { text: 'Build better\ninterfaces' },
  render: (args) => (
    <Heading>
      <TextReveal {...args} />
    </Heading>
  ),
  parameters: {
    docs: {
      description: {
        component: 'Reveal short headings and hero copy once as they appear.',
      },
      usage: `### Content
Wrap TextReveal in your heading or paragraph. Text is read-only; no value or open state is created. Typography is inherited. Newlines and repeated spaces are preserved. Server output and the first client render contain unsegmented, readable text. After mount, Intl.Segmenter splits words using locale; platforms without Segmenter reveal each line together. Server and browser ICU versions do not need to match.
### Motion
The entrance starts after client mount, not on scroll. Delay is capped at 1000ms and total word stagger at the slow motion token. Change text or the React key to replay. Reduced motion shows text immediately; forced colors uses solid text.
### Keyboard
Text is not a widget and has no keyboard handlers. Tab skips it; surrounding controls keep their native keys. The complete sentence is exposed once to assistive technology. Avoid long body copy and task-critical notices.`,
      source: {
        code: '<h2><TextReveal text={"Build better\\ninterfaces"} /></h2>',
        language: 'tsx',
      },
    },
  },
} satisfies Meta<typeof TextReveal>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(
      canvas.getByRole('heading', {
        name: 'Build better interfaces',
        level: 2,
      }),
    ).toBeVisible();
    const visual = canvasElement.querySelector('[data-ui="text-reveal-visual"]')!;
    await expect(visual).toHaveAttribute('aria-hidden', 'true');
    await expect(visual.textContent).toBe('Build better\ninterfaces');
    const words = visual.querySelectorAll<HTMLElement>('[data-ui="text-reveal-word"]');
    await Promise.all(
      Array.from(words).flatMap((word) =>
        word.getAnimations().map((animation) => animation.finished),
      ),
    );
    await expect(getComputedStyle(words[0]!).transform).toBe('none');
    await expect(getComputedStyle(words[0]!).filter).toBe('none');
  },
};
export const Soft: Story = { args: { variant: 'soft' } };
export const Hydration: Story = {
  play: async ({ canvasElement, args }) => {
    const host = canvasElement.ownerDocument.createElement('div');
    host.innerHTML = renderToString(<TextReveal {...args} />);
    const visual = host.querySelector('[data-ui="text-reveal-visual"]')!;
    await expect(visual.textContent).toBe(args.text);
    await expect(visual.children).toHaveLength(0);
    canvasElement.append(host);
    const onRecoverableError = fn();
    const root = hydrateRoot(host, <TextReveal {...args} />, {
      onRecoverableError,
    });
    try {
      await waitFor(() =>
        expect(visual.querySelectorAll('[data-ui="text-reveal-word"]').length).toBeGreaterThan(1),
      );
      await expect(host.querySelector('[data-ui="text-reveal-visual"]')).toBe(visual);
      await expect(visual.textContent).toBe(args.text);
      await expect(visual).toHaveAttribute('aria-hidden', 'true');
      await expect(visual.previousElementSibling).toHaveTextContent(
        args.text.replaceAll('\n', ' '),
      );
      await expect(onRecoverableError).not.toHaveBeenCalled();
    } finally {
      root.unmount();
      host.remove();
    }
  },
};
export const Delayed: Story = { args: { delayMs: 500 } };
export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};
export const RTL: Story = {
  args: { text: 'ابنِ واجهات أفضل', dir: 'rtl', locale: 'ar' },
};
export const Unicode: Story = {
  args: { text: 'Bonjour 👋 café — déjà vu', locale: 'fr' },
};
export const RepeatedWhitespace: Story = {
  args: { text: 'One  two\n\nthree' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ui="text-reveal-visual"]')?.textContent).toBe(
      'One  two\n\nthree',
    );
  },
};
export const EmptyText: Story = {
  args: { text: '' },
  render: (args) => <TextReveal {...args} />,
  parameters: {
    docs: { source: { code: '<TextReveal text="" />', language: 'tsx' } },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-ui="text-reveal-word"]')).toHaveLength(0);
  },
};
export const ZeroString: Story = { args: { text: '0' } };
export const CustomSlots: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { TextReveal, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Heading = styled.h2({ margin: 0, fontSize: vars.textSize['3xl'], fontWeight: vars.fontWeight.semibold, lineHeight: vars.lineHeight.tight });

function RevealRoot(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-replacement="root" />;
}
function RevealWord(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-replacement="word" />;
}

<Heading>
  <TextReveal
    text={'Build better\\ninterfaces'}
    component={RevealRoot}
    slots={{ word: RevealWord }}
    slotProps={{
      root: { title: 'Hero' },
      visual: { 'data-ui': 'hero-visual text-reveal-visual hero-visual' },
      word: { className: 'hero-word', 'data-ui': 'hero-word text-reveal-word hero-word' },
    }}
    sx={{ color: vars.color.accentText }}
  />
</Heading>` } } },
  args: {
    component: Root,
    slots: { word: Word },
    slotProps: {
      root: { title: 'Hero' },
      visual: { 'data-ui': 'hero-visual text-reveal-visual hero-visual' },
      word: {
        className: 'hero-word',
        'data-ui': 'hero-word text-reveal-word hero-word',
      },
    },
    sx: { color: vars.color.accentText },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-replacement="root"]')).toHaveAttribute(
      'title',
      'Hero',
    );
    await expect(canvasElement.querySelector('[data-replacement="word"]')).toHaveClass('hero-word');
    await expect(canvasElement.querySelector('[data-replacement="word"]')).toHaveAttribute(
      'data-ui',
      'text-reveal-word hero-word',
    );
    await expect(canvasElement.querySelector('[data-ui~="text-reveal-visual"]')).toHaveAttribute(
      'data-ui',
      'text-reveal-visual hero-visual',
    );
  },
};
function ReplayDemo() {
  const [version, setVersion] = useState(0);
  return (
    <>
      <Heading>
        <TextReveal key={version} text="Build better interfaces" />
      </Heading>
      <Button onClick={() => setVersion(version + 1)}>Replay</Button>
    </>
  );
}
export const Replay: Story = {
  render: () => <ReplayDemo />,
  parameters: {
    docs: {
      source: {
        code: '<TextReveal key={version} text="Build better interfaces" />',
        language: 'tsx',
      },
    },
  },
};
export const KeyboardComposition: Story = {
  args: { text: 'Continue', onClick: fn() },
  render: ({ onClick, ...args }) => (
    <Button onClick={onClick}>
      <TextReveal {...args} />
    </Button>
  ),
  parameters: {
    docs: {
      source: {
        code: '<Button><TextReveal text="Continue" /></Button>',
        language: 'tsx',
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    const button = canvas.getByRole('button', { name: 'Continue' });
    await userEvent.tab();
    await expect(button.ownerDocument.activeElement).toBe(button);
    await expect(getComputedStyle(button).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await expect(args.onClick).toHaveBeenCalledTimes(2);
    await expect(button).toHaveAccessibleName('Continue');
  },
};
export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Enable reduced motion in your browser to show the text without an entrance.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const word = canvasElement.querySelector<HTMLElement>('[data-ui="text-reveal-word"]')!;
    if (word.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await expect(getComputedStyle(word).animationName).toBe('none');
      await expect(getComputedStyle(word).opacity).toBe('1');
      await expect(getComputedStyle(word).transform).toBe('none');
      await expect(getComputedStyle(word).filter).toBe('none');
    }
  },
};
