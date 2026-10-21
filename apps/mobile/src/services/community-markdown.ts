import MarkdownIt, { type Token } from 'markdown-it';
import footnote from 'markdown-it-footnote';
import sub from 'markdown-it-sub';
import sup from 'markdown-it-sup';

/**
 * Turns a post written in Markdown into the HTML the server stores. The
 * options and rules match the web's md-editor setup
 * (references/web-master/src/boot/md-editor.ts), so a post saved from the app
 * reads the same on the web, and one opened in either editor round-trips.
 */
const markdown = createCommunityMarkdown();

export function renderCommunityMarkdown(source: string): string {
  return markdown.render(source);
}

function createCommunityMarkdown(): MarkdownIt {
  const md = new MarkdownIt({ breaks: false, html: true, linkify: true });
  md.use(sub).use(sup).use(footnote);
  const { escapeHtml } = md.utils;

  // The fragment after `#` in an image URL names its CSS classes.
  md.renderer.rules.image = (tokens, idx) => {
    const src = tokens[idx]?.attrGet('src') ?? '';
    const classes = src.split('#')[1] ?? '';
    return `<img src="${escapeHtml(src)}" class="${escapeHtml(classes)}">`;
  };

  // A paragraph holding nothing but images is an illustration block.
  const isImageParagraph = (inline: Token | undefined) => {
    const children = inline?.children ?? [];
    return children.length > 0 && children.every((child) => child.type === 'image');
  };
  md.renderer.rules.paragraph_open = (tokens, idx) => {
    if (tokens[idx]?.hidden) return '';
    return isImageParagraph(tokens[idx + 1]) ? '<div class="illus">' : '<p>';
  };
  md.renderer.rules.paragraph_close = (tokens, idx) => {
    if (tokens[idx]?.hidden) return '';
    return isImageParagraph(tokens[idx - 1]) ? '</div>\n' : '</p>\n';
  };

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx]!;
    const language = token.info.trim().split(/\s+/u, 1)[0];
    const className = language ? ` class="language-${escapeHtml(language)}"` : '';
    return `<pre><code${className}>${escapeHtml(token.content)}</code></pre>\n`;
  };
  md.renderer.rules.code_block = md.renderer.rules.fence;

  // Footnotes take the markup of the site's own (Duokan-style) notes.
  const footnoteNumber = (token: Token | undefined) => Number(token?.meta?.id) + 1;
  md.renderer.rules.footnote_ref = (tokens, idx) => {
    const number = footnoteNumber(tokens[idx]);
    const id = `ln-fn-${number}`;
    return `<a class="duokan-footnote" data-footnote-id="${id}" href="#${id}" role="doc-noteref"><sup>[${number}]</sup></a>`;
  };
  md.renderer.rules.footnote_block_open = () => '<section class="footnotes">\n';
  md.renderer.rules.footnote_block_close = () => '</section>\n';
  md.renderer.rules.footnote_open = (tokens, idx) => {
    const token = tokens[idx];
    const number = footnoteNumber(token);
    const label = escapeHtml(String(token?.meta?.label ?? `note-${number}`));
    return `<aside id="ln-fn-${number}" data-footnote-label="${label}">`;
  };
  md.renderer.rules.footnote_close = () => '</aside>\n';
  md.renderer.rules.footnote_anchor = () => '';
  return md;
}
