import { describe, expect, it } from 'vitest';
import { toMarkdown } from 'mdast-util-to-markdown';
import { gfmToMarkdown } from 'mdast-util-gfm';
import type { Root } from 'mdast';
import { mdiToMarkdown } from './to-markdown.js';

const paragraph = {type:'paragraph',children:[{type:'text',value:'前'},{type:'mdiComment',value:'\n秘密\n'},{type:'text',value:'後'}]};
const stringify = (children: unknown[]) => toMarkdown({type:'root',children} as Root,{extensions:[gfmToMarkdown(),mdiToMarkdown()]});

describe('opaque comment serialization', () => {
  for (const container of [
    {type:'blockquote',children:[paragraph]},
    {type:'list',ordered:false,children:[{type:'listItem',children:[paragraph]}]},
    {type:'footnoteDefinition',identifier:'a',children:[paragraph]},
    {type:'blockquote',children:[{type:'list',ordered:false,children:[{type:'listItem',children:[paragraph]}]}]},
    {type:'table',align:[null],children:[{type:'tableRow',children:[{type:'tableCell',children:paragraph.children}]}]},
  ]) it(`does not indent payloads inside ${container.type}`, () => {
    expect(stringify([container])).toContain('<!--\n秘密\n-->');
  });
  it('avoids tokens present in user content and preserves repeated payloads', () => {
    const node = structuredClone(paragraph);
    node.children.unshift({type:'text',value:'\uE000mdiComment'});
    expect(stringify([{type:'blockquote',children:[node,node]}]).split('<!--\n秘密\n-->')).toHaveLength(3);
    expect(stringify([{type:'blockquote',children:[node]}])).toContain('\uE000mdiComment');
  });
});

it('serializes empty and standalone comment nodes directly', () => {
  expect(stringify([{type:'mdiComment',value:''}])).toBe('<!---->\n');
  expect(stringify([paragraph])).toContain('<!--\n秘密\n-->');
});
