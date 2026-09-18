import { GymSession } from './GymSession';

/** Adaptador para la interfaz Module.executionView. */
export function GymSessionEmbedded({ missionId, onDone }: { missionId: string; onDone: () => void }) {
  return <GymSession missionIdProp={missionId} onDone={onDone} />;
}
