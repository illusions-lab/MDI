import {expect,it,vi} from 'vitest';
import {settleMdiPrintLayout} from './warichu-print.js';
it('waits for fonts and stable presentation without modifying source',async()=>{
 const evaluate=vi.fn(async(code:string)=>code.includes('measureMdiWarichu')?[]:false);
 await settleMdiPrintLayout(evaluate);
 expect(evaluate).toHaveBeenCalledTimes(4);
 expect(evaluate.mock.calls[0][0]).toContain('document.fonts.ready');
});
it('rejects a font/evaluation timeout instead of printing an unfinished layout',async()=>{
 await expect(settleMdiPrintLayout(()=>new Promise(()=>{}),{timeoutMs:5})).rejects.toThrow('timed out');
});
it('rejects cancellation without starting evaluation',async()=>{
 const controller=new AbortController();controller.abort(new Error('cancelled'));
 const evaluate=vi.fn();
 await expect(settleMdiPrintLayout(evaluate,{signal:controller.signal})).rejects.toThrow('cancelled');
 expect(evaluate).not.toHaveBeenCalled();
});
it('rejects layouts that do not converge',async()=>{
 await expect(settleMdiPrintLayout(async code=>code.includes('measureMdiWarichu')?[]:true)).rejects.toThrow('did not stabilize');
});
it('stops host writes when cancelled during pending font evaluation',async()=>{
 const controller=new AbortController();let release!:()=>void;
 const evaluate=vi.fn(()=>new Promise<void>(resolve=>{release=resolve}));
 const pending=settleMdiPrintLayout(evaluate,{signal:controller.signal});
 controller.abort(new Error('cancelled during fonts'));
 await expect(pending).rejects.toThrow('cancelled during fonts');
 release();await Promise.resolve();await Promise.resolve();
 expect(evaluate).toHaveBeenCalledTimes(1);
});
it('constrains the transient print body using resolved physical page margins',async()=>{
 const evaluate=vi.fn(async(code:string)=>code.includes('measureMdiWarichu')?[]:false);
 await settleMdiPrintLayout(evaluate,{page:{widthMm:148,heightMm:210,marginsMm:{top:15,right:15,bottom:15,left:15}}});
 expect(evaluate.mock.calls[0][0]).toContain('document.body.style.setProperty("inline-size"');
 expect(evaluate.mock.calls[0][0]).toContain('? 180 : 118');
 expect(evaluate.mock.calls[1][0]).toContain('document.fonts.ready');
});
it('rejects impossible physical print geometry without evaluating the document',async()=>{
 const evaluate=vi.fn();
 for(const widthMm of [0,NaN,Infinity]) {
  await expect(settleMdiPrintLayout(evaluate,{page:{widthMm,heightMm:210,marginsMm:{top:15,right:15,bottom:15,left:15}}})).rejects.toThrow('printable dimensions');
 }
 expect(evaluate).not.toHaveBeenCalled();
});
it('stops before font evaluation when cancelled during physical viewport preparation',async()=>{
 const abort=new AbortController();let release!:()=>void;
 const evaluate=vi.fn(()=>new Promise<void>(resolve=>{release=resolve}));
 const pending=settleMdiPrintLayout(evaluate,{signal:abort.signal,page:{widthMm:148,heightMm:210,marginsMm:{top:15,right:15,bottom:15,left:15}}});
 abort.abort(new Error('cancelled viewport'));await expect(pending).rejects.toThrow('cancelled viewport');
 release();await Promise.resolve();await Promise.resolve();expect(evaluate).toHaveBeenCalledTimes(1);
});
