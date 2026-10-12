/**
 * Entrance and exit of a modal surface (Drawer, BottomSheet): critically damped, so it never
 * overshoots, and at rest once within a pixel and slow, so a retained exit releases the modal promptly.
 */
export const PRESENCE_SPRING = {
  type: 'spring',
  stiffness: 900,
  damping: 60,
  mass: 1,
  restDelta: 1,
  restSpeed: 30,
} as const;
