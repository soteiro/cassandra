import { ProjectResponse } from '../models/proyect.model';

export interface RespuestasRetrospectiva {
  cumplido: string;
  aprendido: string;
}

/**
 * Markdown del documento de retrospectiva: el propósito y el pre-mortem que se
 * escribieron al crear el proyecto, junto a lo que pasó de verdad.
 */
export function contenidoRetrospectiva(
  proyecto: ProjectResponse,
  estado: string,
  r: RespuestasRetrospectiva,
  fecha: Date,
): string {
  const partes = [
    `# Retrospectiva: ${proyecto.nombre}`,
    `**${estado}** el ${fecha.toLocaleDateString('es-CL')}.`,
  ];
  if (proyecto.para_que) partes.push(`## El para qué\n\n${proyecto.para_que}`);
  if (proyecto.premortem) partes.push(`## El pre-mortem decía\n\n${proyecto.premortem}`);
  if (r.cumplido) partes.push(`## ¿Se cumplió el para qué?\n\n${r.cumplido}`);
  if (r.aprendido) partes.push(`## ¿Qué aprendí?\n\n${r.aprendido}`);
  return partes.join('\n\n') + '\n';
}
