import {expect,it} from 'vitest';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {renderHtml} from '@illusions-lab/mdi';
import {renderHtmlToPdf} from './index.js';

it('extracts automatic note text in source order and places its rows at half body size',async()=>{
 const note='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(14);
 const html=renderHtml(`PREFIX[[warichu:${note}]]SUFFIX`).replace('</head>','<style>body{font-family:monospace;font-size:24px}p{width:220px}</style></head>');
 const pdf=await renderHtmlToPdf(html);
 const loadingTask=getDocument({data:new Uint8Array(pdf)});
 const document=await loadingTask.promise;
 try {
  const page=await document.getPage(1);const content=await page.getTextContent();
  const items=content.items.filter((item):item is Extract<typeof item,{str:string}>=>'str' in item);
  const sourceItems=items.filter(item=>/^[A-Z]+$/.test(item.str));
  const text=sourceItems.map(item=>item.str).join('');
  expect(text).toBe(`PREFIX${note}SUFFIX`);
  const body=items.find(item=>item.str.includes('PREFIX'))!;
  const rows=sourceItems.filter(item=>item.str && !item.str.includes('PREFIX') && !item.str.includes('SUFFIX'));
  expect(rows.length).toBeGreaterThan(4);
  expect(rows.every(item=>Math.abs(item.transform[3]/body.transform[3]-.5)<.01)).toBe(true);
  const first=rows[0];
  expect(rows.some(item=>Math.abs(item.transform[4]-first.transform[4])<.1 && Math.abs(item.transform[5]-first.transform[5])>1)).toBe(true);
  expect(new Set(rows.map(item=>Math.round(item.transform[5]))).size).toBeGreaterThan(2);
 } finally {await loadingTask.destroy();}
},30000);
