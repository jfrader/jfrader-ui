import type { CreatedSvgIconProps } from '@jfrader/ui/svg-icon';

/** Props every generated icon accepts: the full `SvgIcon` surface minus its drawing. */
export type IconProps = CreatedSvgIconProps;

export const categories = [
  'navigation', 'action', 'editing', 'media', 'file', 'communication', 'money', 'status',
  'device', 'weather', 'gaming', 'people', 'security', 'development', 'arrow',
] as const;

export type IconCategory = typeof categories[number];
export type IconVariant = 'line' | 'solid';
export interface IconMetadata {
  name: string;
  category: IconCategory;
  tags: string[];
  aliases: string[];
  variants: IconVariant[];
  expressive: boolean;
  since: string;
}
