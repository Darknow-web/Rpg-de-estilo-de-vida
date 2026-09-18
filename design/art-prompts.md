# Prompts de arte para Nano Banana

Arte de Life Quest generado con Nano Banana (Gemini Image). Los PNG se suben a una carpeta de Google Drive con el **nombre de archivo exacto** de cada pieza; `scripts/optimize-art.mjs` los convierte a WebP en `public/art/`. Mientras un archivo no exista, la app muestra el SVG de respaldo.

## Cómo usarlos

1. Genera primero la **hoja de estilo** (`style-sheet.png`).
2. En cada prompt siguiente, adjunta `style-sheet.png` como imagen de referencia para que el material y la luz sean los mismos.
3. Formato 1:1, 1024×1024 (salvo donde se indica). Fondo sólido `#090A10`: es el color exacto de la app, así no hay que recortar nada.
4. Si algo sale muy brillante o muy "cartoon", cambia `polished` por `matte` o quita `glass-like enamel` en el bloque BASE. No rehagas el prompt entero.
5. Guarda cada imagen como `<nombre>.png` en la carpeta de Drive.

## Bloque BASE (pégalo al final de todos los prompts)

```
Premium dark-fantasy mobile game UI asset, minimalist and modern, a single centered object filling about 70% of a square 1:1 frame, on a perfectly flat uniform solid background of the exact color #090A10 with no gradient, no vignette, no texture and no floor shadow. Rendered as a clean 3D object with polished metal, glass-like enamel and subtle engraved detail, lit by a soft studio rim light plus a faint colored glow matching the object's accent color, crisp edges, high detail, no text unless specified, no watermark, no border.
```

## 1. Hoja de estilo → `style-sheet.png`

```
Generate a reference sheet showing three identical heraldic heater-shaped shield medals side by side in one row, evenly spaced: the left one in aged bronze with warm copper highlights, the middle one in brushed silver with cool white highlights, the right one in polished gold with warm amber highlights. Each shield has a beveled rim, a smooth face, a small faceted gem set at the top edge, and an empty center. + BASE
```

## 2. Medallas (plantilla, con `style-sheet.png` adjunta)

```
Using the attached style sheet as the exact material, lighting and shape reference, generate one heraldic heater-shaped shield medal in [METAL], with a small faceted [GEM] gem at the top edge and, in the center, a bold raised emblem of [GLYPH] catching the light. + BASE
```

| Archivo | METAL | GEM | GLYPH |
|---|---|---|---|
| `medal-chain-bronze` | aged bronze | teal | two interlocked chain links |
| `medal-mastered-silver` | brushed silver | teal | a round wax-seal disc with a heavy check mark |
| `medal-trait-gold` | polished gold | amber | a five-point star inside a laurel wreath |
| `medal-reborn-silver` | brushed silver | orange | a phoenix rising from a small flame |
| `medal-boss-gold` | polished gold | red | a stylized skull wearing a small crown |
| `medal-campaign-gold` | polished gold | amber | a waving banner on a short pole |
| `medal-rank-c` | blue steel with a #3B82FF enamel face | blue | the capital letter C in a heavy geometric sans-serif |
| `medal-rank-b` | dark steel with a #8B5CF6 amethyst enamel face | violet | the capital letter B, same font |
| `medal-rank-a` | dark steel with a #FF7A3D glowing copper enamel face | orange | the capital letter A, same font |
| `medal-rank-s` | polished gold with a #FFC94A enamel face | white | the capital letter S, same font |
| `medal-streak-7-bronze` | aged bronze | orange | a flame with the number "7" engraved inside it |
| `medal-streak-30-silver` | brushed silver | orange | a flame with the number "30" engraved inside it |
| `medal-streak-100-gold` | polished gold | orange | a flame with the number "100" engraved inside it |
| `medal-punctual-bronze` | aged bronze | blue | a stopwatch face whose single hand points just before twelve |
| `medal-punctual-silver` | brushed silver | blue | a stopwatch face whose single hand points just before twelve |
| `medal-punctual-gold` | polished gold | blue | a stopwatch face whose single hand points just before twelve |

