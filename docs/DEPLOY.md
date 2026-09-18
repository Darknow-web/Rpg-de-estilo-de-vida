# Despliegue: GitHub → Google AI Studio → Cloud Run (capa Starter, sin facturación)

Flujo: escribes y pruebas en local → push a GitHub → AI Studio trae el repo desde la pestaña GitHub → despliegas a Cloud Run con un clic.

## 1. Crear el proyecto en AI Studio e importar el repo

1. Entra a [aistudio.google.com](https://aistudio.google.com) → **Build** → **+ New app** (o abre el prompt vacío).
2. En el cuadro de prompt, menú **+ (Add files)** → **Import from GitHub** → autoriza GitHub y elige `Darknow-web/Rpg-de-estilo-de-vida` (rama principal).
3. AI Studio detecta el `package.json`, instala dependencias y arranca `npm run dev`. Si pregunta qué comando de inicio usar: **dev** = `npm run dev`, **build** = `npm run build`, **start** = `npm start`.
4. Ajustes (⚙) → pestaña **GitHub** → vincula el repo para sincronizar en ambos sentidos. A partir de aquí, cada `git push` se trae con **Pull** desde esa pestaña.

## 2. Provisionar Firestore y Auth (Starter Tier)

1. En el chat de AI Studio, pide: *"Enable Firebase for this app: Firestore and Authentication with Google Sign-In and Email/Password"*. Aparece la tarjeta **Enable Firebase** → acéptala.
2. AI Studio crea el proyecto Google-managed de la capa Starter con **Cloud Run, Firebase Auth, Firestore** (y opcionalmente Cloud SQL, que esta app no usa). La región se fija con el primer servicio: no se puede cambiar después.
3. Copia la configuración web de Firebase (la ves en la tarjeta de Firebase o en Firebase Console → Configuración del proyecto → Tus apps) a las variables de entorno del app en AI Studio:
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_PROJECT_ID` (mismo valor que el project id; el servidor lo usa para verificar tokens)
4. **Reglas de Firestore:** AI Studio redacta unas reglas genéricas. Reemplázalas por las del repo (`firestore.rules`): Firebase Console → Firestore Database → **Reglas** → pega el archivo → **Publicar**. Nunca dejes la base en modo de prueba abierto.
5. **Índices:** al usar por primera vez las consultas compuestas (galería por misión, historial), Firestore mostrará en la consola del navegador un enlace "create index". Puedes crearlos desde ese enlace o importar `firestore.indexes.json` (Firestore → Índices → importar).
6. **Auth:** Firebase Console → Authentication → **Sign-in method** → habilita **Google** (ya viene) y **Correo electrónico/contraseña**. En **Dominios autorizados** agrega el dominio `*.run.app` de tu servicio cuando lo tengas.

## 3. Fotos: Cloud Storage NO está en la capa Starter

Desde el 3 de febrero de 2026, Cloud Storage for Firebase exige plan Blaze (cuenta de facturación). La app guarda las fotos comprimidas **en Firestore** (`players/{uid}/evidence`) y no necesita Storage.

Si más adelante activas Blaze y quieres Storage real:
1. Firebase Console → **Storage** → Comenzar → elige región → crea el bucket por defecto.
2. Pega `storage.rules` en Storage → Reglas → Publicar.
3. En variables de entorno: `VITE_EVIDENCE_BACKEND=cloud-storage`.
4. Completa el adaptador `cloudStorageAdapter` en `src/lib/storage.ts` (usa `uploadBytes`/`getBytes` de `firebase/storage` con la ruta `players/{uid}/{evidenceId}.jpg`). El resto de la app no cambia.

## 4. Secreto de la Gemini API

- Al crear el app desde AI Studio, `GEMINI_API_KEY` se configura sola como secreto del **servidor** (nunca llega al cliente). Si importaste el repo y no está, ve a Ajustes del app → **Secrets / Environment variables** → agrega `GEMINI_API_KEY` con una clave de [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
- Opcional: `GEMINI_MODEL` para cambiar el modelo (por defecto `gemini-2.5-flash-lite`, el Flash más barato con salida estructurada).
- El servidor limita por usuario y día: 12 onboardings, 40 tasaciones, 30 propuestas, 30 interpretaciones de disponibilidad. Con la cuota gratuita de la Gemini API sobra para uso personal.

## 5. Web Push (opcional)

```bash
npx web-push generate-vapid-keys
```
Agrega `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:tu-correo` (servidor) y `VITE_VAPID_PUBLIC_KEY` (cliente). Sin estas variables, la app usa solo avisos locales mientras está abierta.

## 6. Desplegar a Cloud Run

1. En AI Studio, botón **Deploy** (arriba a la derecha) → **Deploy to Cloud Run**.
2. AI Studio construye la imagen con el `Dockerfile` del repo (o con buildpacks: `npm run build` + `npm start`), inyecta los secretos y publica una URL `https://<servicio>.run.app`.
3. Vuelve a Firebase Console → Authentication → Dominios autorizados → agrega ese dominio (si no, el login con Google falla con `auth/unauthorized-domain`).
4. Abre la URL en Android → Chrome → menú → **Instalar app**.

Cada vez que cambies código: `git push` → AI Studio → GitHub → **Pull** → **Deploy** de nuevo.

## 7. Costos

Todo cabe en la capa Starter (2 apps, sin tarjeta): Cloud Run, Auth, Firestore (1 GiB, 50k lecturas/día, 40k escrituras/día, 10 GiB egreso/mes) y la cuota gratuita de Gemini. Lo único que exigiría facturación es Cloud Storage (sección 3), que esta app evita.
