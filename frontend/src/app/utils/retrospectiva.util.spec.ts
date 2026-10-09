import { contenidoRetrospectiva } from './retrospectiva.util';
import { ProjectResponse } from '../models/proyect.model';

const proyecto = (over: Partial<ProjectResponse> = {}): ProjectResponse => ({
  id: 1,
  nombre: 'Mudanza',
  descripcion: '',
  comentario: '',
  fecha_creacion: '2026-01-01T00:00:00Z',
  estado: 'En Proceso',
  por_que: '',
  para_que: 'Vivir más cerca del trabajo',
  criterio_finalizacion: '',
  prioridad: 'Media',
  ...over,
});

describe('contenidoRetrospectiva', () => {
  it('junta propósito, pre-mortem y respuestas', () => {
    const md = contenidoRetrospectiva(
      proyecto({ premortem: 'Me quedo sin plata' }),
      'Completado',
      { cumplido: 'Sí', aprendido: 'Cotizar antes' },
      new Date(2026, 9, 9),
    );
    expect(md).toContain('# Retrospectiva: Mudanza');
    expect(md).toContain(`**Completado** el ${new Date(2026, 9, 9).toLocaleDateString('es-CL')}`);
    expect(md).toContain('## El para qué\n\nVivir más cerca del trabajo');
    expect(md).toContain('## El pre-mortem decía\n\nMe quedo sin plata');
    expect(md).toContain('## ¿Se cumplió el para qué?\n\nSí');
    expect(md).toContain('## ¿Qué aprendí?\n\nCotizar antes');
  });

  it('omite lo que no se escribió', () => {
    const md = contenidoRetrospectiva(proyecto({ para_que: '' }), 'Cancelado', { cumplido: '', aprendido: 'Nada' }, new Date());
    expect(md).not.toContain('El para qué');
    expect(md).not.toContain('pre-mortem');
    expect(md).not.toContain('¿Se cumplió');
    expect(md).toContain('Nada');
  });
});