La versión gris "bloqueada" la hace la app por CSS; no se genera.

## 3. Rangos → `rank-d`, `rank-c`, `rank-b`, `rank-a`, `rank-s`

```
Generate a rounded-square rank badge, thick and slightly convex, made of [MATERIAL], with the capital letter [L] inlaid in the center in a heavy geometric sans-serif, the letter surface slightly recessed and glowing softly in [COLOR]. + BASE
```

| Archivo | MATERIAL | L | COLOR |
|---|---|---|---|
| `rank-d` | dark matte iron | D | #8B93A8 |
| `rank-c` | blue-tinted steel | C | #3B82FF |
| `rank-b` | amethyst crystal | B | #8B5CF6 |
| `rank-a` | ember-hot copper with faint heat shimmer | A | #FF7A3D |
| `rank-s` | polished gold with a faint starburst | S | #FFC94A |

## 4. Clases → `class-<id>`

```
Generate a circular class medallion with a double outer ring in dark gunmetal, a deep dark-indigo radial core, and a raised [EMBLEM] in the center made of [MATERIAL] with a soft [COLOR] glow. + BASE
```

| Archivo | EMBLEM | MATERIAL | COLOR |
|---|---|---|---|
| `class-guerrero` | a longsword crossed in front of a small round shield | ember-orange copper | #FF7A3D |
| `class-erudito` | an open scroll with a quill | blue-tinted silver | #3B82FF |
| `class-asceta` | a single tall candle flame | violet crystal | #8B5CF6 |
| `class-mercader` | a coin on a small balance scale | polished gold | #FFC94A |
| `class-sanador` | a herb leaf with a heartbeat line across it | teal enamel | #38F2D7 |
| `class-vagabundo` | a compass rose | brushed silver | #C9CFDD |

## 5. Atributos → `attr-<id>`

```
Generate a single faceted gem in [COLOR] glass, cut in a soft hexagonal shape, with [SYMBOL] etched in light inside it as if suspended in the crystal. + BASE
```

| Archivo | COLOR | SYMBOL |
|---|---|---|
| `attr-fuerza` | #FF7A3D | a dumbbell |
| `attr-disciplina` | #8B5CF6 | a shield with a check mark |
| `attr-intelecto` | #3B82FF | an open book |
| `attr-riqueza` | #FFC94A | a diamond |
| `attr-vitalidad` | #38F2D7 | a heart with a pulse line |

## 6. Ilustraciones

`illus-onboarding-body`, `illus-onboarding-mind`, `illus-onboarding-money`, `illus-onboarding-rest`:

```
Generate a minimalist 3D icon-illustration of [a running figure made of soft glowing orange energy | a floating open book with blue light pages | a stack of gold coins with one coin spinning | a crescent moon resting on a soft pillow]. + BASE
```

`illus-fallen`:

```
Generate a cracked heater shield lying tilted in thin dark mist, with one faint red ember glowing inside the crack, accent color #FF3B5C. + BASE
```

`illus-empty-today`:

```
Generate a sword resting upright in a small stone pedestal under a thin crescent moon, calm and quiet, soft teal glow. + BASE
```

`illus-levelup-burst` (formato 9:16):

```
Generate an abstract vertical field of tiny golden and teal light particles rising from the bottom on the solid color #090A10, sparse and elegant, no object, no text.
```

`app-icon` (1:1, 1024 px):

```
Generate a flat-shaded app icon: a heater shield in dark gunmetal with a bold upward arrow in bright teal #38F2D7 cut into it, centered, filling 60% of the canvas, on the solid color #090A10, no text, no gloss, crisp vector-like edges.
```

## Integración

```
npm run art -- <carpeta-con-los-png>
```

Convierte cada PNG a WebP (256 px para medallas, rangos y atributos; 512 px para clases e ilustraciones; 1024 para `app-icon`) en `public/art/`. Los componentes `MedalShield`, `RankSquare` y `ClassMedallion` cargan `/art/<nombre>.webp` si existe y, si no, muestran el SVG.
