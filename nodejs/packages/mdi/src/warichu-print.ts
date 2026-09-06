import { measureMdiWarichu, applyMdiWarichu, layoutMeasuredMdiWarichu, type MdiWarichuMeasurement, type MdiWarichuSettleOptions } from './warichu-browser.js';
/** Execute JavaScript in the print document. Electron and Playwright can supply their existing page. */
export type MdiPrintEvaluate = (javascript:string)=>Promise<unknown>;
/** Wait for fonts, then measure and apply the shared Rust layout before permitting printing. */
export async function settleMdiPrintLayout(evaluate:MdiPrintEvaluate, {timeoutMs=10000,signal}:MdiWarichuSettleOptions={}):Promise<void> {
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
  await evaluate('document.fonts.ready.then(() => undefined)');
  for(let pass=0;pass<12;pass++) {
   if(stopped) return;
   const measurements=await evaluate(`(${measureMdiWarichu.toString()})()`) as MdiWarichuMeasurement[];
   if(stopped) return;
   const updates=measurements.map(m=>({index:m.index,fragments:layoutMeasuredMdiWarichu(m)}));
   const changed=await evaluate(`(${applyMdiWarichu.toString()})(${JSON.stringify(updates)})`);
   if(stopped) return;
   await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))');
   if(!changed) return;
  }
  throw new Error('MDI print layout did not stabilize');
 };
 try {await Promise.race([failure,run()]);} finally {stopped=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
