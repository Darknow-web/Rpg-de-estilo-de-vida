# Checklist de la consola de Firebase antes de que otra persona use la app

## Seguridad
- [ ] **Firestore → Reglas** contiene exactamente `firestore.rules` del repo y está **publicado** (no el modo de prueba `allow read, write: if true` ni el de "30 días").
- [ ] Ejecutaste `npm run test:rules` en local y pasan todas (aislamiento entre jugadores, inmutabilidad de wallet/completions/failures, límite de 300 KB por foto).
- [ ] Prueba manual: entra con la cuenta A, crea una misión; cierra sesión; entra con la cuenta B: no ves nada de A.
- [ ] **Authentication → Sign-in method:** Google y Correo/contraseña habilitados; "Enumeración de correos" protegida (Configuración → Protección de enumeración de correos electrónicos: activada).
- [ ] **Authentication → Dominios autorizados:** solo `localhost`, el dominio `*.run.app` de tu servicio y (si aplica) tu dominio propio.
- [ ] La clave `GEMINI_API_KEY` está SOLO en las variables del servidor (AI Studio → Secrets). Nunca en `VITE_*`. Verifica en el bundle: `grep -r "AIza" dist/assets/*.js` no debe encontrar tu clave de Gemini (la de Firebase web sí es pública y es normal que aparezca).
- [ ] App Check (opcional, recomendado si abres la app a más gente): Firebase → App Check → reCAPTCHA v3 para la app web.

## Cuotas y límites (capa Starter)
- [ ] Firestore: 1 GiB total. Cada foto pesa ~60–120 KB; un jugador activo usa ~150 MB/año. Con 5+ jugadores, revisa el uso mensualmente (Firestore → Uso) y usa "Archivar fotos" en Ajustes.
- [ ] Lecturas 50k/día y escrituras 40k/día compartidas. La app hace ~10–20 escrituras por misión completada y suscribe a ~10 consultas por sesión: sobra para uso personal; si superas la cuota, Firestore pausa hasta medianoche (hora del Pacífico).
- [ ] Egreso 10 GiB/mes. Una galería de 30 fotos son ~3 MB. Bien para pocos jugadores.
- [ ] Gemini API: límites por usuario en `server/ai/routes.ts` (12 onboardings, 40 tasaciones, 30 propuestas por día). Ajusta si haces pruebas intensivas.

## Subida de fotos
- [ ] Límite duro por foto: 300 KB en `firestore.rules` y en `game-balance.ts` (`EVIDENCE.maxBytes`). Deben coincidir.
- [ ] Compresión: 800 px lado largo, JPEG 0.7 (`EVIDENCE` en `game-balance.ts`).
- [ ] Si activas Cloud Storage (Blaze): `storage.rules` publicado, `VITE_EVIDENCE_BACKEND=cloud-storage`, y el adaptador completo.

## Antes de dar acceso
- [ ] Índices compuestos creados (Firestore → Índices) o importados desde `firestore.indexes.json`.
- [ ] `npm run build` y `npm test` en verde en la rama desplegada.
- [ ] Abriste la URL en un Android real, instalaste la PWA y completaste una misión con foto desde la cámara (3 toques).
- [ ] Probaste el modo avión: completar una misión offline y verla sincronizada al reconectar.
