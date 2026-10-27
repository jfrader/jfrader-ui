import { useContext, type ContextType, type PropsWithChildren } from 'react';
import { Controls, Description, DocsContext, Heading, Markdown, Primary, Stories, Subtitle, Title, useOf } from '@storybook/addon-docs/blocks';

type DocsSection = { title: string; stories: string[] };
type Context = ContextType<typeof DocsContext>;

function StoryScope({ stories, children }: PropsWithChildren<{ stories: unknown[] }>) {
  const context = useContext(DocsContext);
  const scopedContext: Context = Object.create(context);
  scopedContext.componentStories = () => stories.map((story) => context.resolveOf(story, ['story']).story);
  return <DocsContext.Provider value={scopedContext}>{children}</DocsContext.Provider>;
}

export function ComponentDocs() {
  const { preparedMeta, csfFile } = useOf('meta', ['meta']);
  const isSingleStory = Object.keys(csfFile.stories).length === 1;
  const usage: unknown = preparedMeta.parameters.docs?.usage;
  const sections: DocsSection[] | undefined = preparedMeta.parameters.docs?.sections;
  const storyExports = new Set(Object.values(csfFile.stories).map((story) => story.moduleExport));
  const seen = new Set<string>();
  const curatedSections = sections?.length ? sections.map(({ title, stories }) => ({
    title,
    stories: stories.flatMap((name) => {
      if (seen.has(name)) return [];
      seen.add(name);
      const storyExport = csfFile.moduleExports[name];
      if (!storyExports.has(storyExport)) {
        if (process.env.NODE_ENV !== 'production') console.warn(`Unknown docs story "${name}" in ${preparedMeta.title}`);
        return [];
      }
      return [storyExport];
    }),
  })) : undefined;
  const curatedStories = curatedSections?.flatMap(({ stories }) => stories);
  const featured = curatedStories?.[0];
  const remainingSections = curatedSections?.map(({ title, stories }) => ({
    title,
    stories: stories.filter((story) => story !== featured),
  })).filter(({ stories }) => stories.length > 0);

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
      {remainingSections ? remainingSections.map(({ title, stories }, index) => (
        <StoryScope key={index} stories={stories}>
          <Heading>{title}</Heading>
          <Stories title={<></>} />
        </StoryScope>
      )) : !isSingleStory && <Stories />}
    </>
  );
}
