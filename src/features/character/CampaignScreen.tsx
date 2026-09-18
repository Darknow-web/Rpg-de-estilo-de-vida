import { Link } from 'react-router-dom';
import { useGameContext } from '@/state/game';
import { ATTRIBUTE_META } from '@/core/character/classes';

/** "TU CAMPAÑA": por qué esa clase, por qué cada misión, qué estrategia y qué viene después. Releerla trae de vuelta. */
export function CampaignScreen() {
  const ctx = useGameContext();
  if (!ctx) return null;
  const c = ctx.player.campaign;
  const a = ctx.player.interview?.answers;
  if (!c) {
    return (
      <div className="panel p-4 text-sm text-mist">
        Todavía no tienes campaña. <Link to="/onboarding" className="text-arcane-glow underline">Hacer la entrevista</Link>.
      </div>
    );
  }
  return (
    <div className="space-y-4 animate-fadein">
      <div>
        <h1 className="font-display text-xl text-gold">Tu campaña</h1>
        <p className="text-xs text-mist">Generada el {c.generatedAt.slice(0, 10)} · {c.source === 'ai' ? 'con IA' : 'con el set local'}</p>
      </div>
      {a && (
        <div className="panel p-4">
          <div className="text-xs uppercase tracking-widest text-mist">Tu meta a 6 meses</div>
          <p className="mt-1 text-parchment">"{a.q1_goal}"</p>
          <div className="mt-3 text-xs uppercase tracking-widest text-mist">Por qué importa</div>
          <p className="mt-1 italic text-parchment">"{a.q2_why}"</p>
        </div>
      )}
      <div className="panel p-4">
        <div className="text-xs uppercase tracking-widest text-mist">Tu clase: {ctx.player.class?.name}</div>
        <p className="mt-1 text-sm text-parchment">{c.explanation.forClass}</p>
        {ctx.player.class && <p className="mt-2 text-xs text-mist">{ctx.player.class.reason}</p>}
      </div>
      <div className="panel p-4">
        <div className="text-xs uppercase tracking-widest text-mist">Por cada misión</div>
        <ul className="mt-2 space-y-3">
          {c.explanation.perMission.map((m, i) => (
            <li key={i} className="rounded-xl bg-void p-3 text-sm">
              <div className="font-semibold text-parchment">{m.missionName}</div>
              <div className="mt-1 text-xs" style={{ color: ATTRIBUTE_META[m.attribute].color }}>
                {ATTRIBUTE_META[m.attribute].icon} {ATTRIBUTE_META[m.attribute].name}
              </div>
              <div className="mt-1 text-xs text-mist">
                <span className="text-parchment">Dijiste:</span> {m.whatYouSaid}
              </div>
              <div className="mt-1 text-xs text-mist">
                <span className="text-parchment">Cómo ayuda:</span> {m.howItHelps}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="panel p-4">
        <div className="text-xs uppercase tracking-widest text-mist">Estrategia</div>
        <p className="mt-1 text-sm text-parchment">{c.explanation.generalStrategy}</p>
      </div>
      <div className="panel p-4">
        <div className="text-xs uppercase tracking-widest text-mist">Qué pasa después</div>
        <p className="mt-1 text-sm text-parchment">{c.explanation.whatComesNext}</p>
      </div>
      <Link to="/settings" className="btn btn-ghost w-full">
        Rehacer la entrevista (sin perder progreso)
      </Link>
    </div>
  );
}
