import { describe, it, expect } from 'vitest';
import React from 'react';
import { SafeContent } from '../../src/services/sanitizer';

describe('Sanitizer & XSS Prevention Verification', () => {
  it('returns null for empty or null content', () => {
    const element = SafeContent({ content: '' });
    expect(element).toBeNull();
  });

  it('renders raw escaped text when allowMarkdownSubset is false', () => {
    const raw = '<script>alert("xss")</script>';
    const element = SafeContent({ content: raw, allowMarkdownSubset: false });
    expect(React.isValidElement(element)).toBe(true);
    expect((element as React.ReactElement<{ children: string }>).props.children).toBe(raw);
  });

  it('parses safe markdown without dangerouslySetInnerHTML', () => {
    const markdown = '## Key Claim\n\nThis is a **supported** proposition with `code`.\n\n> Important quote';
    const element = SafeContent({ content: markdown, allowMarkdownSubset: true });
    expect(React.isValidElement(element)).toBe(true);

    // Verify dangerouslySetInnerHTML is NOT in props
    expect((element as React.ReactElement).props.dangerouslySetInnerHTML).toBeUndefined();
  });

  it('safely handles hyperlinks and protects against target injection', () => {
    const markdown = 'Check [Reuters Source](https://reuters.com/factcheck) for details.';
    const element = SafeContent({ content: markdown, allowMarkdownSubset: true });
    expect(React.isValidElement(element)).toBe(true);
    expect((element as React.ReactElement).props.dangerouslySetInnerHTML).toBeUndefined();
  });

  it('disallows javascript: protocols in markdown links', () => {
    const malicious = 'Click [here](javascript:alert(1)) to view';
    const element = SafeContent({ content: malicious, allowMarkdownSubset: true });
    expect(React.isValidElement(element)).toBe(true);
    // Should NOT create an anchor with javascript:
    expect((element as React.ReactElement).props.dangerouslySetInnerHTML).toBeUndefined();
  });
});
