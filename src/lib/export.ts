/**
 * Export utilities — copy, download Markdown, download CSV.
 */

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function downloadAsMarkdown(content: string, filename = 'omni-agent-export.md'): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadAsCSV(content: string, filename = 'omni-agent-data.csv'): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function convertTableToCSV(markdown: string): string {
  const lines = markdown.split('\n').filter(l => l.trim().startsWith('|'));
  if (lines.length === 0) return markdown;
  
  return lines
    .filter(l => !l.match(/^\|\s*[-:]+/)) // Remove separator rows
    .map(l => 
      l.split('|')
        .filter(cell => cell.trim() !== '')
        .map(cell => `"${cell.trim().replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');
}
