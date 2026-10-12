import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { expectAligned, expectInside, expectMirrored, expectMirroredDirection, expectNoOverlap } from './geometry-assertions';

const meta = {
  title: 'Foundations/Testing/Geometry assertions',
  tags: ['!autodocs'],
  render: () => (
    <div data-testid="surface" style={{ position: 'relative', width: 200, height: 120 }}>
      <span data-testid="a" style={{ position: 'absolute', insetInlineStart: 10, top: 10, width: 20, height: 20 }}>A</span>
      <span data-testid="b" style={{ position: 'absolute', insetInlineEnd: 10, top: 10, width: 20, height: 20 }}>B</span>
      <span data-testid="c" style={{ position: 'absolute', insetInlineStart: 10, bottom: 10, width: 20, height: 20 }}>C</span>
    </div>
  ),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Contracts: Story = {
  play: async ({ canvas }) => {
    const surface = canvas.getByTestId('surface');
    const a = canvas.getByTestId('a');
    const b = canvas.getByTestId('b');
    const c = canvas.getByTestId('c');
    await expectInside(a, surface, { insetPercent: 5 });
    await expectAligned([a, b], 'top');
    await expectAligned([a, c], 'center-x');
    await expectMirrored(a, b, surface, 'vertical');
    await expectMirrored(a, c, surface, 'horizontal');
    await expectNoOverlap(a, b);
    await expectMirroredDirection(surface, 'span');
    await expect(surface).not.toHaveAttribute('dir');
    surface.dir = 'rtl';
    await expectMirroredDirection(surface, 'span');
    await expect(surface).toHaveAttribute('dir', 'rtl');
    surface.removeAttribute('dir');
  },
};

export const RejectsRegressions: Story = {
  play: async ({ canvas }) => {
    const surface = canvas.getByTestId('surface');
    const a = canvas.getByTestId('a');
    const b = canvas.getByTestId('b');
    await expect(expectInside(a, surface, { insetPercent: 10 })).rejects.toThrow(/clearance=-10.000px/);
    b.style.top = '12px';
    await expect(expectAligned([a, b], 'top')).rejects.toThrow(/spread=2.000px/);
    await expect(expectMirrored(a, b, surface, 'vertical')).rejects.toThrow(/y delta=2.000px/);
    b.style.top = '10px';
    b.style.insetInlineEnd = '171px';
    await expect(expectNoOverlap(a, b)).rejects.toThrow(/intersection=19.000×20.000px/);
    b.style.insetInlineEnd = '150px';
    await expectNoOverlap(a, b);
    b.style.insetInlineEnd = '151px';
    await expectNoOverlap(a, b);
    await expect(expectNoOverlap(a, b, { tolerancePx: 0 })).rejects.toThrow(/intersection=1.000×20.000px/);
    a.style.insetInlineStart = '-2px';
    await expect(expectInside(a, surface)).rejects.toThrow(/clearance=-2.000px/);
    a.style.removeProperty('inset-inline-start');
    a.style.left = '10px';
    surface.dir = 'ltr';
    await expect(expectMirroredDirection(surface, 'span')).rejects.toThrow(/x delta=-160.000px/);
    await expect(surface).toHaveAttribute('dir', 'ltr');
    a.style.removeProperty('left');
    a.style.insetInlineStart = '10px';
    await expect(expectAligned([], 'left')).rejects.toThrow(/received 0/);
    await expect(expectInside(a, surface, { tolerancePx: -1 })).rejects.toThrow(/Invalid tolerance/);
    await expect(expectInside(a, surface, { insetPercent: NaN })).rejects.toThrow(/Invalid insetPercent/);
    await expect(expectMirroredDirection(surface, '.missing')).rejects.toThrow(/matched 0/);
    a.style.display = 'none';
    await expect(expectInside(a, surface)).rejects.toThrow(/0×0px/);
    a.style.removeProperty('display');
  },
};
