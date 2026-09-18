/**
 * Banco de misiones mínimas por atributo (fallback de "propuesta de misión nueva").
 * Genéricas, sin datos de nadie. El ancla se completa con la franja del jugador.
 */
import type { AttributeId } from '@/shared/types';

export interface BankMission {
  name: string;
  description: string;
  minimal: { name: string; description: string };
  minutes: number;
  evidence: string;
}

export const MISSION_BANK: Record<AttributeId, BankMission[]> = {
  fuerza: [
    { name: '10 flexiones (o de rodillas)', description: '{ancla}, hago 10 flexiones. Contra la pared si hace falta.', minimal: { name: '3 flexiones', description: 'Tres flexiones. Foto.' }, minutes: 3, evidence: 'Foto del lugar' },
    { name: 'Subir escaleras', description: '{ancla}, subo escaleras en vez de usar ascensor una vez.', minimal: { name: 'Un tramo de escaleras', description: 'Un tramo. Foto.' }, minutes: 3, evidence: 'Foto de la escalera' },
    { name: 'Estiramiento de 5 minutos', description: '{ancla}, estiro 5 minutos.', minimal: { name: 'Estirar el cuello', description: 'Un minuto de cuello. Foto.' }, minutes: 5, evidence: 'Foto de la esterilla o del lugar' },
    { name: 'Plancha de 20 segundos', description: '{ancla}, hago una plancha de 20 segundos.', minimal: { name: 'Plancha de 10 segundos', description: 'Diez segundos. Foto.' }, minutes: 2, evidence: 'Foto del cronómetro' },
  ],
  disciplina: [
    { name: 'Preparar lo de mañana', description: 'Antes de dormir, dejo listo lo que necesito mañana.', minimal: { name: 'Sacar una cosa para mañana', description: 'Una sola cosa lista. Foto.' }, minutes: 5, evidence: 'Foto de lo preparado' },
    { name: 'Lavar lo que uso', description: '{ancla}, lavo el plato o taza que acabo de usar.', minimal: { name: 'Lavar una taza', description: 'Una taza. Foto.' }, minutes: 3, evidence: 'Foto del fregadero vacío' },
    { name: 'Cinco minutos sin celular', description: '{ancla}, dejo el celular en otra habitación 5 minutos.', minimal: { name: 'Un minuto sin celular', description: 'Un minuto. Foto después.' }, minutes: 5, evidence: 'Foto del celular en su sitio' },
    { name: 'Revisar la agenda', description: '{ancla}, miro qué tengo mañana.', minimal: { name: 'Abrir la agenda', description: 'Abrirla. Foto.' }, minutes: 2, evidence: 'Foto de la agenda' },
  ],
  intelecto: [
    { name: 'Escuchar 5 minutos de podcast', description: '{ancla}, escucho 5 minutos de algo que me enseñe.', minimal: { name: 'Un minuto de podcast', description: 'Un minuto. Foto de la pantalla.' }, minutes: 5, evidence: 'Foto de la pantalla' },
    { name: 'Una palabra nueva', description: '{ancla}, aprendo una palabra nueva (idioma o vocabulario) y la anoto.', minimal: { name: 'Buscar una palabra', description: 'Buscarla. Foto.' }, minutes: 3, evidence: 'Foto de la nota' },
    { name: 'Repasar apuntes 5 minutos', description: '{ancla}, repaso 5 minutos de apuntes.', minimal: { name: 'Abrir los apuntes', description: 'Abrirlos. Foto.' }, minutes: 5, evidence: 'Foto de la página' },
    { name: 'Escribir 3 líneas', description: '{ancla}, escribo 3 líneas sobre lo que sea.', minimal: { name: 'Escribir una línea', description: 'Una línea. Foto.' }, minutes: 5, evidence: 'Foto del texto' },
  ],
  riqueza: [
    { name: 'Anotar el gasto del día', description: '{ancla}, anoto el gasto más grande de hoy.', minimal: { name: 'Guardar un recibo', description: 'Guardar un recibo. Foto.' }, minutes: 2, evidence: 'Foto del registro' },
    { name: 'Guardar una moneda', description: '{ancla}, paso una cantidad pequeña al ahorro (o a la alcancía).', minimal: { name: 'Abrir la alcancía', description: 'Mirarla. Foto.' }, minutes: 2, evidence: 'Foto de la alcancía o el comprobante' },
    { name: 'Un día sin compras impulsivas', description: 'Antes de dormir, confirmo que hoy no compré nada no planeado.', minimal: { name: 'Revisar una compra', description: 'Revisar la última compra. Foto.' }, minutes: 2, evidence: 'Foto de tu billetera' },
    { name: 'Comparar un precio', description: '{ancla}, comparo el precio de algo que voy a comprar en dos lugares.', minimal: { name: 'Mirar un precio', description: 'Mirar un solo precio. Foto.' }, minutes: 5, evidence: 'Foto de la comparación' },
  ],
  vitalidad: [
    { name: 'Fruta o verdura', description: '{ancla}, como una fruta o verdura.', minimal: { name: 'Un bocado de fruta', description: 'Un bocado. Foto.' }, minutes: 3, evidence: 'Foto de la fruta' },
    { name: 'Salir a la luz del día', description: '{ancla}, salgo 5 minutos a la luz natural.', minimal: { name: 'Asomarme a la ventana', description: 'Un minuto en la ventana. Foto.' }, minutes: 5, evidence: 'Foto del cielo' },
    { name: 'Acostarme a la hora fijada', description: 'A la hora que fijé, estoy en la cama con la luz apagada.', minimal: { name: 'Apagar una luz', description: 'Apagar la luz principal a la hora. Foto.' }, minutes: 1, evidence: 'Foto de la lámpara apagada' },
    { name: 'Dos minutos de respiración', description: '{ancla}, respiro lento dos minutos.', minimal: { name: 'Tres respiraciones', description: 'Tres respiraciones. Foto.' }, minutes: 2, evidence: 'Foto del lugar' },
  ],
};
