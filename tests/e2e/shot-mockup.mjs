import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1380, height: 1000 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto('file:///home/user/Rpg-de-estilo-de-vida/design/mockup.html');
await p.waitForTimeout(1800);
await p.screenshot({ path: 'test-results/tour-today.png' });
const shots = [['ranks','tour-ranks'],['skills','tour-skills'],['shop','tour-shop'],['campaign','tour-campaign'],['gym2','tour-gym']];
for (const [id, name] of shots) {
  await p.click(`#nav button[data-go="${id}"]`);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `test-results/${name}.png`, clip: { x: 290, y: 150, width: 440, height: 850 } });
}
await p.click('#nav button[data-go="today"]');
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(600);
await p.click('#anim button[data-anim="levelup"]');
await p.waitForTimeout(2300);
await p.screenshot({ path: 'test-results/tour-levelup.png', clip: { x: 290, y: 150, width: 440, height: 850 } });
await p.waitForTimeout(2400);
await p.click('#anim button[data-anim="medal"]');
await p.waitForTimeout(1300);
await p.screenshot({ path: 'test-results/tour-medal.png', clip: { x: 290, y: 150, width: 440, height: 850 } });
console.log('errors:', errors);
await b.close();
