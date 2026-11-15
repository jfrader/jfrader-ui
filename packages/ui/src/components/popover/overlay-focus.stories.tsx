import type { Meta, StoryObj } from '@storybook/react-vite';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { Button } from '../button';
import { DateRangePicker, type DateRangePickerMessages } from '../date-range-picker';
import { UserMenu } from '../user-menu';
import { sceneSource } from '../scene';
import { Popover } from './popover';

const Frame = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: vars.space[4],
  padding: vars.space[4],
});
const DateFrame = styled(Frame)({ paddingBlockStart: '12rem', minBlockSize: '160vh' });
const Actions = styled.div({ display: 'flex', flexDirection: 'column', gap: vars.space[2] });
const messages: DateRangePickerMessages = {
  apply: 'Apply', cancel: 'Cancel', empty: 'No dates selected', start: 'Start date', end: 'End date',
  summary: ({ range }) => range,
};

const meta = {
  title: 'Surfaces/Overlay focus regressions',
  tags: ['!autodocs'],
  parameters: { docs: { description: { component: 'Keyboard and enlarged-text fixtures for owner actions and report dates.' } } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Owner: Story = {
  render: () => (
    <Frame>
      <UserMenu user={{ name: 'Maximiliana Alexandra Fernandez', email: 'maximiliana.alexandra.fernandez@company.example.com', avatarSrc: sceneSource('owner') }}>
        <UserMenu.Trigger aria-label="Account, Maximiliana Alexandra Fernandez" />
        <UserMenu.Content variant="menu">
          <UserMenu.Identity />
          <UserMenu.Item>Profile</UserMenu.Item>
          <UserMenu.Item>Sign out</UserMenu.Item>
        </UserMenu.Content>
      </UserMenu>
      <Button>After</Button>
    </Frame>
  ),
};

export const Compact: Story = {
  render: () => (
    <Frame>
      <Popover>
        <Popover.Trigger>Account</Popover.Trigger>
        <Popover.Content aria-label="Account actions">
          <Actions><Button>Profile</Button><Button>Sign out</Button></Actions>
        </Popover.Content>
      </Popover>
      <Button>After</Button>
    </Frame>
  ),
};

function DateExample({ locale, messages }: { locale: string; messages: DateRangePickerMessages }) {
  return (
    <DateFrame>
      <DateRangePicker locale={locale} messages={messages} today="2026-10-11" defaultValue={{ start: '2026-10-05', end: '2026-10-09' }}>
        <DateRangePicker.Trigger aria-label="Report period" />
        <DateRangePicker.Content />
      </DateRangePicker>
      <Button>After</Button>
    </DateFrame>
  );
}

export const Dates: Story = {
  render: () => <DateExample locale="en-GB" messages={messages} />,
};

export const DatesSpanish: Story = {
  render: () => <DateExample locale="es" messages={{
    apply: 'Aplicar', cancel: 'Cancelar', empty: 'Sin fechas', start: 'Inicio', end: 'Fin', summary: ({ range }) => range,
  }} />,
};
