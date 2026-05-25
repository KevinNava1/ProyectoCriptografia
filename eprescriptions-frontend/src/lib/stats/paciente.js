/**
 * Dataset de estadísticas para el rol PACIENTE.
 *
 * La "fecha relevante" del paciente es CUÁNDO FIRMÓ cada acuse. El backend
 * envía `firmas_paciente: string[]` con los ISO timestamps de cada firma
 * (una receta puede tener varias dispensaciones, y por tanto varios acuses).
 *
 * Expandimos: por cada timestamp generamos una entrada (...receta, fecha=ts),
 * de modo que el heatmap pinte 1 punto por cada acuse firmado, no 1 por receta.
 * Las recetas sin acuses firmados aún se mantienen con su fecha de creación
 * para que igual aparezcan en el calendario (representan "actividad médica").
 */
export function datasetParaPaciente(recetas) {
  const out = [];
  for (const r of recetas) {
    const firmas = r.firmas_paciente || [];
    if (firmas.length === 0) {
      out.push(r);
    } else {
      for (const ts of firmas) {
        out.push({ ...r, fecha: ts });
      }
    }
  }
  return out;
}
