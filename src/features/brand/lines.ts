/** "One item per line" ⇄ list. */
export const lines = {
  join: (items: readonly string[]) => items.join('\n'),
  split: (text: string) =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
};
