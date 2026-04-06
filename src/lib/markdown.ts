/**
 * Lightweight Markdown → HTML renderer for AI responses.
 * Handles code blocks, inline code, bold, italic, headings, lists, links, blockquotes.
 * No external dependencies — keeps the extension bundle lean.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlightCode(code: string, lang: string): string {
  const escaped = escapeHtml(code);
  if (!lang) return escaped;

  const keywords: Record<string, string[]> = {
    javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'default', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'typeof', 'switch', 'case', 'break', 'continue', 'null', 'undefined', 'true', 'false'],
    typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'default', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'typeof', 'interface', 'type', 'enum', 'implements', 'extends', 'switch', 'case', 'break', 'continue', 'null', 'undefined', 'true', 'false'],
    python: ['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'import', 'from', 'as', 'try', 'except', 'raise', 'with', 'yield', 'lambda', 'pass', 'break', 'continue', 'in', 'not', 'and', 'or', 'is', 'None', 'True', 'False', 'self'],
  };

  const langMap: Record<string, string> = { js: 'javascript', ts: 'typescript', py: 'python', jsx: 'javascript', tsx: 'typescript' };
  const kws = keywords[langMap[lang] || lang];
  if (!kws) return escaped;

  let result = escaped;
  // Highlight strings (single and double quotes)
  result = result.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, '<span class="hljs-string">$&</span>');
  // Highlight single-line comments
  result = result.replace(/(\/\/.*$)/gm, '<span class="hljs-comment">$1</span>');
  // Highlight hash comments (Python)
  result = result.replace(/(#.*$)/gm, '<span class="hljs-comment">$1</span>');
  // Highlight numbers
  result = result.replace(/\b(\d+\.?\d*)\b/g, '<span class="hljs-number">$1</span>');
  // Highlight keywords (word boundary match)
  const kwPattern = new RegExp(`\\b(${kws.join('|')})\\b`, 'g');
  result = result.replace(kwPattern, '<span class="hljs-keyword">$1</span>');

  return result;
}

export function renderMarkdown(text: string): string {
  if (!text) return '';

  // Extract and protect code blocks from further processing
  const codeBlocks: string[] = [];
  let processed = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const highlighted = highlightCode(code.trimEnd(), lang);
    const langLabel = lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : '';
    const placeholder = `%%CODEBLOCK_${codeBlocks.length}%%`;
    codeBlocks.push(
      `<div class="code-block-wrapper">${langLabel}<button class="copy-btn" data-code="${encodeURIComponent(code.trim())}">Copy</button><pre class="code-block"><code>${highlighted}</code></pre></div>`
    );
    return placeholder;
  });

  // Escape HTML in the remaining text
  processed = escapeHtml(processed);

  // Inline code
  processed = processed.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Bold
  processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  processed = processed.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // Headings
  processed = processed.replace(/^### (.+)$/gm, '<h4 class="md-h4">$1</h4>');
  processed = processed.replace(/^## (.+)$/gm, '<h3 class="md-h3">$1</h3>');
  processed = processed.replace(/^# (.+)$/gm, '<h2 class="md-h2">$1</h2>');

  // Blockquotes
  processed = processed.replace(/^&gt; (.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>');

  // Unordered lists
  processed = processed.replace(/^[*-] (.+)$/gm, '<li class="md-li">$1</li>');

  // Ordered lists
  processed = processed.replace(/^\d+\. (.+)$/gm, '<li class="md-li-ordered">$1</li>');

  // Links
  processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>');

  // Horizontal rules
  processed = processed.replace(/^---$/gm, '<hr class="md-hr"/>');

  // Paragraphs — double newline
  processed = processed.replace(/\n\n/g, '</p><p class="md-p">');

  // Single newlines → <br>
  processed = processed.replace(/\n/g, '<br/>');

  // Wrap in paragraph
  processed = `<p class="md-p">${processed}</p>`;

  // Restore code blocks
  codeBlocks.forEach((block, i) => {
    processed = processed.replace(`%%CODEBLOCK_${i}%%`, block);
  });

  return processed;
}
