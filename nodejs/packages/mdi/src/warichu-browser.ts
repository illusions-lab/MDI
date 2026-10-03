import { layoutMdiWarichu, type MdiWarichuFragment, type MdiWarichuOptions } from './index.js';

export interface MdiWarichuMeasurement {
 index: number;
 children: Record<string, unknown>[];
 options: MdiWarichuOptions;
 /** Measured CSS pixels per Rust half-em unit for this layout pass. */
 unit?:number;
}
/** Self-contained for execution in a browser hosted by Electron or Playwright. */
export function measureMdiWarichu(container: HTMLElement = document.body, affected?: readonly HTMLElement[], minimumUnits?:Readonly<Record<number,number>>): MdiWarichuMeasurement[] {
 return Array.from(container.querySelectorAll<HTMLElement>('[data-mdi-warichu-source]')).flatMap((note,index) => {
  if (note.parentElement?.closest('[data-mdi-warichu-source]')) return [];
  if (affected && !affected.some(element=>element.contains(note))) return [];
  const paragraph = note.closest<HTMLElement>('p,li,td,th,h1,h2,h3,h4,h5,h6') ?? note.parentElement ?? container;
  const view = container.ownerDocument.defaultView!;
  const style = view.getComputedStyle(paragraph);
  const vertical = style.writingMode.startsWith('vertical');
  const box = paragraph.getBoundingClientRect();
  const range = container.ownerDocument.createRange(); range.selectNodeContents(paragraph); range.setEndBefore(note);
  const rects = Array.from(range.getClientRects());
  const previous = rects.at(-1);
  const size = parseFloat(view.getComputedStyle(note).fontSize) || parseFloat(style.fontSize)/2;
  const paddingStart = parseFloat(style.paddingInlineStart)||0;
  const paddingEnd = parseFloat(style.paddingInlineEnd)||0;
  const full = (vertical ? paragraph.clientHeight : paragraph.clientWidth)-paddingStart-paddingEnd;
  const scale = (vertical ? box.height/paragraph.offsetHeight : box.width/paragraph.offsetWidth) || 1;
  let unit=Math.max(size/2,minimumUnits?.[index] ?? 0);
  let inset=0;
  for(const line of note.querySelectorAll<HTMLElement>(':scope > .mdi-warichu-fragment > .mdi-warichu-line[data-mdi-width]')) {
   const width=Number(line.dataset.mdiWidth);if(!(width>0)) continue;
   const contents=container.ownerDocument.createRange();contents.selectNodeContents(line);
   const bounds=contents.getBoundingClientRect();
   const lineBox=line.getBoundingClientRect();
   inset=Math.max(inset,(vertical?bounds.top-lineBox.top:style.direction==='rtl'?lineBox.right-bounds.right:bounds.left-lineBox.left)/scale);
   unit=Math.max(unit,(vertical?bounds.height:bounds.width)/scale/width);
  }
  const remaining = !previous ? full : vertical ? (box.bottom-previous.bottom)/scale-paddingEnd : style.direction === 'rtl' ? (previous.left-box.left)/scale-paddingStart : (box.right-previous.right)/scale-paddingEnd;
  return [{index,unit,children:JSON.parse(note.dataset.mdiWarichuSource!),options:{firstCapacity:Math.max(1,Math.floor(((remaining<=0?full:Math.min(full,remaining))-inset)/unit)),continuationCapacity:Math.max(1,Math.floor((full-inset)/unit))}}];
 });
}
/** If Rust reports that only the first remaining slot is too small, use the next body line. */
export function layoutMeasuredMdiWarichu(measurement:MdiWarichuMeasurement):MdiWarichuFragment[] {
 const {children,options}=measurement;
 const fragments=layoutMdiWarichu(children,options);
 const first=fragments[0];
 return first?.overflow && options.firstCapacity<options.continuationCapacity && Math.max(...first.widths)<=options.continuationCapacity
  ? layoutMdiWarichu(children,{...options,firstCapacity:options.continuationCapacity})
  : fragments;
}
/** Applies Rust-rendered presentation only; never modifies canonical source. */
export function applyMdiWarichu(updates: {index:number;fragments:MdiWarichuFragment[]}[], container:HTMLElement = document.body): boolean {
 const notes = container.querySelectorAll<HTMLElement>('[data-mdi-warichu-source]');
 let changed = false;
 for (const {index,fragments} of updates) {
  const note = notes[index]; if (!note) continue;
  const html = fragments.map(fragment => `<span class="mdi-warichu-fragment" style="display:inline-flex;flex-direction:column;vertical-align:middle;text-align:start"${fragment.overflow?' data-mdi-overflow="true"':''}>${fragment.html.map((line,row)=>`<span class="mdi-warichu-line" data-mdi-width="${fragment.widths[row]}" style="display:block;white-space:nowrap;min-block-size:1em">${line}</span>`).join('')}</span>${fragment.hardBreakAfter?'<br>':''}`).join('');
  // Browser serialization normalizes markup. Compare the intended markup cache.
  if (note.dataset.mdiWarichuLayout === html) continue;
  note.innerHTML = html;
  note.dataset.mdiWarichuLayout = html;
  changed = true;
 }
 return changed;
}
export interface MdiWarichuSettleOptions { timeoutMs?:number; signal?:AbortSignal }
export interface MdiWarichuLayoutController {
 configure():void;
 settled(options?:MdiWarichuSettleOptions):Promise<void>;
 dispose():void;
}
/** Attach to read-only Rust-rendered HTML. Editable editors consume layoutMdiWarichu directly. */
export function attachMdiWarichuLayout(container:HTMLElement):MdiWarichuLayoutController {
 const win = container.ownerDocument.defaultView!;
 const realm = win as unknown as typeof globalThis;
 let disposed = false, scheduled = false, pending = false;
 let affected:Set<HTMLElement>|null=null;
 let rejectDisposal!:(reason:Error)=>void;
 const disposal=new Promise<never>((_,reject)=>{rejectDisposal=reject;});void disposal.catch(()=>{});
 let ready:Promise<void> = Promise.resolve();
 const publish = () => { (win as unknown as {__mdiWarichuLayoutReady:Promise<void>}).__mdiWarichuLayoutReady = ready; void ready.catch(()=>{}); };
 const frame = async () => {
  let id=0;
  try {await Promise.race([new Promise<void>(resolve=>{id=win.requestAnimationFrame(()=>resolve());}),disposal]);}
  finally {win.cancelAnimationFrame?.(id);}
 };
 const observe = () => mutation.observe(container.ownerDocument.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeOldValue:true,attributeFilter:['style','class','dir','data-mdi-warichu-source','href','rel','media','disabled']});
 const mutation = new realm.MutationObserver(records=>{
  const head=container.ownerDocument.head;
  const headTrees=new Set<Node>();
  const isInTree=(node:Node|null|undefined,tree:Node)=>node===tree || (tree.nodeType===1 && typeof (tree as Element).contains==='function' && (tree as Element).contains(node ?? null));
  // Attribute records can point at a node which has already left <head>. Associate
  // every added or removed tree with its head mutation before inspecting records,
  // independently of the order chosen by the browser for this delivery.
  let found=true;
  while(found) {
   found=false;
   for(const record of records) {
    if(record.type!=='childList') continue;
    const targetInHead=record.target===head || head?.contains(record.target) || Array.from(headTrees).some(tree=>isInTree(record.target,tree));
    if(!targetInHead) continue;
    for(const node of [...Array.from(record.addedNodes),...Array.from(record.removedNodes)]) if(!headTrees.has(node)) {headTrees.add(node);found=true;}
   }
  }
  const isHeadMutation=(node:Node|null|undefined)=>Boolean(node && (node===head || head?.contains(node) || Array.from(headTrees).some(tree=>isInTree(node,tree))));
  const stylesheetRel=(rel:string|null|undefined)=>rel?.split(/\s+/).some(value=>value.toLowerCase()==='stylesheet') ?? false;
  const stylesheetInTree=(node:Node)=>{
   const elements=node.nodeType===1 ? [node as Element,...Array.from((node as Element).querySelectorAll?.('style,link') ?? [])] : [];
   return elements.some(element=>element.tagName==='STYLE' || (element.tagName==='LINK' && stylesheetRel(element.getAttribute('rel'))));
  };
  for(const record of records) {
   const element=record.target.nodeType===1?record.target as HTMLElement:record.target.parentElement;
   const candidate=element?.closest?.('style,link');
   const stylesheetMutation=(isHeadMutation(record.target) || isHeadMutation(element)) && (
    candidate?.tagName==='STYLE' ||
    (record.type==='attributes' && candidate?.tagName==='LINK' && (
     record.attributeName==='rel'
      ? stylesheetRel(candidate.getAttribute('rel')) || stylesheetRel(record.oldValue)
      : ['href','media','disabled'].includes(record.attributeName ?? '') && stylesheetRel(candidate.getAttribute('rel'))
    )) ||
    (record.type==='childList' && [...Array.from(record.addedNodes),...Array.from(record.removedNodes)].some(stylesheetInTree))
   );
   if(stylesheetMutation) {invalidate();continue;}
   if(!container.contains(record.target) && !(typeof record.target.contains==='function' && record.target.contains(container))) continue;
   const paragraph=element?.closest<HTMLElement>('p,li,td,th,h1,h2,h3,h4,h5,h6');
   invalidate(paragraph && container.contains(paragraph)?paragraph:undefined);
  }
 });
 const configure=()=>invalidate();
 const invalidate = (paragraph?:HTMLElement) => {
  if(paragraph) affected?.add(paragraph);else affected=null;
  if(disposed) return;
  pending = true;
  if(scheduled) return;
  scheduled = true;
  ready = (async()=>{
   try {
    do {
     syncObservedParagraphs();
     pending=false;
     const batch=affected===null?undefined:Array.from(affected);affected=new Set();
     await Promise.race([container.ownerDocument.fonts.ready,disposal]);
     await frame();
     let stable=false;
     const minimumUnits:Record<number,number>={};
     for(let pass=0;pass<12;pass++) {
      if(disposed) return;
      const updates=measureMdiWarichu(container,batch,minimumUnits).map(m=>{
       if(m.unit) minimumUnits[m.index]=m.unit;
       return {index:m.index,fragments:layoutMeasuredMdiWarichu(m)};
      });
      mutation.disconnect();
      let changed:boolean;
      try {changed=applyMdiWarichu(updates,container);} finally {observe();}
      await frame();
      if(!changed) {stable=true;break;}
     }
     if(!stable) throw new Error('Warichu layout did not stabilize');
    } while(pending && !disposed);
   } finally { scheduled=false; }
  })(); publish();
 };
 const resize = new realm.ResizeObserver(entries=>{for(const entry of entries) invalidate(entry.target===container?undefined:entry.target as HTMLElement);}); resize.observe(container);
 const observed=new Set<HTMLElement>();
 const syncObservedParagraphs=()=>{
  const paragraphs=new Set(container.querySelectorAll<HTMLElement>('p,li,td,th,h1,h2,h3,h4,h5,h6'));
  for(const paragraph of observed) if(!paragraphs.has(paragraph)){resize.unobserve(paragraph);observed.delete(paragraph);}
  for(const paragraph of paragraphs) if(!observed.has(paragraph)){resize.observe(paragraph);observed.add(paragraph);}
 };
 syncObservedParagraphs();
 observe();
 container.ownerDocument.fonts.addEventListener('loadingdone',configure);
 const stylesheetLoad=(event:Event)=>{const target=event.target as Element|null;if(target?.matches?.('link[rel~="stylesheet"]')) configure();};
 container.ownerDocument.addEventListener('load',stylesheetLoad,true);
 win.addEventListener('resize',configure);
 win.visualViewport?.addEventListener('resize',configure);
 configure();
 return {configure, settled:({timeoutMs=10000,signal}={})=>new Promise<void>((resolve,reject)=>{
  if(signal?.aborted) { reject(signal.reason ?? new Error('Warichu layout cancelled')); return; }
  const finish=(error?:unknown)=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve();};
  const abort=()=>finish(signal?.reason ?? new Error('Warichu layout cancelled'));
  const timer=setTimeout(()=>finish(new Error('Warichu layout timed out')),timeoutMs);
  signal?.addEventListener('abort',abort,{once:true});
  const latest=async()=>{let current;do {current=ready;await Promise.race([current,disposal]);} while(current!==ready);};
  latest().then(()=>finish(),finish);
 }),dispose:()=>{disposed=true;rejectDisposal(new Error('Warichu layout disposed'));resize.disconnect();mutation.disconnect();container.ownerDocument.fonts.removeEventListener('loadingdone',configure);container.ownerDocument.removeEventListener('load',stylesheetLoad,true);win.removeEventListener('resize',configure);win.visualViewport?.removeEventListener('resize',configure);}};
}
