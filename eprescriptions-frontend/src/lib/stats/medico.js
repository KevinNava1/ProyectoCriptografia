/**
 * Dataset de estadísticas para el rol MÉDICO.
 *
 * La "fecha relevante" del médico es CUÁNDO EMITIÓ cada receta. El campo
 * `fecha` que viene del backend ya es exactamente eso (fecha_creacion del
 * AAD), así que no hay que transformar nada — devolvemos el array tal cual.
 *
 * Cada receta = 1 punto en charts/calendar/heatmap, en el día de su emisión.
 */
export function datasetParaMedico(recetas) {
  return recetas;
}
