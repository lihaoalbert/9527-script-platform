export function renderScriptAsText(title: string, content: string) {
  return `${title}\n\n${content}`;
}

export function renderScriptAsMarkdown(title: string, content: string) {
  return `# ${title}\n\n${content}`;
}
