import { Link } from 'react-router-dom';
import { useGameContext } from '@/state/game';
import { useCalendar } from '../store';
import { nextEvent } from '../selectors';
import { findCommitment } from '../commitments';
import { minutesToHuman } from '@/lib/time';
import { Icon } from '@/components/ui/Icon';
import { Chip, IconSquare } from '@/components/ui/primitives';
import { eventTime } from './AgendaScreen';

/** Tarjeta "Próximo compromiso" en Hoy. Solo aparece si la agenda está conectada y hay un evento por venir. */
export function NextEventCard() {
  const ctx = useGameContext();
  const connected = useCalendar((s) => s.connected);
  const events = useCalendar((s) => s.events);
  if (!ctx || !connected) return null;
  const e = nextEvent(events, ctx.now);
  if (!e) return null;
  const mins = Math.max(0, Math.round((Date.parse(e.start) - ctx.now.getTime()) / 60000));
  const committed = findCommitment(ctx.missions, e.id);
  return (
    <Link to="/agenda" className="card row" style={{ color: 'inherit', textDecoration: 'none' }}>
      <IconSquare icon="cal" color="var(--color-system)" />
      <div className="grow">
        <div className="s" style={{ margin: 0 }}>
          Próximo en tu agenda · en {minutesToHuman(mins)}
        </div>
        <div className="t" style={{ fontSize: 14 }}>
          {e.summary || '(sin título)'}
        </div>
        <div className="s">
          {eventTime(e, ctx.tz)}
          {e.location ? ` · ${e.location}` : ''}
        </div>
      </div>
      {committed ? (
        <Chip color="var(--color-gold)" icon="timer">
          compromiso
        </Chip>
      ) : (
        <Icon id="chev" className="chev" />
      )}
    </Link>
  );
}
