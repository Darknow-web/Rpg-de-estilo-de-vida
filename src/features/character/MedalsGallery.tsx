import type { CSSProperties, ReactNode } from 'react';
import { useGame, useGameContext } from '@/state/game';
import { RANKS, MASTERY } from '@/lib/game-balance';
import type { Medal } from '@/shared/types';
import { Icon } from '@/components/ui/Icon';
import { Card, Label, MedalShield, PageHead, RankSquare, type MedalMetal } from '@/components/ui/primitives';
import type { IconId } from '@/components/ui/Icon';

interface MedalDef {
  key: string;
  name: string;
  cond: string;
  metal: MedalMetal;
  glyph?: IconId;
  letter?: string;
  art: string;
  earned: (medals: Medal[]) => boolean;
}

/** Catálogo de medallas del juego con su condición y su arte. */
export const MEDAL_DEFS: MedalDef[] = [
  { key: 'chain', name: 'Cadena completa', cond: 'Termina una cadena de misiones', metal: 'bronze', glyph: 'link', art: 'medal-chain-bronze', earned: (ms) => ms.some((m) => m.kind === 'chain') },
  { key: 'mastered', name: 'Misión dominada', cond: `${MASTERY.mastered.days} días, ≤${MASTERY.mastered.maxFails} fallas`, metal: 'silver', glyph: 'check', art: 'medal-mastered-silver', earned: (ms) => ms.some((m) => m.kind === 'mastered') },
  { key: 'automated', name: 'Rasgo del personaje', cond: `${MASTERY.automated.cumulativeDays} días acumulados`, metal: 'gold', glyph: 'star', art: 'medal-trait-gold', earned: (ms) => ms.some((m) => m.kind === 'automated') },
  { key: 'resurrection', name: 'Renacido', cond: 'Vuelve tras caer', metal: 'silver', glyph: 'phoenix', art: 'medal-reborn-silver', earned: (ms) => ms.some((m) => m.kind === 'resurrection') },
  { key: 'boss', name: 'Boss vencido', cond: 'Completa una misión boss', metal: 'gold', glyph: 'skull', art: 'medal-boss-gold', earned: (ms) => ms.some((m) => m.kind === 'boss') },
  { key: 'main', name: 'Campaña completa', cond: 'Todos los hitos de la principal', metal: 'gold', glyph: 'flag', art: 'medal-campaign-gold', earned: (ms) => ms.some((m) => m.kind === 'main') },
  ...(['C', 'B', 'A', 'S'] as const).map<MedalDef>((r) => ({
    key: `rank_${r}`,
    name: `Rango ${r}`,
    cond: `Nivel ${RANKS.find((x) => x.id === r)?.minLevel}`,
    metal: r,
    letter: r,
    art: `medal-rank-${r.toLowerCase()}`,
    earned: (ms) => ms.some((m) => m.kind === 'rank' && (m.title.includes(r) || (m as { rank?: string }).rank === r)),
  })),
  { key: 'punctual', name: 'Puntual', cond: 'Llega a tiempo a tus compromisos', metal: 'bronze', glyph: 'timer', art: 'medal-punctual-bronze', earned: (ms) => ms.some((m) => (m.kind as string) === 'punctual') },
];

/** Arte para una medalla concreta ya ganada. */
export function medalArt(m: Medal): ReactNode {
  const def = MEDAL_DEFS.find((d) => (d.key.startsWith('rank_') ? m.kind === 'rank' && (m.title.includes(d.letter!) || (m as { rank?: string }).rank === d.letter) : d.key === m.kind));
  if (!def) return <MedalShield metal="gold" glyph="star" />;
  return <MedalShield metal={def.metal} glyph={def.glyph} letter={def.letter} art={def.art} />;
}

/** Galería de rangos y medallas: qué existe, qué tienes y qué falta. */
export function MedalsGallery({ onBack }: { onBack: () => void }) {
  const ctx = useGameContext();
  const medals = useGame((s) => s.medals);
  if (!ctx) return null;
  const rank = ctx.player.level.rank;
  const rankIdx = RANKS.findIndex((r) => r.id === rank);
  const earned = MEDAL_DEFS.filter((d) => d.earned(medals)).length;
  return (
    <div className="screen" style={{ '--tint': 'var(--color-gold)' } as CSSProperties}>
      <PageHead title="Rangos y medallas" onBack={onBack} />
      <Label right="Por nivel general">Rangos</Label>
      <Card>
        <div className="flex flex-col gap-3">
          {RANKS.map((r, i) => (
            <div key={r.id} className="rankcard" style={{ opacity: i > rankIdx ? 0.55 : 1 }}>
              <RankSquare rank={r.id} size="lg" lock={i > rankIdx} glow={i === rankIdx} />
              <div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="t">{r.title}</span>
                  <span className="s num" style={{ margin: 0 }}>
                    Nivel {r.minLevel}
                  </span>
                </div>
                <div className="s">
                  {i === 0
                    ? 'Diarias, semanales y misión principal.'
                    : `+1 cupo · +1 punto${r.unlocks.length ? ` · ${r.unlocks.map((u) => ({ daily: 'diarias', weekly: 'semanales', main: 'principales', side: 'secundarias', boss: 'misiones boss', hidden: 'misiones ocultas' })[u]).join(', ')}` : ''} · tienda nivel ${i + 1}.${r.id === 'S' ? ' El rango final.' : ''}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Label right={`${earned} de ${MEDAL_DEFS.length}`}>Medallas</Label>
      <Card>
        <div className="medals">
          {MEDAL_DEFS.map((d) => {
            const has = d.earned(medals);
            return (
              <div key={d.key} className={`medal ${has ? '' : 'lock'}`}>
                {!has && <Icon id="lock" className="lk" />}
                <div className="art">
                  <MedalShield metal={d.metal} glyph={d.glyph} letter={d.letter} art={d.art} lock={!has} />
                </div>
                <div className="mt">{d.name}</div>
                <div className="mc">{d.cond}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
