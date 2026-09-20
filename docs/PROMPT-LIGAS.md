# Ligas privadas con ranking: prompts para Google AI Studio

Tres prompts encadenados para añadir competencia entre amigos a LIFE QUEST: quién cumple más sus
rutinas, quién va al gimnasio los días que le toca y quién ahorra más. Se pegan **uno por uno** en el
chat de AI Studio, esperando a que cada fase quede desplegada y comprobada antes de pasar a la siguiente.

**Por qué en tres y no en uno.** La fase 1 existe para averiguar, antes de construir nada encima, si el
servidor puede leer Firestore en un proyecto gestionado de la capa Starter. Si esa puerta no abre, el
resto del diseño cambia por completo y conviene saberlo en media hora, no en dos días.

## Las decisiones que ya están tomadas

| Decisión | Qué significa |
|---|---|
| Ligas **privadas por código** | Creas una liga, compartes un código de 6 letras. Nada global, nada público. |
| Se compara por **porcentaje** | Gana quien cumple mayor parte de lo suyo. Tener 3 misiones o tener 8 no cambia tus opciones. |
| Ahorro de **dinero real con foto** | Declaras una meta y la pruebas. Compite el % de la meta; el monto no sale de tu teléfono. |
| El ranking lo calcula **el servidor** | Nadie puede escribirse su propia posición desde la consola del navegador. |

## Lo que esto rompe, y hay que arreglar a la vez

El `README.md` dice hoy que da igual que la lógica corra en el cliente **"sin ranking ni social"**, y la
pantalla de acceso promete *"Sin funciones sociales. Nadie ve tus misiones ni tus fotos: solo tú."*
Ambas frases dejan de ser ciertas con esta función y los prompts piden cambiarlas. También hay un test
de reglas que exige que un perfil ajeno sea ilegible y hay que ampliarlo, no borrarlo.

---

# PROMPT 1 de 3 — Acceso del servidor y liga vacía

> Copia desde aquí hasta el final del bloque y pégalo en el chat de AI Studio.

