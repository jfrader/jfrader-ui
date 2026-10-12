import type { ComponentPropsWithoutRef } from 'react';
import { Markdown } from '@storybook/addon-docs/blocks';
import './guide.css';

const guidePaths: Record<string, string> = {
  './consuming-jfrader-ui.md': 'foundations-getting-started',
  './theming.md': 'foundations-theming',
  './styling.md': 'foundations-styling',
};

function GuideLink({ href, ...props }: ComponentPropsWithoutRef<'a'>) {
  const page = href && guidePaths[href];
  return <a {...props} href={page ? `./?path=/docs/${page}--docs` : href} target={page ? '_top' : undefined} />;
}

const markdownOptions = { overrides: { a: GuideLink } };

export function Guide({ children }: { children: string }) {
  return <div className="foundation-guide"><Markdown options={markdownOptions}>{children}</Markdown></div>;
}
