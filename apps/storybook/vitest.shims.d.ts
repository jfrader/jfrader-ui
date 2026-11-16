/// <reference types="@vitest/browser-playwright" />

import 'vitest';

declare module 'vitest' {
  interface ProvidedContext {
    touchInput: boolean;
  }
}
