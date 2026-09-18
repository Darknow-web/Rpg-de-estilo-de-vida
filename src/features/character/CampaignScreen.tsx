import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useGameContext } from '@/state/game';
import { ATTRIBUTE_META } from '@/core/character/classes';
import { ATTR_ICON, ATTR_VAR, Card, ClassMedallion, EmptyState, IconSquare, Label, PageHead } from '@/components/ui/primitives';

/** "TU CAMPAÑA": por qué esa clase, por qué cada misión, qué estrategia y qué viene después. Releerla trae de vuelta. */
export function CampaignScreen() {
  const ctx = useGameContext();
  if (!ctx) return null;
  const c = ctx.player.campaign;
  const a = ctx.player.interview?.answers;
  if (!c) {
    return (
      <div className="screen">
        <PageHead title="Tu campaña" />
        <EmptyState
          icon="flag"
          title="Todavía no tienes campaña"
          action={
            <Link to="/onboarding" className="btn system sm auto">
              Hacer la entrevista
            </Link>
          }
        />
      </div>
    );
  }
  return (
    <div className="screen" style={{ '--tint': 'var(--color-arcane)' } as CSSProperties}>
      <PageHead title="Tu campaña" action={c.source === 'ai' ? 'IA' : 'local'} />
      <Card style={{ textAlign: 'center' }}>
        <Label>Clase asignada</Label>
        <ClassMedallion classId={ctx.player.class?.id ?? null} />
        <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--color-arcane)', marginTop: 10 }}>{ctx.player.class?.name ?? 'Sin clase'}</div>
        <p className="s mt-2">{c.explanation.forClass}</p>
        {ctx.player.class && <p className="s mt-1">{ctx.player.class.reason}</p>}
      </Card>
      {a && (
        <Card>
          <Label>Tu meta a 6 meses</Label>
          <p className="t mt-2" style={{ fontSize: 15 }}>
            “{a.q1_goal}”
          </p>
          <Label className="mt-4">Por qué importa</Label>
          <p className="s mt-2 italic">“{a.q2_why}”</p>
        </Card>
      )}
      <Label right={`${c.explanation.perMission.length}`}>Por cada misión</Label>
      {c.explanation.perMission.map((m, i) => (
        <Card key={i}>
          <div className="row">
            <IconSquare icon={ATTR_ICON[m.attribute]} color={ATTR_VAR[m.attribute]} />
            <div className="grow">
              <div className="t">{m.missionName}</div>
              <div className="s">{ATTRIBUTE_META[m.attribute].name}</div>
            </div>
          </div>
          <div className="s mt-3">
            <b style={{ color: 'var(--color-ink)' }}>Dijiste:</b> {m.whatYouSaid}
          </div>
          <div className="s mt-1">
            <b style={{ color: 'var(--color-ink)' }}>Por qué:</b> {m.howItHelps}
          </div>
        </Card>
      ))}
      <Card>
        <Label>Estrategia</Label>
        <p className="s mt-2">{c.explanation.generalStrategy}</p>
        <Label className="mt-4">Qué pasa después</Label>
        <p className="s mt-2">{c.explanation.whatComesNext}</p>
      </Card>
      <Link to="/settings" className="btn ghost">
        Rehacer la entrevista (sin perder progreso)
      </Link>
      <div className="s" style={{ textAlign: 'center' }}>
        Generada el {c.generatedAt.slice(0, 10)}
      </div>
    </div>
  );
}
