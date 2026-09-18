/**
 * Pruebas explícitas de las reglas de seguridad (emulador de Firestore).
 * Ejecutar con: npm run test:rules
 */
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import fs from 'node:fs';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-life-quest',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: process.env.FIRESTORE_EMULATOR_HOST?.split(':')[0] ?? 'localhost', port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1] ?? 8085) },
  });
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const anon = () => env.unauthenticatedContext().firestore();

describe('aislamiento entre jugadores', () => {
  it('alice escribe y lee lo suyo; bob y anónimo no ven nada de alice', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'players/alice'), { profile: { displayName: 'A' } }));
    await assertSucceeds(getDoc(doc(alice(), 'players/alice')));
    await assertFails(getDoc(doc(bob(), 'players/alice')));
    await assertFails(setDoc(doc(bob(), 'players/alice'), { hacked: true }));
    await assertFails(getDoc(doc(anon(), 'players/alice')));
    await assertSucceeds(setDoc(doc(alice(), 'players/alice/missions/m1'), { name: 'x' }));
    await assertFails(getDocs(collection(bob(), 'players/alice/missions')));
    await assertFails(setDoc(doc(bob(), 'players/alice/wallet/w1'), { delta: 999 }));
  });
  it('nadie puede crear un jugador con otro uid', async () => {
    await assertFails(setDoc(doc(alice(), 'players/bob'), { profile: {} }));
  });
});

describe('historial inmutable', () => {
  it('wallet: crear sí, editar y borrar no', async () => {
    const ref = doc(alice(), 'players/alice/wallet/w1');
    await assertSucceeds(setDoc(ref, { delta: 10, balanceAfter: 10 }));
    await assertFails(updateDoc(ref, { delta: 999 }));
    await assertFails(deleteDoc(ref));
  });
  it('completions: solo se puede anular, sin tocar XP ni monedas; nunca borrar', async () => {
    const ref = doc(alice(), 'players/alice/completions/c1');
    await assertSucceeds(setDoc(ref, { missionId: 'm1', day: '2026-01-01', xpAwarded: 20, coinsAwarded: 10, status: 'onTime' }));
    await assertFails(updateDoc(ref, { xpAwarded: 9999 }));
    await assertFails(updateDoc(ref, { status: 'onTime', day: '2026-01-02' }));
    await assertSucceeds(updateDoc(ref, { status: 'annulled', annulReason: 'x' }));
    await assertFails(deleteDoc(ref));
  });
  it('failures, skills y medals no se editan ni borran', async () => {
    const f = doc(alice(), 'players/alice/failures/f1');
    await assertSucceeds(setDoc(f, { missionId: 'm1', day: '2026-01-01', heartsLost: 1 }));
    await assertFails(updateDoc(f, { heartsLost: 0 }));
    await assertFails(deleteDoc(f));
    const s = doc(alice(), 'players/alice/skills/corazon_extra_1');
    await assertSucceeds(setDoc(s, { nodeId: 'corazon_extra_1', resetGeneration: 0 }));
    await assertFails(deleteDoc(s));
  });
  it('missions: no se borran (solo se archivan)', async () => {
    const m = doc(alice(), 'players/alice/missions/m1');
    await assertSucceeds(setDoc(m, { name: 'x', active: true }));
    await assertSucceeds(updateDoc(m, { active: false }));
    await assertFails(deleteDoc(m));
  });
});

describe('evidencia', () => {
  it('rechaza fotos mayores a 300 KB y solo permite borrar archivadas', async () => {
    const big = doc(alice(), 'players/alice/evidence/e1');
    await assertFails(setDoc(big, { missionId: 'm1', completionId: 'c1', sizeBytes: 400_000, archived: false }));
    const ok = doc(alice(), 'players/alice/evidence/e2');
    await assertSucceeds(setDoc(ok, { missionId: 'm1', completionId: 'c1', sizeBytes: 90_000, archived: false }));
    await assertFails(deleteDoc(ok));
    await assertFails(updateDoc(ok, { missionId: 'otra' }));
    await assertSucceeds(updateDoc(ok, { archived: true }));
    await assertSucceeds(deleteDoc(ok));
  });
});

describe('sin acceso fuera del subárbol', () => {
  it('colecciones desconocidas y public_profiles ajenos están cerrados', async () => {
    await assertFails(setDoc(doc(alice(), 'admin/config'), { x: 1 }));
    await assertFails(getDoc(doc(alice(), 'public_profiles/bob')));
    await assertSucceeds(setDoc(doc(alice(), 'public_profiles/alice'), { displayName: 'A' }));
  });
});
