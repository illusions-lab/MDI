import {expect,it,vi} from 'vitest';
import {measureMdiWarichu,applyMdiWarichu,attachMdiWarichuLayout} from './warichu-browser.js';
import {layoutMdiWarichu} from './index.js';
function fixture() {
 const listeners=new Map<string,()=>void>();const observed=new Set<unknown>();
 let mutation:(records:any[])=>void=()=>{},resize:(entries:any[])=>void=()=>{};
 const style={writingMode:'horizontal-tb',direction:'ltr',fontSize:'20px',paddingInlineStart:'0',paddingInlineEnd:'0'};
 const note:any={dataset:{mdiWarichuSource:JSON.stringify([{type:'text',value:'一二三四五六'}])},innerHTML:'',querySelectorAll:()=>[],closest:()=>paragraph};
 const paragraph:any={clientWidth:200,clientHeight:300,getBoundingClientRect:()=>({left:0,right:200,bottom:300}),contains:(n:unknown)=>n===note,closest:(selector:string)=>selector.startsWith('[data')?null:paragraph,nodeType:1};
 let rects:any[]=[{left:0,right:120,bottom:40}];
 const win:any={getComputedStyle:()=>style,requestAnimationFrame:(cb:()=>void)=>setTimeout(cb,0),addEventListener:vi.fn(),removeEventListener:vi.fn(),visualViewport:{addEventListener:vi.fn(),removeEventListener:vi.fn()},MutationObserver:class{constructor(cb:any){mutation=cb}observe(){}disconnect(){}},ResizeObserver:class{constructor(cb:any){resize=cb}observe(element:unknown){observed.add(element)}unobserve(element:unknown){observed.delete(element)}disconnect(){observed.clear()}}};
 const fonts={ready:Promise.resolve(),addEventListener:(name:string,cb:()=>void)=>listeners.set(name,cb),removeEventListener:vi.fn()};
 const doc:any={defaultView:win,fonts,documentElement:{},createRange:()=>({selectNodeContents(){},setEndBefore(){},getClientRects:()=>rects})};
 const paragraphs=[paragraph];
 const container:any={ownerDocument:doc,querySelectorAll:(selector:string)=>selector.startsWith('[data')?[note]:paragraphs,contains:(n:unknown)=>n===note||n===paragraph};
 note.ownerDocument=doc;note.parentElement=paragraph;
 return {container,note,paragraph,paragraphs,observed,style,win,fonts,rects:(value:any[])=>rects=value,mutation:(records:any[])=>mutation(records),resize:(entries:any[])=>resize(entries),listeners};
}
it('measures remaining capacity in the containing realm and writing direction',()=>{
 const f=fixture();
 expect(measureMdiWarichu(f.container)[0].options).toEqual({firstCapacity:8,continuationCapacity:20});
 f.style.writingMode='vertical-rl';expect(measureMdiWarichu(f.container)[0].options.firstCapacity).toBe(26);
 f.style.writingMode='horizontal-tb';f.style.direction='rtl';expect(measureMdiWarichu(f.container)[0].options.firstCapacity).toBe(20);
 f.rects([]);expect(measureMdiWarichu(f.container)[0].options.firstCapacity).toBe(20);
 expect(measureMdiWarichu(f.container,[])).toEqual([]);
 expect(measureMdiWarichu(f.container,[f.paragraph])).toHaveLength(1);
});
it('preserves author breaks, indivisible overflow and source while avoiding redundant writes',()=>{
 const f=fixture();const source=f.note.dataset.mdiWarichuSource;
 const fragments=layoutMdiWarichu([{type:'noBreak',children:[{type:'text',value:'甲乙'}]},{type:'break'},{type:'break'}],1);
 const updates=[{index:0,fragments},{index:99,fragments}];
 expect(applyMdiWarichu(updates,f.container)).toBe(true);
 expect(f.note.innerHTML).toContain('data-mdi-overflow');expect(f.note.innerHTML.match(/<br>/g)).toHaveLength(2);
 expect(applyMdiWarichu(updates,f.container)).toBe(false);expect(f.note.dataset.mdiWarichuSource).toBe(source);
});
it('settles queued mutations, resize, fonts and disposal without touching source',async()=>{
 const f=fixture();const adapter=attachMdiWarichuLayout(f.container);
 adapter.configure();await adapter.settled();
 f.mutation([{target:f.paragraph}]);await adapter.settled();
 f.resize([{target:f.paragraph}]);await adapter.settled();
 f.resize([{target:f.container}]);await adapter.settled();
 f.mutation([{target:{contains:()=>false}}]);
 f.listeners.get('loadingdone')!();await adapter.settled();
 adapter.dispose();adapter.configure();expect(f.fonts.removeEventListener).toHaveBeenCalled();
});
it('settled rejects pending font timeout and cancellation',async()=>{
 const f=fixture();f.fonts.ready=new Promise(()=>{});const adapter=attachMdiWarichuLayout(f.container);
 await expect(adapter.settled({timeoutMs:2})).rejects.toThrow('timed out');
 const abort=new AbortController();const pending=adapter.settled({signal:abort.signal});abort.abort();await expect(pending).rejects.toBeDefined();
 await expect(adapter.settled({signal:abort.signal})).rejects.toBeDefined();adapter.dispose();
});
it('keeps capacities invariant when browser rectangles are scaled',()=>{
 const f=fixture();
 f.paragraph.offsetWidth=200;f.paragraph.offsetHeight=300;
 f.paragraph.getBoundingClientRect=()=>({left:0,right:400,bottom:600,width:400,height:600});
 f.rects([{left:0,right:240,bottom:80}]);
 expect(measureMdiWarichu(f.container)[0].options).toEqual({firstCapacity:8,continuationCapacity:20});
 f.style.writingMode='vertical-rl';expect(measureMdiWarichu(f.container)[0].options.firstCapacity).toBe(26);
});
it('cancels stability waiting immediately on disposal even if fonts never resolve',async()=>{
 const f=fixture();f.fonts.ready=new Promise(()=>{});const adapter=attachMdiWarichuLayout(f.container);
 const pending=adapter.settled({timeoutMs:20});adapter.dispose();
 await expect(pending).rejects.toThrow('disposed');
});

