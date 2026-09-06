import React from 'react';

/**
 * Audit-reviewed sanitizer component for untrusted text, model outputs,
 * scraped excerpts, EXIF strings, and AI chat.
 * Strictly prevents script execution, javascript: URIs, arbitrary HTML, and CSS injections.
 */

interface SafeContentProps {
  content: string;
  className?: string;
  allowMarkdownSubset?: boolean;
}

export const SafeContent: React.FC<SafeContentProps> = ({
  content,
  className = '',
  allowMarkdownSubset = true,
}) => {
  if (!content) return null;

  if (!allowMarkdownSubset) {
    // Escaped raw text rendering
    return <span className={className}>{content}</span>;
  }

  // Parse safe Markdown subset into React elements without dangerouslySetInnerHTML
  const parsedNodes = parseSafeMarkdown(content);

  return <div className={`prose-safe text-inherit ${className}`}>{parsedNodes}</div>;
};

/**
 * Pure React tree parser for Markdown subset:
 * - Paragraphs
 * - Headings (###, ##, #)
 * - Lists (*, -, 1.)
 * - Blockquotes (>)
 * - Code blocks (```) and inline code (`)
 * - Bold (**), Italic (*)
 * - Safe hyperlinks [text](https://...)
 */
function parseSafeMarkdown(rawText: string): React.ReactNode[] {
  // Strip null bytes and non-printable control characters except \n, \r, \t
  // eslint-disable-next-line no-control-regex
  const sanitized = rawText.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const lines = sanitized.split('\n');
  const nodes: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        nodes.push(
          <pre
            key={`code-${i}`}
            className="my-2 p-3 bg-neutral-900 text-neutral-100 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap"
          >
            <code>{codeBlockLines.join('\n')}</code>
          </pre>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      nodes.push(
        <h4 key={`h3-${i}`} className="text-base font-semibold text-neutral-900 mt-3 mb-1">
          {renderInline(line.slice(4))}
        </h4>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      nodes.push(
        <h3 key={`h2-${i}`} className="text-lg font-semibold text-neutral-900 mt-4 mb-2">
          {renderInline(line.slice(3))}
        </h3>
      );
      continue;
    }
    if (line.startsWith('# ')) {
      nodes.push(
        <h2 key={`h1-${i}`} className="text-xl font-bold text-neutral-900 mt-4 mb-2">
          {renderInline(line.slice(2))}
        </h2>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      nodes.push(
        <blockquote
          key={`quote-${i}`}
          className="border-l-4 border-amber-400 bg-amber-50/50 pl-3 py-1 my-2 text-neutral-700 italic text-sm"
        >
          {renderInline(line.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Bullet points
    if (/^[*-]\s+/.test(line)) {
      nodes.push(
        <li key={`li-${i}`} className="ml-5 list-disc text-sm text-neutral-800 my-0.5">
          {renderInline(line.replace(/^[*-]\s+/, ''))}
        </li>
      );
      continue;
    }

    // Empty line / spacing
    if (line.trim() === '') {
      continue;
    }

    // Regular paragraph
    nodes.push(
      <p key={`p-${i}`} className="my-1.5 text-sm leading-relaxed text-neutral-800">
        {renderInline(line)}
      </p>
    );
  }

  return nodes;
}

/**
 * Render inline tokens: **bold**, *italic*, `code`, and [links](safe-url)
 */
function renderInline(text: string): React.ReactNode {
  // Regex to split on markdown inline patterns
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-neutral-950">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={index} className="italic text-neutral-800">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 bg-neutral-100 text-neutral-900 border border-neutral-200 rounded text-xs font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    // Link format [label](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const label = linkMatch[1];
      const targetUrl = linkMatch[2].trim();

      // Only allow https:// and http:// protocols; block javascript:, data:, vbscript:
      if (targetUrl.startsWith('https://') || targetUrl.startsWith('http://')) {
        return (
          <a
            key={index}
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-700 hover:text-sky-900 underline underline-offset-2 break-all font-medium"
          >
            {label}
          </a>
        );
      }
      // If suspicious protocol, just render label as text
      return <span key={index}>{label}</span>;
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}
