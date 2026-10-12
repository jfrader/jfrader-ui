import { Controls, Description, Markdown, Primary, Stories, Subtitle, Title, useOf } from '@storybook/addon-docs/blocks';

export function ComponentDocs() {
  const { preparedMeta, csfFile } = useOf('meta', ['meta']);
  const isSingleStory = Object.keys(csfFile.stories).length === 1;
  const usage: unknown = preparedMeta.parameters.docs?.usage;

  return (
    <>
      <Title />
      <Subtitle />
      <Description of="meta" />
      {isSingleStory && <Description of="story" />}
      <Primary />
      {typeof usage === 'string' && usage.trim() && (
        <details className="component-usage">
          <summary>Usage notes</summary>
          <Markdown>{usage}</Markdown>
        </details>
      )}
      <div className="component-props" role="region" aria-label="Component props" tabIndex={0}>
        <Controls />
      </div>
      {!isSingleStory && <Stories />}
    </>
  );
}