```
Eres un ingeniero senior trabajando en LIFE QUEST, una PWA en producción que convierte la vida real en
un RPG. Vas a añadir la BASE de una función de ligas privadas entre amigos. En esta fase NO se calcula
ningún ranking: el objetivo es que el servidor pueda leer Firestore, y poder crear una liga, unirse con
un código y ver quién está dentro.

## Cómo es este repo (es así, no lo adivines)

- React 19 + Vite 7 + TypeScript + Tailwind 4. Servidor Express con punto de entrada unico `server.ts`
  y routers en `server/`. Firebase Auth + Firestore. Se despliega a Cloud Run desde AI Studio.
- El cliente llama al servidor con `apiPost` / `apiGet` de `src/lib/api.ts`, que ya adjuntan el ID token
  de Firebase y nunca lanzan excepciones.
- `server/auth.ts` exporta `requireAuth` (verifica el ID token con jose/JWKS y deja `req.uid`) y
  `rateLimit(key, perDay)`. Reutilizalos, no escribas autenticacion nueva.
- Contrato de TODAS las rutas de API: responden HTTP 200 siempre, con `{ ok: true, data }` o con
  `{ ok: false, fallback: true, reason }`. Nunca un 500 por un fallo previsible.
- Los esquemas Zod compartidos entre cliente y servidor viven en `src/shared/schemas/`. El alias `@`
  apunta a `./src` tanto en los tsconfig como en el esbuild del servidor.
- `src/lib/game-balance.ts` es el UNICO archivo donde viven los numeros del juego. Toda constante nueva
  va ahi, en una seccion nueva con su comentario, como objeto `as const`.
- Sistema de diseño propio en `src/index.css`. Usa las clases que ya existen: `.screen`, `.card`,
  `.card.tight`, `.list`, `.row`, `.label`, `.chip`, `.btn`, `.isq`, `.rankcard`, `.grow`, `.t`, `.s`.
  Componentes en `src/components/ui/primitives.tsx`: `Card`, `Label`, `Row`, `Chip`, `Pill`, `Bar`,
  `IconSquare`, `PageHead`, `Notice`, `EmptyState`, `CountUp`, `RankSquare`. Hoja inferior en
  `src/components/ui/Sheet.tsx`.
- Iconos con `<Icon id="..." />`. SOLO existen estos ids y no puedes inventar otros:
  archive, back, body, book, cal, camera, check, chev, coin, crown, dumbbell, edit, eye, flag, flame,
  gem, google, history, home, link, lock, mic, moon, phoenix, plus, scale, settings, shield, skull,
  spark, star, store, sword, timer, tree, user, vital, wallet, zap.
  No hay icono de trofeo ni de podio: para el primer puesto usa `crown`.
- Las rutas estan en `src/App.tsx`; el menu inferior en `src/components/Shell.tsx`.
- Todo en español: nombres de pantalla, textos de interfaz y comentarios.

## Cuatro datos criticos que se te pasarian por alto

1. EL SERVIDOR HOY NO PUEDE LEER FIRESTORE. No existe `firebase-admin` ni ninguna credencial de
   servicio en el proyecto. El servidor solo sabe verificar tokens.
2. LA BASE DE DATOS NO ES LA `(default)`. En `firebase-applet-config.json` esta el campo
   `firestoreDatabaseId`, y el cliente ya lo pasa explicitamente en `src/lib/firebase.ts`. Si
   inicializas el SDK de admin sin ese id, apuntaras a una base VACIA: no dara error, simplemente no
   habra datos, y el fallo sera dificil de ver.
3. El servidor se empaqueta con `esbuild server.ts --bundle --packages=external`. Cualquier dependencia
   nueva TIENE que ir en `dependencies`, no en `devDependencies`, o no existira en la imagen de Cloud Run.
4. `firestore.rules` termina con `match /{document=**} { allow read, write: if false; }`. Cualquier
   coleccion nueva esta denegada hasta que le añadas su propio `match` ANTES de esa linea.

## Paso 1 — Acceso del servidor a Firestore, y PARA hasta comprobarlo

- Añade `firebase-admin` a `dependencies` del `package.json`.
- Crea `server/firestore.ts` que exporte:
  - `DATABASE_ID: string` — de `process.env.FIRESTORE_DATABASE_ID`; si no, del campo
    `firestoreDatabaseId` de `firebase-applet-config.json`; si no, `'(default)'`.
  - `adminDb(): Firestore | null` — inicializa de forma perezosa y devuelve el cliente. NUNCA lanza:
    si algo falla, registra el error y devuelve `null`. La forma exacta es esta y NO otra:

        const { getApps, initializeApp, applicationDefault } = await import('firebase-admin/app');
        const { getFirestore } = await import('firebase-admin/firestore');
        const app = getApps().find(a => a.name === 'league')
          ?? initializeApp({ credential: applicationDefault(), projectId }, 'league');
        const db = getFirestore(app, DATABASE_ID);   // DOS argumentos, siempre

    Cuidado con las sobrecargas de `getFirestore`: `getFirestore(app)` compila perfectamente y apunta
    en silencio a la base `(default)`, que en este proyecto existe pero esta VACIA. Y `getFirestore(id)`
    con un solo string tambien compila, pero usa la app por defecto en vez de la tuya. Siempre las dos.
    Usa `await import(...)` dentro del try, no un import estatico arriba: asi, si la dependencia no
    quedo instalada, el servidor degrada con `reason: 'no_admin_sdk'` en vez de reventar al arrancar.
  - `firestoreStatus(): Promise<{ ok: boolean; databaseId: string; reason?: string }>` — hace una
    lectura trivial y dice si funciono.
- EL SERVIDOR DEBE ARRANCAR IGUAL SIN CREDENCIALES. Nada de `process.exit`. Si no hay acceso, las rutas
  de liga responden `{ ok: false, fallback: true, reason: 'no_firestore' }` y la app sigue funcionando
  entera: las ligas son una funcion opcional, no pueden tumbar el juego.
- Crea `server/league/routes.ts` con `export const leagueRouter = Router()` y de momento una sola ruta:
  `GET /health` que devuelva `{ ok: true, data: await firestoreStatus() }`. Sin `requireAuth`, es
  diagnostico.
- Monta `app.use('/api/league', leagueRouter)` en `server.ts`, junto a los otros routers y ANTES del
  catch-all de `/api`.

PUERTA DE VERIFICACION: no sigas al paso 2 hasta que `GET /api/league/health` responda `ok: true` con el
databaseId correcto EN EL DESPLIEGUE REAL, no solo en local. Si responde un error de permisos, DETENTE y
dime el mensaje exacto: significa que a la cuenta de servicio de Cloud Run le falta el rol de acceso a
Firestore y eso lo tiene que conceder una persona en la consola de Google Cloud.

## Paso 2 — Modelo de datos y reglas

Colecciones nuevas, fuera de `players/`:

    leagues/{leagueId}
      nombre: string (max 40)
      codigo: string (6 caracteres)
      creadorUid: string
      tz: string                      // zona horaria canonica de la liga, la del creador
      metricas: string[]              // de momento siempre ['constancia']
      temporada: { tipo: 'semanal', inicio: 'YYYY-MM-DD', fin: 'YYYY-MM-DD' }
      maxMiembros: number
      createdAt: string

    leagues/{leagueId}/members/{uid}
      displayName: string
      joinedAt: string
      role: 'owner' | 'member'

El `displayName` lo lee el servidor de `players/{uid}.profile.displayName`; el cliente no lo manda,
para que nadie se ponga el nombre de otro.

Añade a `src/lib/game-balance.ts` una seccion nueva con:

    export const LEAGUE = {
      maxMembers: 12,
      maxLeaguesPerPlayer: 3,
      codeLength: 6,
      codeAlphabet: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',  // sin O, 0, I ni 1: se confunden al dictarlas
      seasonType: 'semanal',
    } as const;

Reglas nuevas en `firestore.rules`, ANTES del catch-all final:

    match /leagues/{leagueId} {
      function esMiembro() {
        return request.auth != null
          && exists(/databases/$(database)/documents/leagues/$(leagueId)/members/$(request.auth.uid));
      }
      allow read: if esMiembro();
      allow write: if false;

      match /members/{memberUid} { allow read: if esMiembro(); allow write: if false; }
      match /scores/{scoreUid}  { allow read: if esMiembro(); allow write: if false; }
    }

Fijate en lo que implica: el cliente NO puede escribir nada de ligas, y un no miembro no puede ni leer
la liga. Por eso unirse con un codigo pasa obligatoriamente por el servidor, que es quien busca la liga
por codigo y añade al miembro.

## Paso 3 — Rutas del servidor

Todas bajo `/api/league`, todas con `requireAuth` salvo `/health`, todas con el contrato de respuesta
uniforme, y todas comprobando la membresia antes de devolver nada:

- `POST /create` — entrada `{ nombre }`. Genera un codigo unico con `LEAGUE.codeAlphabet` reintentando si
  choca, crea la liga con la temporada de la semana en curso, añade al creador como `owner`.
  Devuelve `{ leagueId, codigo }`. Limite: `rateLimit('league-create', 5)`.
- `POST /join` — entrada `{ codigo }`. Busca la liga por codigo; si no existe devuelve
  `reason: 'codigo_no_existe'`; si esta llena, `reason: 'liga_llena'`; si el jugador ya esta en
  `LEAGUE.maxLeaguesPerPlayer`, `reason: 'demasiadas_ligas'`. Limite: `rateLimit('league-join', 20)`.
- `POST /leave` — entrada `{ leagueId }`. Borra el documento de miembro. Si el que sale es el dueño y
  quedan otros, pasa el rol `owner` al miembro mas antiguo; si era el ultimo, borra la liga entera.
- `GET /mine` — las ligas del jugador con nombre, codigo y numero de miembros.
- `GET /:leagueId` — la liga y sus miembros, solo si quien pregunta es miembro.

Valida TODAS las entradas con Zod en `src/shared/schemas/league.ts` (nombre entre 3 y 40 caracteres,
codigo de exactamente 6 caracteres del alfabeto permitido) y reutiliza el patron de las rutas de
`server/ai/routes.ts`.

## Paso 4 — Pantalla

- `src/features/league/LeagueScreen.tsx`, ruta `/league` en `src/App.tsx`.
- Entrada desde Personaje: añade una `Row` con `icon="scale"` y titulo "Ligas con amigos" en el bloque
  de navegacion que ya existe al final de `src/features/character/CharacterScreen.tsx`. NO añadas una
  pestaña al menu inferior en esta fase.
- Sin ligas: `EmptyState` con `icon="scale"`, titulo "Compite con quien tu quieras" y dos botones,
  "Crear una liga" y "Entrar con un codigo".
- Con ligas: una `Card tone="tight"` por liga con `.list` de miembros, y arriba el codigo en grande con
  un boton de copiar. El codigo es lo que la gente comparte: que se lea de lejos.
- La hoja de crear/unirse con `Sheet`.
- Si `GET /api/league/health` devuelve `ok: false`, la pantalla muestra un `Notice tone="sys"` diciendo
  que las ligas no estan disponibles todavia, y no se rompe nada.

## Paso 5 — Lo que hay que corregir porque deja de ser verdad

- `src/features/auth/AuthScreen.tsx`: la frase "Sin funciones sociales. Nadie ve tus misiones ni tus
  fotos: solo tú." Cambiala por: "Tus misiones y tus fotos son solo tuyas. Si entras en una liga, tus
  amigos ven tu porcentaje de cumplimiento, nunca tus fotos."
- `README.md`: la nota que dice que la logica corre en el cliente y da igual "sin ranking ni social".
  Explica ahora que las puntuaciones de liga las calcula el servidor desde el historial con foto, y que
  por eso nadie puede escribirse su posicion.
- `firestore.rules`: BORRA el bloque `match /public_profiles/{uid}`. Esta reservado "para funciones
  sociales futuras" y no se usa en ningun sitio; las ligas NO se construyen sobre el (el nombre para
  mostrar lo copia el servidor a `leagues/{id}/members/{uid}`). Dejarlo ahi es una invitacion a que
  alguien lo abra mas adelante creyendo que hace falta. Al borrarlo, en el test de reglas la linea que
  hace `assertSucceeds` sobre `public_profiles/alice` pasa a ser `assertFails`.
- `docs/SYSTEM-LOG.md`: añade las filas de lo que el sistema hace solo con las ligas.
- `tests/rules/firestore.rules.test.ts`: añade un bloque que compruebe que un no miembro no lee la liga,
  que un miembro si la lee, y que NADIE puede escribir en `leagues` desde el cliente. Para preparar los
  datos de prueba usa `env.withSecurityRulesDisabled`.

## Reglas de la casa que no puedes romper

- La clave de Gemini vive solo en el servidor. Nunca en el cliente.
- `src/lib/game-balance.ts` es el unico archivo de balance.
- `awardRewards()` es la unica puerta por la que se dan XP y monedas. Las ligas NO reparten XP ni
  monedas en esta fase.
- Nunca se borra historial: ni monedero, ni completaciones, ni fallos.
- Firestore nunca en modo de prueba abierto.
- No toques el modulo de gimnasio, ni el de agenda, ni la pantalla Hoy en esta fase.

## Cuando termines

Ejecuta `npm run typecheck`, `npm test` y `npm run build`, y dime: si `/api/league/health` funciono en
el despliegue real, que archivos tocaste, y que quedo sin hacer.
```

