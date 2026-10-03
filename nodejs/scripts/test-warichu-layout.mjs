import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { renderHtml } from '../packages/mdi/dist/index.js';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const source = '本文[[warichu:一二三四五六]]続き';
  await page.setContent(renderHtml(source));
  await page.evaluate(() => document.fonts.ready);
  for (const writingMode of ['horizontal-tb', 'vertical-rl']) {
    const boxes = await page.evaluate(mode => {
      document.body.style.cssText = `font-size:32px;writing-mode:${mode}`;
      return [...document.querySelectorAll('.mdi-warichu-line')].map(line => {
        const r = line.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, text: line.textContent };
      });
    }, writingMode);
    assert.equal(boxes.length, 2);
    assert.equal(boxes.map(b => b.text).join(''), '一二三四五六');
    if (writingMode === 'horizontal-tb') {
      assert.equal(boxes[0].x, boxes[1].x);
      assert(boxes[1].y > boxes[0].y);
    } else {
      assert.equal(boxes[0].y, boxes[1].y);
      assert(boxes[0].x > boxes[1].x);
    }
    assert(boxes.every(b => b.width > 0 && b.height > 0));
  }
  await page.setContent(renderHtml(`[[warichu:${'一二三四五六七八九十'.repeat(20)}]]`));
  await page.evaluate(() => { document.body.style.cssText = 'width:180px;font-size:16px'; });
  const long = await page.locator('.mdi-warichu-fragment').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().y));
  assert(long.length > 1);
  assert(new Set(long).size > 1, 'long note must wrap between fragments');
  console.log('Warichu Chromium horizontal, vertical, reading order and fragment wrapping passed.');
} finally {
  await browser.close();
}
