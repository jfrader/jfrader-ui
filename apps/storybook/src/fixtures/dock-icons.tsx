import { base } from '@jfrader/tokens';
import { Circle, Hand, Hexagon, Lock, Minus, MousePointer2, Square, Type } from 'lucide-react';

export const dockIcons = {
  select: <MousePointer2 size={base.space[5]} />,
  hand: <Hand size={base.space[5]} />,
  locked: <Lock size={base.space[5]} />,
  text: <Type size={base.space[5]} />,
  rectangle: <Square size={base.space[5]} />,
  unavailable: <Hexagon size={base.space[5]} />,
  ellipse: <Circle size={base.space[5]} />,
  line: <Minus size={base.space[5]} />,
};