---

# PROMPT 2 de 3 — La tabla: constancia y gimnasio

> Solo después de que la fase 1 esté desplegada y `GET /api/league/health` responda `ok: true`.

```
Continuamos con las ligas de LIFE QUEST. La fase 1 ya funciona: el servidor lee Firestore, se puede
crear una liga, entrar con un codigo y ver los miembros. Ahora toca la tabla de posiciones.

Manten todas las reglas de la casa de la fase anterior: un solo archivo de balance, el contrato de API
uniforme, el sistema de diseño existente, los ids de icono que existen, todo en español.

## La idea de puntuacion, y por que es asi

Cada metrica da de 0 a 100 y el puntaje es la MEDIA de las metricas activas. Asi el numero se entiende
sin explicacion: "vas al 87 %". Nada de puntos arbitrarios.

- CONSTANCIA = misiones cumplidas entre misiones programadas.
- GIMNASIO = sesiones hechas entre sesiones programadas.

Se compara por porcentaje a proposito: alguien con 3 misiones y alguien con 8 tienen las mismas
opciones de ganar, y nadie gana por llenarse la bitacora de misiones triviales.

## El algoritmo, con precision

ANTES DE NADA, un detalle que rompe la compilacion: `tsconfig.server.json` solo incluye
`["server.ts", "server", "src/shared", "src/lib/game-balance.ts"]`. El calculo necesita `isScheduledOn`,
`windowFor` y `weekdayOf` de `src/lib/time.ts`, asi que **añade `"src/lib/time.ts"` a ese `include`** o
`npm run typecheck` fallara. Ese archivo solo usa `Intl` y `Date`, es seguro en Node.

Pon la funcion de calculo en `src/shared/league/score.ts` (compartida, pura, sin React ni Firebase) y
que `server/league/score.ts` solo la envuelva leyendo datos. Asi el cliente puede explicar TU propia
fila con el mismo codigo, sin que existan dos implementaciones que acaben discrepando.

La funcion PURA y testeable:

    computePlayerScore(input: {
      missions: Mission[];
      completions: Completion[];
      season: { inicio: string; fin: string };
      tz: string;
      metricas: string[];
    }): { puntos: number; desglose: {...}; diasContados: number; programadas: number }

Recorre dia a dia el rango de la temporada, PARANDO EN AYER en la zona horaria de la liga: el dia en
curso no puntua para nadie, porque si no ganaria quien abre la app mas tarde.

Para cada dia cuenta como PROGRAMADA cada mision que cumpla todo esto:
- `m.active` y `m.mastery.state !== 'automated'`
- `m.type` es `'daily'` o `'side'`
- `m.stakes !== 'none'`  (los compromisos de agenda no cuentan: no castigan al fallar)
- `isScheduledOn(m.schedule, dia)` de `src/lib/time.ts`
- la mision existia ya ese dia: `m.createdAt.slice(0,10) <= dia`

Y como CUMPLIDA si existe una completacion de esa mision ese dia que pase TODOS estos filtros:
- `status !== 'annulled'`
- si `m.requiresPhoto`, tiene `evidenceId` distinto de null
- `clockSuspect` no es true
- `completedAt` cae dentro de la ventana de la mision ese dia, mas las horas de gracia
  (usa `windowFor(m.schedule, weekdayOf(dia))` y `GRACE.hoursAfterWindow`)
- si hay varias para el mismo par mision-dia, cuenta una sola

Tope por dia: como mucho `LEAGUE.maxMissionsCountedPerDay` misiones cuentan cada dia, para que nadie
gane creando veinte misiones de un minuto.

GIMNASIO: misma cuenta pero solo sobre la mision del modulo de gimnasio, que es una sola y se reconoce
por `moduleId === 'gym'`. Su horario varia por dia de la semana con `schedule.windowsByDay`, asi que
usa `isScheduledOn` y `windowFor` igual que arriba, sin tratarla como un caso especial.

Si una metrica no tiene datos (cero programadas), no cuenta para la media en vez de puntuar cero: quien
no tiene gimnasio configurado no debe salir hundido por ello.

MINIMO PARA PUNTUAR: si un jugador tiene menos de `LEAGUE.minScheduledPerWeek` misiones programadas en
la semana, aparece en la tabla pero sin puesto, con la nota "necesita al menos N misiones programadas".

Desempate, en este orden: mas dias contados, mas misiones cumplidas, y por ultimo el uid, para que el
resultado sea siempre el mismo.

CONGELA LA ZONA HORARIA de cada miembro al entrar en la liga, guardandola en su documento de miembro, y
usa esa y no `player.profile.timezone`. El jugador puede cambiar su zona horaria cuando quiera, y
cambiarla corre el dia logico: seria regalarse un dia. Por la misma razon, el limite de "dia cerrado"
se calcula con la zona de la liga mas las horas de gracia, NUNCA con `player.streak.lastProcessedDay`,
que es un campo que el cliente escribe y puede retrasar para sacar un mal dia del denominador.

Añade a `LEAGUE` en `game-balance.ts`: `maxMissionsCountedPerDay: 8`, `minScheduledPerWeek: 5`,
`syncCooldownMinutes: 15`, `maxReadsPerRequest: 400`.

## La trampa que NO vamos a perseguir, y como se compensa

Un jugador puede editar sus propias misiones y recortarse los dias programados para inflar su
porcentaje. Taparlo por codigo seria caro y fragil. En su lugar, la tabla muestra SIEMPRE, al lado del
porcentaje, cuantas misiones programadas tiene cada uno esa semana. Entre amigos, ver que alguien
compite con dos misiones mientras los demas llevan ocho resuelve el problema solo. La transparencia sale
mas barata que la vigilancia.

Documenta esto en un comentario al principio de `server/league/score.ts`, junto con la lista de lo que
si se filtra. Que quien lea el codigo dentro de seis meses sepa que fue una decision, no un descuido.

## Cache y coste: recalcula SOLO la fila de quien pregunta

Echa la cuenta antes de escribir nada. Recalcular un miembro cuesta ~80 lecturas (su jugador, sus
misiones, sus completaciones de la semana y las evidencias que hay que comprobar). Recalcular la liga
entera de 6 personas son ~480. Si haces eso cada 30 minutos son 23 000 lecturas al dia PARA UNA SOLA
LIGA: casi la mitad de la cuota gratuita diaria de TODA la app. No sirve.

Hazlo asi:

- `POST /api/league/:id/sync-me` recalcula **solo la fila del que llama** y despues reconstruye el
  documento de tabla leyendo las 6 filas ya guardadas. Coste: ~86 lecturas, no 480.
- Cooldown por miembro de `LEAGUE.syncCooldownMinutes` (15), guardado EN FIRESTORE junto a su fila, no
  en memoria: `rateLimit()` es un `Map` del proceso, se pierde al reiniciar y no se comparte entre
  instancias de Cloud Run, asi que no sirve para esto.
- `GET /api/league/:id/table` NO recalcula nunca: devuelve el documento ya guardado, 1 lectura.
- La pantalla llama a `sync-me` al abrirse; si esta en cooldown, el servidor responde `{ stale: true }`
  con 1 lectura y la pantalla muestra la tabla que ya tiene.
- CORTACIRCUITOS OBLIGATORIO: `LEAGUE.maxReadsPerRequest = 400`. Lleva un contador de lecturas en el
  modulo que habla con Firestore y aborta devolviendo `reason: 'read_budget'` si se pasa. Sin esto, un
  fallo en el bucle de dias se come la cuota diaria de toda la app y deja de funcionar el juego entero,
  no solo las ligas.
- Muestra siempre en pantalla cuando se calculo ("actualizado hace 12 min"). Una tabla que puede ir
  quince minutos por detras genera discusiones si no se avisa.

Nunca recalcules en un bucle, ni al arrancar el servidor, ni para todos los miembros a la vez.

## Pantalla

En `LeagueScreen`, para cada liga:
- Cabecera con el nombre, los dias que quedan de la semana y el codigo.
- La tabla con una fila por miembro usando la clase `.rankcard` que ya existe. A la izquierda el puesto;
  el primero con `<Icon id="crown" />` en oro. Luego el nombre, y debajo en `.s` el desglose:
  "18 de 21 cumplidas - 6 de 6 al gimnasio". A la derecha el porcentaje grande con `CountUp`.
- Debajo de cada fila, una `Bar thin` con el porcentaje, en el color del primero (oro) o en cian.
- Tu propia fila, resaltada con `.card.active`.
- Al tocar una fila, una `Sheet` con su semana dia a dia usando la clase `.dots30` que ya existe.
- `Label right="actualizado hace N min"` encima de la tabla, y un boton discreto de actualizar.
- Si la tabla viene vacia porque aun no hay dias cerrados, un `EmptyState` que lo explique: "La primera
  puntuacion sale mañana, cuando se cierre el dia de hoy."

## Pruebas

Crea `tests/server/leagueScore.test.ts` con datos fabricados a mano, cubriendo al menos:
- dos jugadores con distinto numero de misiones y el mismo porcentaje empatan
- una completacion sin foto en una mision que exige foto no cuenta
- una completacion fuera de ventana no cuenta
- una mision creada despues del dia que dice cumplir no cuenta
- el dia en curso no cuenta para nadie
- el tope de misiones por dia se respeta
- una metrica sin datos no hunde la media

Ejecuta `npm run typecheck`, `npm test` y `npm run build` antes de darlo por hecho.
```

