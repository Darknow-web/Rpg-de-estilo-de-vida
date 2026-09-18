import { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, firebaseConfigured } from '@/lib/firebase';
import { useGame } from '@/state/game';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { Shell } from '@/components/Shell';
import { TodayScreen } from '@/features/today/TodayScreen';
import { WeekScreen } from '@/features/week/WeekScreen';
import { CharacterScreen } from '@/features/character/CharacterScreen';
import { SkillsScreen } from '@/features/skills/SkillsScreen';
import { ShopScreen } from '@/features/shop/ShopScreen';
import { WalletScreen } from '@/features/wallet/WalletScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { SystemLogScreen } from '@/features/systemLog/SystemLogScreen';
import { MissionDetail } from '@/features/missions/MissionDetail';
import { MissionCreate } from '@/features/missions/MissionCreate';
import { GalleryScreen } from '@/features/evidence/GalleryScreen';
import { CampaignScreen } from '@/features/character/CampaignScreen';
import { LongTermScreen } from '@/features/missions/LongTermScreen';
import { GymScreen } from '@/modules/gym/ui/GymScreen';
import { GymSession } from '@/modules/gym/ui/GymSession';
import { FeedbackOverlay } from '@/components/FeedbackOverlay';
import { CatchupBanner } from '@/features/today/CatchupBanner';
import { runCatchup, type CatchupSummary } from '@/core/catchup/catchup';
import { setClockOffset } from '@/lib/time';
import { apiGet } from '@/lib/api';
import { TIME } from '@/lib/game-balance';
import { syncNotifications } from '@/features/settings/notificationsSync';
import { createInitialPlayer } from '@/core/character/player';
import { deviceTimezone, todayIn } from '@/lib/time';
import { playerRef } from '@/core/repo';
import { setDoc } from 'firebase/firestore';

export default function App() {
  const setUser = useGame((s) => s.setUser);
  const authReady = useGame((s) => s.authReady);
  const user = useGame((s) => s.user);
  const player = useGame((s) => s.player);
  const playerLoaded = useGame((s) => s.playerLoaded);
  const setOnline = useGame((s) => s.setOnline);
  const bumpTick = useGame((s) => s.bumpTick);
  const pushFeedback = useGame((s) => s.pushFeedback);
  const [catchup, setCatchup] = useState<CatchupSummary | null>(null);
  const [clockWarn, setClockWarn] = useState(false);
  const lastCatchupKey = useRef('');
  const location = useLocation();

  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(auth(), (u) => setUser(u));
  }, [setUser]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const t = window.setInterval(bumpTick, 30_000);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      clearInterval(t);
    };
  }, [setOnline, bumpTick]);

  // Hora del servidor: detecta relojes manipulados sin bloquear.
  useEffect(() => {
    void (async () => {
      const t = await apiGet<{ epochMs: number }>('/api/time');
      if (!t) return;
      const offset = t.epochMs - Date.now();
      setClockOffset(offset);
      setClockWarn(Math.abs(offset) > TIME.clockSkewWarnMinutes * 60_000);
    })();
  }, [user]);

  // Crea el documento del jugador la primera vez.
  useEffect(() => {
    if (!user || !playerLoaded || player) return;
    const tz = deviceTimezone();
    const initial = createInitialPlayer(user.uid, user.displayName || user.email?.split('@')[0] || 'Aventurero', tz, todayIn(tz));
    void setDoc(playerRef(user.uid), initial).catch((e) => console.error('createPlayer', e));
  }, [user, playerLoaded, player]);

  // Catch-up al entrar y cada cambio de día (clave: uid + día).
  useEffect(() => {
    const ctx = useGame.getState().context();
    if (!ctx || !ctx.player.flags.onboardingDone) return;
    const key = `${ctx.uid}:${ctx.today}:${Math.floor(ctx.now.getTime() / 600_000)}`;
    if (lastCatchupKey.current === key) return;
    lastCatchupKey.current = key;
    void runCatchup(ctx).then((s) => {
      if (s.hasNews) setCatchup(s);
      if (s.events.length) pushFeedback(s.events.filter((e) => e.kind === 'fallen' || e.kind === 'revived' || e.kind === 'hidden'));
      void syncNotifications();
    });
  }, [player?.uid, player?.flags.onboardingDone, useGame((s) => s.tick), pushFeedback]);

  if (!firebaseConfigured) return <ConfigMissing />;
  if (!authReady) return <Splash label="Despertando…" />;
  if (!user) return <AuthScreen />;
  if (!playerLoaded || !player) return <Splash label="Abriendo tu hoja de personaje…" />;
  if (!player.flags.onboardingDone && !location.pathname.startsWith('/onboarding')) return <Navigate to="/onboarding" replace />;

  return (
    <>
      {clockWarn && (
        <div className="bg-blood/30 px-4 py-2 text-center text-xs text-parchment">La hora de tu dispositivo difiere de la del servidor. Las misiones se registran igual, pero quedarán marcadas.</div>
      )}
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route element={<Shell />}>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/week" element={<WeekScreen />} />
          <Route path="/character" element={<CharacterScreen />} />
          <Route path="/campaign" element={<CampaignScreen />} />
          <Route path="/skills" element={<SkillsScreen />} />
          <Route path="/shop" element={<ShopScreen />} />
          <Route path="/wallet" element={<WalletScreen />} />
          <Route path="/missions/new" element={<MissionCreate />} />
          <Route path="/missions/long-term" element={<LongTermScreen />} />
          <Route path="/missions/:id" element={<MissionDetail />} />
          <Route path="/missions/:id/gallery" element={<GalleryScreen />} />
          <Route path="/gym" element={<GymScreen />} />
          <Route path="/gym/session/:missionId" element={<GymSession />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/log" element={<SystemLogScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <FeedbackOverlay />
      {catchup && <CatchupBanner summary={catchup} onClose={() => setCatchup(null)} />}
    </>
  );
}

function Splash({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-abyss">
      <div className="font-display text-3xl text-gold animate-pulse-slow">LIFE QUEST</div>
      <div className="text-sm text-mist">{label}</div>
    </div>
  );
}

function ConfigMissing() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="font-display text-3xl text-gold">LIFE QUEST</div>
      <p className="max-w-md text-sm text-mist">
        Falta la configuración de Firebase. Copia <code className="text-parchment">.env.example</code> a <code className="text-parchment">.env</code> y completa las variables <code className="text-parchment">VITE_FIREBASE_*</code> (ver README).
      </p>
    </div>
  );
}
