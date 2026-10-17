import { DomUtils, parseDocument } from 'htmlparser2';

// htmlparser2 and react-native-render-html resolve different domhandler copies
// in the workspace. Keep the preview walker structural so the parser's actual
// node shape is not lost to the incompatible duplicate type declarations.
type PreviewNode = {
  type: string;
  data?: string;
  name?: string;
  children?: PreviewNode[];
};
type PreviewElement = PreviewNode & { type: 'tag'; name: string; children: PreviewNode[] };

const PREVIEW_BLOCK_TAGS = new Set([
  'article',
  'blockquote',
  'center',
  'div',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'ol',
  'p',
  'pre',
  'section',
  'ul',
]);

const IGNORED_PREVIEW_TAGS = new Set(['img', 'script', 'style']);

function isElement(node: PreviewNode): node is PreviewElement {
  return node.type === 'tag';
}

/** Mirrors the Flutter detail preview's flattened inline flow. */
export function createHtmlPreviewSource(html: string): string {
  const document = parseDocument(html) as unknown as { children: PreviewNode[] };
  let output = '';
  let justWroteBreak = false;

  const writeBreak = () => {
    if (!output || justWroteBreak) {
      return;
    }
    output += '<br />';
    justWroteBreak = true;
  };

  const appendNodes = (nodes: readonly PreviewNode[], preserveWhitespace: boolean) => {
    for (const node of nodes) {
      if (node.type === 'text') {
        if (!node.data || (!preserveWhitespace && /^\s*$/u.test(node.data))) {
          continue;
        }
        output += DomUtils.getOuterHTML(node as never);
        justWroteBreak = false;
        continue;
      }

      if (!isElement(node)) {
        continue;
      }

      const tagName = node.name.toLowerCase();
      if (IGNORED_PREVIEW_TAGS.has(tagName)) {
        continue;
      }
      if (tagName === 'br') {
        writeBreak();
        continue;
      }
      if (PREVIEW_BLOCK_TAGS.has(tagName)) {
        const outputBeforeBlock = output.length;
        appendNodes(node.children, true);
        if (output.length > outputBeforeBlock) {
          writeBreak();
        }
        continue;
      }

      output += DomUtils.getOuterHTML(node as never);
      justWroteBreak = false;
    }
  };

  appendNodes(document.children, false);
  output = output.replace(/(?:<br\s*\/?>\s*)+$/iu, '');
  return `<div class="novella-html-preview-root">${output}</div>`;
}
