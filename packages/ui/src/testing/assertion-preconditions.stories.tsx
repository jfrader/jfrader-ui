import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { requireElement, requireNonEmpty } from './assertion-preconditions';

const meta = {
  title: 'Testing/Assertion preconditions',
  tags: ['!autodocs'],
  render: () => <div>Assertion preconditions</div>,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Collections: Story = {
  play: async () => {
    await expect(() => requireNonEmpty([], 'Days')).toThrow('Days: expected a nonempty collection');
    await expect(() => requireNonEmpty(new Set(), 'Days')).toThrow('Days: expected a nonempty collection');
    await expect(requireNonEmpty(new Set([1, 2]), 'Days')).toEqual([1, 2]);
  },
};

export const Elements: Story = {
  play: async ({ canvasElement }) => {
    await expect(() => requireElement(null, 'Caption')).toThrow('Caption: expected an element');
    await expect(() => requireElement(undefined, 'Caption')).toThrow('Caption: expected an element');
    await expect(requireElement(canvasElement, 'Canvas')).toBe(canvasElement);
  },
};
