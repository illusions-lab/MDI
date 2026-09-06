import { layoutMdiWarichu, type MdiWarichuFragment, type MdiWarichuOptions } from './index.js';

export interface MdiWarichuMeasurement {
 index: number;
 children: Record<string, unknown>[];
 options: MdiWarichuOptions;
}
/** Self-contained for execution in a browser hosted by Electron or Playwright. */
export function measureMdiWarichu(container: HTMLElement = document.body, affected?: readonly HTMLElement[]): MdiWarichuMeasurement[] {
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
  const remaining = !previous ? full : vertical ? (box.bottom-previous.bottom)/scale-paddingEnd : style.direction === 'rtl' ? (previous.left-box.left)/scale-paddingStart : (box.right-previous.right)/scale-paddingEnd;
  return [{index,children:JSON.parse(note.dataset.mdiWarichuSource!),options:{firstCapacity:Math.max(1,Math.floor((remaining<=0?full:Math.min(full,remaining))*2/size)),continuationCapacity:Math.max(1,Math.floor(full*2/size))}}];
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
  const html = fragments.map(fragment => `<span class="mdi-warichu-fragment" style="display:inline-flex;flex-direction:column;vertical-align:middle;text-align:start"${fragment.overflow?' data-mdi-overflow="true"':''}>${fragment.html.map(line=>`<span class="mdi-warichu-line" style="display:block;white-space:nowrap;min-block-size:1em">${line}</span>`).join('')}</span>${fragment.hardBreakAfter?'<br>':''}`).join('');
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
 const observe = () => mutation.observe(container.ownerDocument.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['style','class','dir','data-mdi-warichu-source']});
 const mutation = new realm.MutationObserver(records=>{
  for(const record of records) {
   if(!container.contains(record.target) && !record.target.contains(container)) continue;
   const element=record.target.nodeType===1?record.target as HTMLElement:record.target.parentElement;
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
     for(let pass=0;pass<12;pass++) {
      if(disposed) return;
      const updates=measureMdiWarichu(container,batch).map(m=>({index:m.index,fragments:layoutMeasuredMdiWarichu(m)}));
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
 }),dispose:()=>{disposed=true;rejectDisposal(new Error('Warichu layout disposed'));resize.disconnect();mutation.disconnect();container.ownerDocument.fonts.removeEventListener('loadingdone',configure);win.removeEventListener('resize',configure);win.visualViewport?.removeEventListener('resize',configure);}};
}
