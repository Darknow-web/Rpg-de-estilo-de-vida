import { Link } from 'react-router-dom';
import { useGame, useGameContext } from '@/state/game';
import { Radar } from '@/components/ui/Radar';
import { Hearts } from '@/components/ui/Hearts';
import { levelProgress } from '@/core/character/player';
import { ATTRIBUTE_META, CLASSES } from '@/core/character/classes';
import { ATTRIBUTE_IDS } from '@/shared/types';
import { attributeXpIntoLevel, RANKS, rankIndex } from '@/lib/game-balance';
import { rankClass } from '@/components/TopBar';
import { allQuotas } from '@/core/missions/quota';
import { MASTERY } from '@/lib/game-balance';

/** Hoja de personaje: radar, nivel, rango y SIEMPRE el próximo desbloqueo. */
export function CharacterScreen() {
  const ctx = useGameContext();
  const medals = useGame((s) => s.medals);
  if (!ctx) return null;
  const p = ctx.player;
  const lp = levelProgress(p.level.totalXp);
  const cls = p.class ? CLASSES[p.class.id] : null;
  const levels = Object.fromEntries(ATTRIBUTE_IDS.map((a) => [a, p.attributes[a].level])) as Record<(typeof ATTRIBUTE_IDS)[number], number>;
  const traits = ctx.missions.filter((m) => m.mastery.state === 'automated');
  const quotas = allQuotas(p, ctx.missions, ctx.effects);
  const nextRankDef = RANKS[rankIndex(p.level.rank) + 1];

  return (
    <div className="space-y-4 animate-fadein">
      <div className="panel p-4">
        <div className="flex items-center gap-4">
          <div className={`flex h-16 w-16 items-center justify-center rounded-full border-2 font-display text-2xl ${rankClass(p.level.rank)}`}>{p.level.rank}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-lg text-parchment">{p.profile.displayName}</div>
            <div className="text-sm text-mist">
              {cls ? `${cls.icon} ${cls.name}` : 'Sin clase'} · Nivel {lp.level} · {RANKS[rankIndex(p.level.rank)].title}
            </div>
            <div className="bar mt-2">
              <div className="bg-arcane" style={{ width: `${Math.round(lp.fraction * 100)}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-mist">
              {lp.xpIntoLevel}/{lp.xpForLevel} XP para nivel {lp.level + 1}
            </div>
          </div>
        </div>
        {cls && <p className="mt-3 text-sm italic text-mist">"{cls.identityPhrase}"</p>}
        <div className="mt-3 flex items-center justify-between">
          <Hearts current={p.hearts.current} max={p.hearts.max} size="lg" />
          <div className="text-right text-xs text-mist">
            <div>🪙 {p.economy.coins} monedas</div>
            <div>🔥 racha {p.streak.current} (mejor {p.streak.best})</div>
          </div>
        </div>
      </div>

      <div className="panel p-4">
        <div className="text-xs uppercase tracking-widest text-mist">Próximo desbloqueo</div>
        {lp.nextRank ? (
          <div className="mt-1 text-sm text-parchment">
            Rango <span className="font-display text-gold">{lp.nextRank.id}</span> ({lp.nextRank.title}) en nivel {lp.nextRank.level}: faltan <span className="text-arcane-glow">{lp.nextRank.xpMissing} XP</span>.
            {nextRankDef && <div className="mt-1 text-xs text-mist">Desbloquea: +1 cupo, +1 punto de habilidad, +1 reinicio de árbol{nextRankDef.unlocks.length ? `, misiones ${nextRankDef.unlocks.map((u) => ({ daily: 'diarias', weekly: 'semanales', main: 'principales', side: 'secundarias', boss: 'boss', hidden: 'ocultas' })[u]).join(', ')}` : ''}, recompensas de nivel {rankIndex(nextRankDef.id) + 1}.</div>}
          </div>
        ) : (
          <div className="mt-1 text-sm text-gold">Rango S: Leyenda. No hay más que desbloquear, solo que sostener.</div>
        )}
        {p.level.skillPointsAvailable > 0 && (
          <Link to="/skills" className="btn btn-primary btn-sm mt-3">
            🌳 {p.level.skillPointsAvailable} punto{p.level.skillPointsAvailable > 1 ? 's' : ''} de habilidad sin usar
          </Link>
        )}
      </div>

      <div className="panel flex flex-col items-center p-4">
        <div className="self-start text-xs uppercase tracking-widest text-mist">Atributos</div>
        <Radar levels={levels} />
        <div className="mt-2 w-full space-y-1.5">
          {ATTRIBUTE_IDS.map((a) => {
            const { into, need } = attributeXpIntoLevel(p.attributes[a].xp);
            const meta = ATTRIBUTE_META[a];
            return (
              <div key={a} className="flex items-center gap-2 text-xs">
                <span className="w-24" style={{ color: meta.color }}>
                  {meta.icon} {meta.name}
                </span>
                <div className="bar flex-1">
                  <div style={{ width: `${Math.round((into / need) * 100)}%`, background: meta.color }} />
                </div>
                <span className="w-10 text-right text-mist">Nv {p.attributes[a].level}</span>
              </div>
            );
          })}
        </div>
        {cls?.primaryAttribute && <div className="mt-2 text-[11px] text-mist">Tu atributo principal ({ATTRIBUTE_META[cls.primaryAttribute].name}) crece un 25 % más rápido.</div>}
      </div>

      <div className="panel p-4">
        <div className="text-xs uppercase tracking-widest text-mist">Bitácora</div>
        <div className="mt-2 grid grid-cols-5 gap-1 text-center text-xs">
          {quotas.map((q) => (
            <div key={q.type} className="rounded-lg bg-void p-2">
              <div className="text-mist">{{ daily: 'Diarias', weekly: 'Seman.', main: 'Princ.', side: 'Secund.', boss: 'Boss', hidden: 'Ocultas' }[q.type]}</div>
              <div className="text-parchment">
                {q.used}/{q.max}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-mist">
          Misiones completadas: {p.stats.missionsCompleted} · Cadenas: {p.stats.chainsCompleted} · Recompensas con precio bajado por ti: <span className={p.stats.rewardsUnderpriced > 0 ? 'text-ember' : ''}>{p.stats.rewardsUnderpriced}</span>
        </div>
      </div>

      {traits.length > 0 && (
        <div className="panel p-4">
          <div className="text-xs uppercase tracking-widest text-mist">Rasgos del personaje</div>
          <p className="text-[11px] text-mist">Hábitos automatizados ({MASTERY.automated.cumulativeDays}+ días). Ya no ocupan cupo ni espacio mental.</p>
          <ul className="mt-2 space-y-1 text-sm">
            {traits.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <span className="text-gold">🥇</span> {t.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel p-4">
        <div className="text-xs uppercase tracking-widest text-mist">Medallas ({medals.length})</div>
        {medals.length === 0 && <p className="mt-1 text-sm text-mist">Todavía ninguna. La primera llega al dominar una misión o completar una cadena.</p>}
        <ul className="mt-2 space-y-1 text-sm">
          {medals
            .slice()
            .sort((a, b) => (a.awardedAt < b.awardedAt ? 1 : -1))
            .slice(0, 12)
            .map((m) => (
              <li key={m.id} className="flex items-center justify-between">
                <span>🏅 {m.title}</span>
                <span className="text-[11px] text-mist">{m.awardedAt.slice(0, 10)}</span>
              </li>
            ))}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link to="/campaign" className="btn btn-ghost">
          📜 Tu campaña
        </Link>
        <Link to="/wallet" className="btn btn-ghost">
          🪙 Monedero
        </Link>
        <Link to="/log" className="btn btn-ghost">
          🧾 Historial del sistema
        </Link>
        <Link to="/settings" className="btn btn-ghost">
          ⚙️ Ajustes
        </Link>
      </div>
    </div>
  );
}
