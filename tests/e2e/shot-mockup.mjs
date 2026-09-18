import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1740, height: 1000 } });
await p.goto('file:///home/user/Rpg-de-estilo-de-vida/design/mockup.html');
await p.waitForTimeout(2600);
await p.screenshot({ path: 'test-results/mockup-v2-desktop.png' });
await p.waitForTimeout(2200);
await p.screenshot({ path: 'test-results/mockup-v2-levelup.png', clip: { x: 1300, y: 40, width: 440, height: 940 } });
await b.close();
