export const componentName = (name: string) => name.split('-').map((part) => part[0]!.toUpperCase() + part.slice(1)).join('');