---

# PROMPT 3 de 3 — Ahorro real, podio y crónica

> Solo después de que la tabla de la fase 2 funcione con datos reales durante al menos una semana.

```
Tercera y ultima fase de las ligas de LIFE QUEST. La tabla de constancia y gimnasio ya funciona. Ahora:
el reto de ahorro con dinero real, el podio de fin de semana y la cronica escrita por Gemini.

Mismas reglas de la casa de siempre.

## 1. Reto de ahorro con dinero real

La regla de privacidad manda: EL MONTO NUNCA SALE DE `players/{uid}`. A la liga solo se publica el
porcentaje de la meta. Si alguien se propone ahorrar 200 y otro 2000, compiten de igual a igual y
ninguno sabe la cifra del otro.

- Documento privado `players/{uid}/savings/{leagueId}`:
  `{ meta: number, moneda: string, aportes: [{ fecha, monto, evidenceId }] }`.
  Regla nueva en `firestore.rules`, dentro del bloque de `players/{uid}`:
  `match /savings/{id} { allow read, create, update: if isOwner(uid); allow delete: if false; }`.
- Pantalla: declarar la meta del mes, y un boton "Registrar un aporte" que pide foto con el
  `CameraButton` que ya existe y guarda la evidencia por el camino de siempre (`prepareEvidence` y
  `evidenceStorage` de `src/lib/storage.ts`). La foto es la prueba: el saldo, el deposito, la alcancia.
- El servidor, al calcular la tabla, lee ese documento, COMPRUEBA QUE CADA APORTE TENGA SU DOCUMENTO DE
  EVIDENCIA de verdad (un aporte sin foto no cuenta) y publica solo `Math.min(100, suma/meta*100)`.
- En la tabla, junto al porcentaje de ahorro, un `Chip` con `icon="check"` que diga "con prueba".
- Añade `'ahorro'` a las metricas posibles de una liga, activable al crearla.
- La IA NO analiza esta foto. Como la de evidencia de cualquier mision, solo prueba ante ti y ante tu
  liga que lo hiciste. Dejalo escrito en el README junto a la excepcion que ya existe para las fotos de
  configuracion del gimnasio.
- CONGELA LA META al empezar la temporada, guardandola fuera del alcance del cliente (en el documento
  privado del miembro dentro de la liga). Si el porcentaje se calcula contra la meta que vive en
  `players/{uid}`, cualquiera la baja a mitad de semana y salta al 100 %.
- Dilo en la pantalla con todas las letras, no solo en el codigo: una foto de dinero no prueba nada.
  Se puede fotografiar el mismo fajo diez veces. Lo que el servidor comprueba es que hay una foto de
  ese dia; lo demas es honor entre amigos. Un texto honesto aqui vale mas que fingir rigor.

## 1.b Sellar la hora de las completaciones (lo que cierra el antedatado)

Hoy alguien puede escribir completaciones con fecha pasada directamente en Firestore. Se cierra asi:

- El cliente empieza a escribir `serverAt: serverTimestamp()` en cada completacion nueva
  (`src/core/completion/complete.ts`) y en cada registro de sesion de gimnasio.
- DESPUES, y solo despues de comprobar en produccion durante unos dias que todas las completaciones
  nuevas llevan ese campo, se publica la regla `allow create: if isOwner(uid) && request.resource.data.serverAt == request.time;`
  en `completions`.
- EL ORDEN IMPORTA Y NO ES NEGOCIABLE. Si publicas la regla antes de que el cliente escriba el campo,
  Firestore rechaza TODAS las completaciones y el juego deja de funcionar para todo el mundo, no solo
  las ligas.
- Efecto secundario que hay que asumir y explicar: una completacion que se quedo en cola sin red
  resuelve su `serverAt` al reconectar. La liga ignora las que llegan mas de `LEAGUE.maxSealDelayHours`
  (48) despues del cierre de su dia. Quien estuvo tres dias sin conexion conserva su progreso en el
  juego pero pierde esos dias en la liga. Dilo en la pantalla.

## 2. Podio de fin de temporada

- Al cerrar la semana, la primera vez que alguien abre la tabla, el servidor escribe
  `leagues/{id}/podios/{temporada}` con los tres primeros y sus porcentajes. Se escribe UNA SOLA VEZ y
  no se recalcula nunca mas: es historia.
- Al ganador se le otorga una medalla `liga_ganada` en `players/{uid}/medals`. La escribe el servidor.
  Añadela a `MEDAL_DEFS` en `src/features/character/MedalsGallery.tsx` con `metal: 'gold'` y
  `glyph: 'crown'`, condicion "Gana una semana de liga".
- La medalla NO da XP ni monedas: no queremos que competir sea la forma optima de subir de nivel. Que
  valga por lo que es.
- En la pantalla de liga, una seccion "Historial" con los podios anteriores.

## 3. Cronica de la semana

- `POST /api/league/:id/cronica` con `rateLimit('league-cronica', 5)`. Reutiliza `structuredCall` de
  `server/ai/model.ts` con un esquema Zod nuevo en `src/shared/schemas/league.ts`.
- Recibe solo nombres y porcentajes, nunca fotos ni descripciones de misiones ni montos.
- Devuelve un parrafo corto en el tono del Sistema del juego: reconoce al ganador, señala una remontada
  o una racha, y cierra con algo para la semana que viene. Nada de humillar al ultimo: esto tiene que
  dar ganas de volver, no verguenza.
- SIEMPRE con respaldo local: si la IA no esta disponible, una frase armada con plantillas. La pantalla
  no puede quedarse en blanco por un fallo de Gemini.
- Se muestra arriba de la tabla en una `Card tone="sys"`, con la clase `.sysline` en cursiva.

## 4. Remates

- Ahora si, añade "Ligas" como pestaña ocultable: entrada en `OPTIONAL_VIEWS` de
  `src/components/Shell.tsx` con id `'league'` e icono `scale`, y el interruptor correspondiente en
  Ajustes, que ya recorre ese array solo.
- Aviso push cuando alguien te pasa en la tabla, respetando el tope de 4 avisos al dia que ya existe.
  Como maximo uno de estos al dia, y solo si el jugador tiene la liga visible.
- Una tarjeta en el tutorial de bienvenida explicando las ligas en tres lineas.

Añade a `LEAGUE` en `game-balance.ts`: `maxSealDelayHours: 48` y los topes del reto de ahorro.

Ejecuta `npm run typecheck`, `npm test` y `npm run build`, y resume que quedo hecho.
```

