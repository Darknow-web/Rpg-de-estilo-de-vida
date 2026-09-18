# Qué hace el sistema solo (y por qué)

Principio rector: **automático por defecto, pero nunca a escondidas**. Toda acción automática (a) queda registrada en `players/{uid}/systemLog` con su razón, (b) es reversible cuando tiene sentido, y (c) si decide algo que le importa al jugador, es una PROPUESTA que se aprueba con un toque, no un hecho consumado.

| Acción automática | Cuándo | Reversible | Dónde se ve |
|---|---|---|---|
| Programar misiones en la franja horaria declarada | Onboarding y propuestas | Editar misión | Hoy, Detalle de misión |
| Aplicar fallas pendientes y daño de corazones | Al abrir la app / cada 30 s si pasó la gracia | No (queda anotado) | Resumen "Mientras no estabas", Historial |
| Regenerar +1 corazón por día limpio | Al cerrar el día | — | Historial |
| Activar bonus de descanso (+50 % XP, 5 misiones) | Tras 3+ días sin abrir | — | Hoy (banda verde), Historial |
| Reiniciar o proteger la racha | Al cerrar el día con fallas | — | Historial |
| Game over y misión de resurrección | Al llegar a 0 corazones | — | Banner "Has caído", Historial |
| Revivir con −50 % monedas si vence la resurrección | 7 días después de caer | — | Historial, Monedero |
| Cambiar el estado de dominio (Consolidada/Dominada/Automatizada) | Al completar/fallar | — | Detalle de misión, Historial |
| Otorgar medalla y bonus de monedas por dominio | Al dominar/automatizar | — | Personaje, Monedero |
| Proponer misión nueva al liberar cupo | Cupo libre | Es propuesta | Hoy (tarjeta del Maestro de Juego) |
| Proponer escalar una Consolidada | 14 días, ≤2 fallas | Es propuesta; y "Deshacer" tras aceptar | Hoy, Historial |
| Proponer bajar a mínima viable | >50 % fallas en 2 semanas | Es propuesta; "Deshacer" | Hoy, Historial |
| Proponer re-tasar la tienda | Al subir de rango | Es propuesta; "Deshacer" | Tienda, Historial |
| Recalcular monedas/día estimadas y precios sugeridos | Al agregar/escalar/dominar | — | Tienda |
| Revelar misión oculta | Al cumplir la condición | — | Hoy, Historial |
| Interés compuesto semanal (nodo) | Cambio de semana | — | Monedero, Historial |
| Regenerar rutina de gimnasio | Cada semana | Regenerar | Gym, Historial |
| Planificar hasta 4 avisos push | Cada apertura | Desactivar permiso | Ajustes |

Lo que el sistema **nunca** hace solo: borrar historial, bajar precios, quitar XP ya ganada, castigar más de una semana, decidir qué le importa al jugador.