it('observes later paragraphs and releases removed paragraphs',async()=>{
 const f=fixture();const adapter=attachMdiWarichuLayout(f.container);await adapter.settled();
 const added={...f.paragraph};f.paragraphs.push(added);f.mutation([{target:f.paragraph}]);await adapter.settled();
 expect(f.observed.has(added)).toBe(true);
 f.paragraphs.pop();f.mutation([{target:f.paragraph}]);await adapter.settled();expect(f.observed.has(added)).toBe(false);
 adapter.dispose();
});
it('moves a note to the next line when the remaining slot cannot fit its first indivisible unit',async()=>{
 const f=fixture();f.rects([{left:0,right:195,bottom:40}]);const adapter=attachMdiWarichuLayout(f.container);
 await adapter.settled();expect(f.note.innerHTML).not.toContain('data-mdi-overflow');adapter.dispose();
});
it('cancels the pending animation frame and global readiness on disposal',async()=>{
 const f=fixture();f.win.requestAnimationFrame=()=>42;f.win.cancelAnimationFrame=vi.fn();
 const adapter=attachMdiWarichuLayout(f.container);await Promise.resolve();await Promise.resolve();
 adapter.dispose();await expect(f.win.__mdiWarichuLayoutReady).rejects.toThrow('disposed');
 expect(f.win.cancelAnimationFrame).toHaveBeenCalledWith(42);
});
it('measures real row advances and inherited insets without changing typography',()=>{
 const f=fixture();
 const line={dataset:{mdiWidth:'4'},getBoundingClientRect:()=>({left:0,right:90,top:0,bottom:20})};
 f.note.querySelectorAll=()=>[line,{dataset:{mdiWidth:'0'}}];
 f.container.ownerDocument.createRange=()=>({selectNodeContents(){},setEndBefore(){},getClientRects:()=>[{left:0,right:120,bottom:40}],getBoundingClientRect:()=>({left:10,right:90,top:0,bottom:20,width:80,height:20})});
 expect(measureMdiWarichu(f.container)[0]).toMatchObject({unit:20,options:{firstCapacity:3,continuationCapacity:9}});
 expect(measureMdiWarichu(f.container,undefined,{0:25})[0]).toMatchObject({unit:25,options:{firstCapacity:2,continuationCapacity:7}});
});
