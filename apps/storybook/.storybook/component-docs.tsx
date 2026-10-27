import { useContext, type ContextType, type PropsWithChildren } from 'react';
import { Controls, Description, DocsContext, Heading, Markdown, Primary, Stories, Subtitle, Title, useOf } from '@storybook/addon-docs/blocks';

type DocsSection = { title: string; stories: string[] };
type Context = ContextType<typeof DocsContext>;

function StoryScope({ stories, children }: PropsWithChildren<{ stories: ReturnType<Context['componentStories']> }>) {
  const context = useContext(DocsContext);
  const scopedContext: Context = Object.create(context);
  scopedContext.componentStories = () => stories;
  return <DocsContext.Provider value={scopedContext}>{children}</DocsContext.Provider>;
}

export function ComponentDocs() {
  const context = useContext(DocsContext);
  const { preparedMeta, csfFile } = useOf('meta', ['meta']);
  const isSingleStory = Object.keys(csfFile.stories).length === 1;
  const usage: unknown = preparedMeta.parameters.docs?.usage;
  const sections: DocsSection[] | undefined = preparedMeta.parameters.docs?.sections;
  const seen = new Set<string>();
  const curatedSections = sections?.map(({ title, stories }) => ({
    title,
    stories: stories.flatMap((name) => {
      if (seen.has(name)) return [];
      seen.add(name);
      const storyExport = csfFile.moduleExports[name];
      if (!storyExport) throw new Error(`Unknown docs story "${name}" in ${preparedMeta.title}`);
      return [context.resolveOf(storyExport, ['story']).story];
    }),
  }));
  const curatedStories = curatedSections?.flatMap(({ stories }) => stories);
  const featured = curatedStories?.[0];

  return (
    <>
      <Title />
      <Subtitle />
      <Description of="meta" />
      {isSingleStory && <Description of="story" />}
      {curatedStories ? (
        <StoryScope stories={curatedStories}>
          <Primary />
        </StoryScope>
      ) : <Primary />}
      {typeof usage === 'string' && usage.trim() && (
        <details className="component-usage">
          <summary>Usage notes</summary>
          <Markdown>{usage}</Markdown>
        </details>
      )}
      <div className="component-props" role="region" aria-label="Component props" tabIndex={0}>
        <Controls />
      </div>
      {curatedSections ? curatedSections.map(({ title, stories }, index) => (
        <StoryScope key={index} stories={stories.filter((story) => story !== featured)}>
          <Heading>{title}</Heading>
          <Stories title={<></>} />
        </StoryScope>
      )) : !isSingleStory && <Stories />}
    </>
  );
}
