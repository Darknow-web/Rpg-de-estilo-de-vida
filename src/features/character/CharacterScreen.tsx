import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useGame, useGameContext } from '@/state/game';
import { Radar } from '@/components/ui/Radar';
import { Hearts } from '@/components/ui/Hearts';
import { levelProgress } from '@/core/character/player';
import { ATTRIBUTE_META, CLASSES } from '@/core/character/classes';
import { ATTRIBUTE_IDS } from '@/shared/types';
import { attributeXpIntoLevel, RANKS, rankIndex, MASTERY } from '@/lib/game-balance';
import { allQuotas } from '@/core/missions/quota';
import { Icon } from '@/components/ui/Icon';
import { ATTR_ICON, ATTR_VAR, Bar, Card, ClassMedallion, IconSquare, Label, Pill, RankLadder, RankSquare, Row, RANK_VAR } from '@/components/ui/primitives';
import { MedalsGallery, medalArt } from './MedalsGallery';

/** Hoja de personaje: medallón, rango y SIEMPRE el próximo desbloqueo, atributos, medallas, rasgos. */
export function CharacterScreen() {
  const ctx = useGameContext();
  const medals = useGame((s) => s.medals);
  const [radar, setRadar] = useState(false);
  const [gallery, setGallery] = useState(false);
  if (!ctx) return null;
  const p = ctx.player;
  const lp = levelProgress(p.level.totalXp);
  const cls = p.class ? CLASSES[p.class.id] : null;
  const levels = Object.fromEntries(ATTRIBUTE_IDS.map((a) => [a, p.attributes[a].level])) as Record<(typeof ATTRIBUTE_IDS)[number], number>;
  const traits = ctx.missions.filter((m) => m.mastery.state === 'automated');
  const quotas = allQuotas(p, ctx.missions, ctx.effects);
  const rankDef = RANKS[rankIndex(p.level.rank)];
  const nextRankDef = RANKS[rankIndex(p.level.rank) + 1];
  const rankSpan = nextRankDef ? nextRankDef.minLevel - rankDef.minLevel : 1;
  const rankPct = nextRankDef ? Math.round(((lp.level - rankDef.minLevel) / rankSpan) * 100) : 100;
  const recent = medals.slice().sort((a, b) => (a.awardedAt < b.awardedAt ? 1 : -1));

  if (gallery) return <MedalsGallery onBack={() => setGallery(false)} />;

  return (
    <div className="screen" style={{ '--tint': cls ? ATTR_VAR[cls.primaryAttribute ?? 'disciplina'] : 'var(--color-arcane)' } as CSSProperties}>
      <div className="head center">
        <span className="title">Personaje</span>
        <Link to="/settings" className="act" aria-label="Ajustes">
          <Icon id="settings" style={{ width: 20, height: 20 }} />
        </Link>
      </div>

      <div style={{ textAlign: 'center' }}>
        <ClassMedallion classId={p.class?.id ?? null} />
        <div className="font-display" style={{ fontSize: 22, marginTop: 10 }}>
          {p.profile.displayName}
        </div>
        <div style={{ fontWeight: 700, fontSize: 14, color: cls ? ATTR_VAR[cls.primaryAttribute ?? 'disciplina'] : 'var(--color-arcane)', letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 2 }}>{cls ? cls.name : 'Sin clase'}</div>
        {cls && <div className="s italic" style={{ marginTop: 6 }}>“{cls.identityPhrase}”</div>}
      </div>

      <Card>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <RankSquare rank={p.level.rank} size="lg" glow />
            <div>
              <div className="t">
                {rankDef.title} · Nivel {lp.level}
              </div>
              <div className="s">{nextRankDef ? `Rango ${nextRankDef.id} en nivel ${nextRankDef.minLevel}` : 'El rango final'}</div>
            </div>
          </div>
          <Pill tone="xp" icon="zap">
            <span className="num">{p.level.totalXp.toLocaleString('es')}</span> XP
          </Pill>
        </div>
        <RankLadder current={p.level.rank} />
        {nextRankDef ? (
          <>
            <Bar className="mt-4" value={rankPct} color={RANK_VAR[nextRankDef.id]} label={`Camino a ${nextRankDef.title}`} right={`${rankPct} %`} />
            <div className="s mt-3">
              Faltan {lp.nextRank?.xpMissing.toLocaleString('es')} XP. Desbloquea +1 cupo, +1 punto de habilidad, +1 reinicio de árbol
              {nextRankDef.unlocks.length ? `, misiones ${nextRankDef.unlocks.map((u) => ({ daily: 'diarias', weekly: 'semanales', main: 'principales', side: 'secundarias', boss: 'boss', hidden: 'ocultas' })[u]).join(', ')}` : ''} y tienda nivel {rankIndex(nextRankDef.id) + 1}.
            </div>
          </>
        ) : (
          <div className="s mt-3" style={{ color: 'var(--color-gold)' }}>
            Rango S: Leyenda. No hay más que desbloquear, solo que sostener.
          </div>
        )}
        {p.level.skillPointsAvailable > 0 && (
          <Link to="/skills" className="btn system sm mt-4">
            <Icon id="tree" />
            {p.level.skillPointsAvailable} punto{p.level.skillPointsAvailable > 1 ? 's' : ''} de habilidad sin usar
          </Link>
        )}
      </Card>

      <Card>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Hearts current={p.hearts.current} max={p.hearts.max} size="lg" />
          <div className="row" style={{ gap: 14 }}>
            <span className="row s num" style={{ margin: 0, gap: 5 }}>
              <Icon id="coin" style={{ width: 14, height: 14, color: 'var(--color-gold)' }} />
              {p.economy.coins}
            </span>
            <span className="row s num" style={{ margin: 0, gap: 5 }}>
              <Icon id="flame" style={{ width: 14, height: 14, color: 'var(--color-ember)' }} />
              {p.streak.current} · mejor {p.streak.best}
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <Label
          right={
            <button className="chip ghost" onClick={() => setRadar((v) => !v)}>
              <Icon id="eye" />
              {radar ? 'Lista' : 'Radar'}
            </button>
          }
        >
          Atributos
        </Label>
        {radar ? (
          <div className="mt-2 flex justify-center">
            <Radar levels={levels} />
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {ATTRIBUTE_IDS.map((a) => {
              const { into, need } = attributeXpIntoLevel(p.attributes[a].xp);
              return (
                <div key={a} className="attr">
                  <IconSquare icon={ATTR_ICON[a]} color={ATTR_VAR[a]} size="sm" />
                  <div>
                    <div className="n">{ATTRIBUTE_META[a].name}</div>
                    <Bar value={into} max={need} color={ATTR_VAR[a]} thin />
                  </div>
                  <div className="lv">Nv {p.attributes[a].level}</div>
                </div>
              );
            })}
          </div>
        )}
        {cls?.primaryAttribute && <div className="s mt-4">Principal: {ATTRIBUTE_META[cls.primaryAttribute].name} crece un 25 % más rápido.</div>}
      </Card>

      <Card>
        <Label
          right={
            <button className="chip ghost" onClick={() => setGallery(true)}>
              Ver todas
            </button>
          }
        >
          Medallas · {medals.length}
        </Label>
        {medals.length === 0 ? (
          <p className="s mt-3">Todavía ninguna. La primera llega al dominar una misión o completar una cadena.</p>
        ) : (
          <div className="medals mt-4">
            {recent.slice(0, 3).map((m) => {
              const art = medalArt(m);
              return (
                <div key={m.id} className="medal">
                  <div className="art">{art}</div>
                  <div className="mt">{m.title}</div>
                  <div className="mc">{m.awardedAt.slice(0, 10)}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {traits.length > 0 && (
        <Card>
          <Label>Rasgos del personaje</Label>
          <p className="s mt-1">Hábitos automatizados ({MASTERY.automated.cumulativeDays}+ días). Ya no ocupan cupo ni espacio mental.</p>
          <div className="mt-3 flex flex-col gap-3">
            {traits.map((t) => (
              <Row key={t.id} icon="star" color="var(--color-gold)" title={t.name} to={`/missions/${t.id}`} chevron />
            ))}
          </div>
        </Card>
      )}

      <Card tone="tight">
        <div className="list">
          {quotas.map((q) => (
            <div key={q.type} className="row">
              <div className="grow s" style={{ margin: 0 }}>
                {{ daily: 'Diarias', weekly: 'Semanales', main: 'Principales', side: 'Secundarias', boss: 'Boss', hidden: 'Ocultas' }[q.type]}
              </div>
              <span className="num" style={{ fontWeight: 600 }}>
                {q.used}/{q.max}
              </span>
            </div>
          ))}
          <div className="row">
            <div className="grow s" style={{ margin: 0 }}>
              Misiones completadas
            </div>
            <span className="num" style={{ fontWeight: 600 }}>
              {p.stats.missionsCompleted}
            </span>
          </div>
          <div className="row">
            <div className="grow s" style={{ margin: 0 }}>
              Precios bajados por ti
            </div>
            <span className="num" style={{ fontWeight: 600, color: p.stats.rewardsUnderpriced > 0 ? 'var(--color-ember)' : undefined }}>
              {p.stats.rewardsUnderpriced}
            </span>
          </div>
        </div>
      </Card>

      <Card tone="tight">
        <div className="list">
          <Row icon="flag" color="var(--color-gold)" title="Tu campaña" sub="Por qué esta clase y estas misiones" to="/campaign" chevron />
          <Row icon="wallet" color="var(--color-gold)" title="Monedero" sub="Saldo y movimientos" to="/wallet" chevron />
          <Row icon="history" color="var(--color-system)" title="Historial del sistema" sub="Qué hizo el juego y por qué" to="/log" chevron />
          <Row icon="settings" color="var(--color-dim)" title="Ajustes" to="/settings" chevron />
        </div>
      </Card>
    </div>
  );
}
