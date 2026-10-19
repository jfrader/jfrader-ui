import { createContext } from 'react';

export type EyeDropperConstructor = new () => {
  open: () => Promise<{ sRGBHex: string }>;
};

export const EyeDropperCapability = createContext<
  EyeDropperConstructor | null | undefined
>(undefined);
