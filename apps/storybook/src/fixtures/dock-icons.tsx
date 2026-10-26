import { Cursor, Ellipse, Hand, Line, Lock, Rectangle, Text } from '@jfrader/icons';

const SIZE = 20;

export const dockIcons = {
  select: <Cursor size={SIZE} decorative />,
  hand: <Hand size={SIZE} decorative />,
  locked: <Lock size={SIZE} decorative />,
  text: <Text size={SIZE} decorative />,
  rectangle: <Rectangle size={SIZE} decorative />,
  unavailable: <Rectangle size={SIZE} decorative />,
  ellipse: <Ellipse size={SIZE} decorative />,
  line: <Line size={SIZE} decorative />,
};
