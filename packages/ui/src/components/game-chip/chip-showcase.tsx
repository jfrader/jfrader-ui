import type { Decorator } from '@storybook/react-vite';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { Flex } from '../flex';

const ChipStage = styled(Flex)({
  inlineSize: `min(48rem, calc(100vw - ${vars.space[12]} * 2))`, maxInlineSize: '100%',
  minBlockSize: `calc(${vars.space[12]} * 4)`,
  boxSizing: 'border-box', padding: vars.space[8], borderRadius: vars.radius.lg,
  justifyContent: 'center', alignItems: 'center',
  background: `radial-gradient(ellipse at 50% 20%, color-mix(in srgb, ${vars.color.chipGreen} 45%, ${vars.color.chipInk}), color-mix(in srgb, ${vars.color.chipGreen} 18%, ${vars.color.chipInk}))`,
  '&[data-light="true"]': { background: vars.color.chipWhite },
  '& > [data-story-theme-scope]': { backgroundColor: 'transparent', padding: 0 },
  '@media (max-width: 480px)': { padding: vars.space[4] },
});

export const withChipStage: Decorator = (Story, context) =>
  <ChipStage data-light={String(context.globals.theme === 'light')}><Story /></ChipStage>;
