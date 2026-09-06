import { expect, it } from 'vitest';
import { layoutMdiWarichu } from './index.js';
it('uses distinct first and continuation capacities without writing breaks', () => {
 const children = [{type:'text',value:'一二三四五六七八九十'}];
 const result = layoutMdiWarichu(children, {firstCapacity:2,continuationCapacity:6});
 expect(result[0]?.widths).toEqual([2,2]);
 expect(result.slice(1).some(f => Math.max(...f.widths)>2)).toBe(true);
 expect(children[0].value).toBe('一二三四五六七八九十');
});
