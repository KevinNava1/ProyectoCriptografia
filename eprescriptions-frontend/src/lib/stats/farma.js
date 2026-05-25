/**
 * Dataset de estadísticas para el rol FARMACÉUTICO.
 *
 * La "fecha relevante" del farma es CUÁNDO DISPENSÓ. El backend envía
 * `dispensaciones_propias: string[]` con los ISO timestamps de cada
 * dispensación que ESTE farma hizo de esta receta (excluye las de otros
 * farmas que hayan tocado la misma receta).
 *
 * Expandimos: por cada timestamp generamos una entrada (...receta, fecha=ts),
 * para que el heatmap pinte 1 punto por cada DISPENSACIÓN que él hizo, no
 * 1 por receta. Si la misma receta se dispensó 3 veces por este farma,
 * cuenta como 3 eventos en sus respectivos días.
 *
 * Si una receta llegó al endpoint pero `dispensaciones_propias` viene vacío
 * (no debería pasar con el endpoint correcto, pero por defensa), igual la
 * dejamos con su fecha original.
 */
export function datasetParaFarma(recetas) {
  const out = [];
  for (const r of recetas) {
    const propias = r.dispensaciones_propias || [];
    if (propias.length === 0) {
      out.push(r);
    } else {
      for (const ts of propias) {
        out.push({ ...r, fecha: ts });
      }
    }
  }
  return out;
}
