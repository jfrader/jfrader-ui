function storybookOnlyBlock(): never {
  throw new Error('Storybook docs blocks must not render in the docs front. Render story examples instead of docs.page.');
}

export {
  storybookOnlyBlock as Description,
  storybookOnlyBlock as Source,
  storybookOnlyBlock as Story,
  storybookOnlyBlock as Title,
};
