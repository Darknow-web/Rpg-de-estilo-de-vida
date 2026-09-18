# LIFE QUEST — RPG de la vida real

Una PWA (instalable en Android) que convierte tu vida en un RPG: las misiones son acciones reales, la prueba es una **foto**, y tu personaje sube de nivel, gana monedas, desbloquea habilidades, sube de rango, pierde corazones y puede morir (y resucitar).

- **Frontend:** React 19 + Vite 7 + TypeScript + Tailwind 4, PWA con service worker (offline + Web Push).
- **Backend:** Express (`server/`) que sirve el cliente y expone `/api/*`. La clave de Gemini vive **solo** aquí.
- **Datos:** Firebase Auth (Google + correo) y Cloud Firestore (con caché offline). Las fotos se guardan comprimidas como bytes en Firestore (ver "Fotos").
- **IA:** Gemini (`gemini-2.5-flash-lite` por defecto) con salida estructurada validada con Zod. Tres llamadas: onboarding, tasador de recompensas, propuesta de misión nueva (más una auxiliar para interpretar disponibilidad). **Todo tiene fallback local: la app nunca se bloquea por un fallo de la IA.**
- **Despliegue:** Google AI Studio → Cloud Run (capa Starter, sin cuenta de facturación). Pasos en [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Instalación local

```bash
npm install
cp .env.example .env      # completa VITE_FIREBASE_* (y GEMINI_API_KEY si quieres IA en local)
npm run dev               # cliente en http://localhost:5173, servidor /api en :8080
```

Sin `GEMINI_API_KEY`, la app funciona con los sets locales de respaldo (campañas por arquetipo, tasador por palabras clave, banco de misiones).

### Probar sin proyecto de Firebase (emuladores)

```bash
# Terminal 1
npx firebase emulators:start --only auth,firestore --project demo-life-quest
# Terminal 2 (.env con VITE_USE_EMULATORS=1 y cualquier valor en VITE_FIREBASE_API_KEY/PROJECT_ID/APP_ID)
VITE_USE_EMULATORS=1 npm run dev
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Cliente Vite + servidor Express con recarga |
| `npm run build` | Typecheck + build del cliente (`dist/`) + bundle del servidor (`dist-server/`) |
| `npm start` | Sirve `dist/` y `/api` (lo que ejecuta Cloud Run) |
| `npm test` | Pruebas unitarias del core (curva de XP, economía, cupo, dominio, tasador, generador de rutina, tiempo) |
| `npm run test:rules` | Pruebas de las reglas de Firestore contra el emulador (aislamiento entre jugadores, inmutabilidad) |
| `npm run typecheck` | Typecheck de cliente y servidor |

## Estructura

```
server/            Express: /api/ai/* (Gemini), /api/time, /api/push, estáticos de dist/
src/lib/game-balance.ts   ÚNICO archivo de balance (XP, monedas, corazones, cupos, precios, árbol)
src/core/          Núcleo dueño de la economía: personaje, misiones, completación, dominio, corazones, catch-up, tienda, árbol
src/modules/       habits (genérico) y gym (equipamiento, ejercicios, disponibilidad, rutina, sesión)
src/features/      Pantallas (Hoy, Semana, Personaje, Árbol, Tienda, Onboarding, Ajustes…)
src/data/          Fallbacks locales (campañas por arquetipo, banco de misiones) y textos del árbol
firestore.rules    Reglas de seguridad (cada jugador solo ve su subárbol; historial inmutable)
storage.rules      Reglas de Cloud Storage (solo si activas Blaze)
docs/              DEPLOY.md, FIREBASE-CHECKLIST.md, SYSTEM-LOG.md
```

## Decisiones que conviene conocer

- **Fotos sin Cloud Storage.** Desde febrero de 2026, Cloud Storage for Firebase exige plan Blaze y la capa Starter no lo incluye. Las fotos se comprimen en el cliente (800 px, JPEG 0.7, ~60–120 KB) y se guardan como bytes en `players/{uid}/evidence/{id}`, detrás de `src/lib/storage.ts`. Cuando actives Blaze, cambia `VITE_EVIDENCE_BACKEND=cloud-storage` y completa el adaptador. La app mide el uso y ofrece archivar fotos antiguas (conserva miniatura) al pasar el 70 % de 1 GiB.
- **La IA y las fotos.** La IA **no** analiza las fotos de evidencia: solo prueban ante ti que hiciste la misión y se guardan como bytes en tu subárbol de Firestore, al que nadie más accede. Lo único que la IA mira son las **fotos de configuración del gimnasio** (`/api/ai/gym-scan`: hasta 4 fotos por escaneo, 10 escaneos al día por jugador) para marcar el equipamiento del catálogo; viajan comprimidas en la petición, se envían a Gemini y se descartan. **No se almacenan en ningún sitio** (ni Firestore, ni servidor, ni registros). Si la IA no está, la app ofrece marcar el equipamiento a mano.
- **La lógica del juego corre en el cliente** (necesario para completar misiones offline). Las reglas de Firestore garantizan propiedad estricta e inmutabilidad del historial, pero no impiden que un jugador con la consola abierta se escriba monedas: sin ranking ni social, el único perjudicado sería él mismo.
- **Curva de XP:** `xp(n) = floor(18 · n^1.6)`. Nivel 2 el día 1, 5 en la primera semana, 10 al mes, 25 hacia el sexto mes con el ritmo creciente del juego. El 50 queda como leyenda de largo plazo (cálculo completo en `game-balance.ts`).
- **Avisos push:** sin Cloud Scheduler (capa Starter), el servidor programa los avisos en memoria mientras la instancia vive; la app también programa avisos locales mientras está abierta. Nunca más de 4 al día.

## Cómo saber que quedó bien (recorrido de 10 puntos)

1. Crear cuenta y responder la entrevista (< 3 min, 8 preguntas, opciones tocables, un texto libre con dictado).
2. Recibir clase, 3 misiones diarias con ancla y comportamiento mínimo, y 4–6 recompensas tasadas, con su explicación (pantalla "Tu campaña").
3. Ajustes → activar Gimnasio → elegir tipo de gimnasio → horario → rutina generada solo con ese equipamiento y en tus huecos.
4. Hoy → tocar misión → foto → recompensa con animación, XP, monedas y atributo.
5. Subir de nivel, ganar un punto y desbloquear un nodo del árbol que cambia una regla (p. ej. "Gracia extendida").
6. Fallar misiones varios días → corazones bajan → game over → misión de resurrección con la más fallada → revivir.
7. Volver tras 3+ días → resumen sin culpa y bonus de descanso (+50 % XP en 5 misiones).
8. Llevar una misión a Dominada → medalla, +1 cupo, y la app propone sola la siguiente misión.
9. Tienda → "+ Recompensa propia" → escribir solo el nombre → precio, nivel y razonamiento calculados.
10. Cerrar sesión, entrar con otra cuenta: nada del otro jugador es visible (probado en `tests/rules`).