---

## Qué comprobar después de cada fase

| Fase | La prueba de que quedó bien |
|---|---|
| 1 | `GET /api/league/health` responde `ok: true` con el databaseId largo, en la URL de Cloud Run. Creas una liga, te da un código, entras desde otra cuenta con ese código y os veis los dos. |
| 2 | Al día siguiente de cumplir misiones, la tabla muestra un porcentaje que cuadra con lo que hiciste. Una completación sin foto no suma. El día de hoy no puntúa. |
| 3 | Declaras una meta de ahorro, registras un aporte con foto y en la tabla sale el porcentaje pero nunca el monto. Al cerrar la semana aparece el podio y la medalla. |

## Si AI Studio dice que no puede

**"No tengo permiso para leer Firestore" o `PERMISSION_DENIED` en el health.** Es el escenario previsto.
La cuenta de servicio con la que corre Cloud Run necesita el rol *Cloud Datastore User* sobre el
proyecto. Se concede en la consola de Google Cloud, en IAM, y no cuesta dinero. Si el proyecto
gestionado no deja tocar IAM, dímelo: hay una alternativa sin servidor, con cada jugador publicando su
propia puntuación y la liga viendo las pruebas, a cambio de que sea posible inflarse los números.

**"El health funciona pero la tabla sale vacía".** Casi seguro es el `databaseId`: se inicializó el SDK
contra la base `(default)`, que está vacía. Que imprima el `databaseId` que está usando y lo compare con
el de `firebase-applet-config.json`.

**"Rompí las pruebas de reglas".** El test que exige que un perfil ajeno sea ilegible sigue siendo
correcto y no hay que borrarlo: hay que añadirle al lado los casos de `leagues`.
