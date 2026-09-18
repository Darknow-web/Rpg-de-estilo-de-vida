/**
 * Recorrido E2E contra los emuladores de Firebase (sin proyecto real, sin Gemini):
 * registro → entrevista → campaña (fallback local) → completar misión con foto → feedback → tienda → tasador → árbol.
 * Uso: node tests/e2e/smoke.mjs (con emuladores y servidor en marcha; ver package.json "e2e").
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.E2E_BASE ?? 'http://localhost:8091';
const OUT = process.env.E2E_OUT ?? 'test-results/e2e';
fs.mkdirSync(OUT, { recursive: true });
const exe = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es', permissions: [] });
const page = await context.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
let step = 0;
const shot = async (name) => {
  step++;
  await page.screenshot({ path: path.join(OUT, `${String(step).padStart(2, '0')}-${name}.png`) });
};
const fail = (msg) => {
  console.error('E2E FAIL:', msg);
  console.error(logs.slice(-30).join('\n'));
  process.exit(1);
};

try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await shot('auth');
  const email = `e2e_${Date.now()}@example.com`;
  await page.getByText('No tengo cuenta').click();
  await page.getByPlaceholder('Correo').fill(email);
  await page.getByPlaceholder(/Contraseña/).fill('secret123');
  await page.getByRole('button', { name: 'Crear mi personaje' }).click();

  // Entrevista
  await page.getByText('¿Qué quieres lograr').waitFor({ timeout: 20000 });
  await shot('q1');
  const t0 = Date.now();
  await page.locator('textarea').fill('Correr 10 km sin parar y sentirme fuerte');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.locator('textarea').fill('Porque quiero tener energía para mi familia');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByText('Apps de hábitos').click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: '30 minutos' }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Mañana' }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'No ver resultados' }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.locator('textarea').fill('me lavo los dientes, tomo café');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.locator('textarea').fill('una siesta, unas zapatillas, un viaje');
  await page.getByRole('button', { name: 'Crear mi personaje' }).click();
  const interviewSeconds = (Date.now() - t0) / 1000;

  await page.getByText('Esto es lo que proponemos').waitFor({ timeout: 90000 });
  await shot('campaign');
  const classText = await page.locator('.font-display.text-lg').first().innerText();
  const dailyCount = await page.locator('section', { hasText: '3 misiones diarias' }).locator('.rounded-xl.bg-void').count();
  if (dailyCount !== 3) fail(`esperaba 3 misiones diarias, hay ${dailyCount}`);
  await page.getByRole('button', { name: /Aceptar y empezar/ }).click();

  // Hoy
  await page.getByText('Bitácora de hoy').waitFor({ timeout: 20000 });
  await shot('today');
  const cards = page.locator('.panel', { hasText: 'Foto y completar' });
  const n = await cards.count();
  if (n < 1) fail('no hay misiones completables hoy');

  // Tres toques: (1) botón foto → input capture (Playwright sube el archivo) → recompensa
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8Dwn4EIwDiqEgCQ2wEBWAdzvwAAAABJRU5ErkJggg==';
  const tmp = path.join(OUT, 'evidence.png');
  fs.writeFileSync(tmp, Buffer.from(pngBase64, 'base64'));
  const input = page.locator('input[type=file][capture]').first();
  await input.setInputFiles(tmp);
  await page.getByText(/\+\d+ XP/).first().waitFor({ timeout: 20000 });
  await shot('reward');
  await page.waitForTimeout(2200);
  const done = await page.locator('.line-through').count();
  if (done < 1) fail('la misión no quedó marcada como hecha');
  const coins = await page.locator('header').innerText();
  await shot('today-after');

  // Personaje
  await page.getByRole('link', { name: /Personaje/ }).click();
  await page.getByText('Próximo desbloqueo').waitFor();
  await shot('character');
  const levelText = await page.locator('header').innerText();

  // Tienda + tasador local
  await page.getByRole('link', { name: /Tienda/ }).click();
  await page.getByText('Tienda').first().waitFor();
  await page.waitForFunction(() => document.querySelectorAll('button.panel').length >= 4, null, { timeout: 15000 }).catch(() => null);
  const rewardsCount = await page.locator('button.panel').count();
  if (rewardsCount < 4) fail(`tienda con ${rewardsCount} recompensas (< 4)`);
  await shot('shop');
  await page.getByRole('button', { name: /Recompensa propia/ }).click();
  await page.getByPlaceholder(/canjear/).fill('Pizza y cerveza');
  await page.getByRole('button', { name: 'Tasar' }).click();
  await page.getByText(/^Tasación (con IA|local)$/).waitFor({ timeout: 30000 });
  await shot('appraisal');
  const apText = await page.locator('.rounded-xl.bg-void').first().innerText();
  await page.getByRole('button', { name: 'Guardar en la tienda' }).click();
  await page.waitForTimeout(800);

  // Árbol (aparece al tener puntos)
  await page.getByRole('link', { name: /Árbol/ }).click().catch(() => null);
  await page.waitForTimeout(500);
  await shot('skills');

  // Cerrar sesión y entrar con otra cuenta: no ve nada
  await page.goto(`${BASE}/settings`);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.getByText('No tengo cuenta').waitFor();
  await page.getByText('No tengo cuenta').click();
  await page.getByPlaceholder('Correo').fill(`other_${Date.now()}@example.com`);
  await page.getByPlaceholder(/Contraseña/).fill('secret123');
  await page.getByRole('button', { name: 'Crear mi personaje' }).click();
  await page.getByText('¿Qué quieres lograr').waitFor({ timeout: 20000 });
  await shot('second-user');

  console.log(JSON.stringify({ ok: true, interviewSeconds, classText, dailyCount, rewardsCount, header: coins.replace(/\n/g, ' | '), level: levelText.split('\n')[0], appraisal: apText.slice(0, 160) }, null, 2));
  const errors = logs.filter((l) => l.startsWith('[pageerror]') || (l.startsWith('[error]') && !/favicon|index/.test(l)));
  if (errors.length) {
    console.log('Errores de consola:\n' + errors.join('\n'));
  }
} catch (e) {
  await shot('failure').catch(() => null);
  fail(e.message);
} finally {
  await browser.close();
}
