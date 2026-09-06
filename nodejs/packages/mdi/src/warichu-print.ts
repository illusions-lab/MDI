import { measureMdiWarichu, applyMdiWarichu, layoutMeasuredMdiWarichu, type MdiWarichuMeasurement, type MdiWarichuSettleOptions } from './warichu-browser.js';
/** Execute JavaScript in the print document. Electron and Playwright can supply their existing page. */
export type MdiPrintEvaluate = (javascript:string)=>Promise<unknown>;
/** Physical page dimensions resolved by the upstream Chromium print profile. */
export interface MdiPrintPage {
 widthMm:number;
 heightMm:number;
 marginsMm:{top:number;right:number;bottom:number;left:number};
}
export interface MdiPrintLayoutOptions extends MdiWarichuSettleOptions {
 /** Pass prepared.page so measurement uses paper space rather than the host window viewport. */
 page?:MdiPrintPage;
}
/** Wait for fonts, then measure and apply the shared Rust layout before permitting printing. */
export async function settleMdiPrintLayout(evaluate:MdiPrintEvaluate, {timeoutMs=10000,signal,page}:MdiPrintLayoutOptions={}):Promise<void> {
 let contentWidthMm:number|undefined,contentHeightMm:number|undefined;
 if(page) {
  contentWidthMm=page.widthMm-page.marginsMm.left-page.marginsMm.right;
  contentHeightMm=page.heightMm-page.marginsMm.top-page.marginsMm.bottom;
  if(!Number.isFinite(contentWidthMm)||!Number.isFinite(contentHeightMm)||contentWidthMm<=0||contentHeightMm<=0) {
   throw new RangeError('MDI print page must have positive finite printable dimensions');
  }
 }
 let timer:ReturnType<typeof setTimeout>|undefined;
 let abort:()=>void=()=>{};
 let stopped=false;
 const failure = new Promise<never>((_,reject)=>{
  abort=()=>{stopped=true;reject(signal?.reason ?? new Error('MDI print layout cancelled'));};
  if(signal?.aborted) {abort();return;}
  signal?.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>{stopped=true;reject(new Error('MDI print layout timed out'));},timeoutMs);
 });
 const run=async()=>{
  if(stopped) return;
  if(page) {
   await evaluate(`document.body.style.setProperty("inline-size", (getComputedStyle(document.body).writingMode.startsWith("vertical") ? ${contentHeightMm} : ${contentWidthMm}) + "mm")`);
   if(stopped) return;
  }
  await evaluate('document.fonts.ready.then(() => undefined)');
  const minimumUnits:Record<number,number>={};
  for(let pass=0;pass<12;pass++) {
   if(stopped) return;
   const measurements=await evaluate(`(${measureMdiWarichu.toString()})(document.body,undefined,${JSON.stringify(minimumUnits)})`) as MdiWarichuMeasurement[];
   if(stopped) return;
   const updates=measurements.map(m=>{
    if(m.unit) minimumUnits[m.index]=m.unit;
    return {index:m.index,fragments:layoutMeasuredMdiWarichu(m)};
   });
   const changed=await evaluate(`(${applyMdiWarichu.toString()})(${JSON.stringify(updates)})`);
   if(stopped) return;
   await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))');
   if(!changed) return;
  }
  throw new Error('MDI print layout did not stabilize');
 };
 try {await Promise.race([failure,run()]);} finally {stopped=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
