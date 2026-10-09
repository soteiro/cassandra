import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { LimiteEnCursoService } from './limite-en-curso.service';
import { ToastService } from './toast.service';
import { setupHttpTesting } from '../../testing/http-testing';

describe('LimiteEnCursoService', () => {
  let http: HttpTestingController;
  let toast: ToastService;

  beforeEach(() => {
    http = setupHttpTesting();
    toast = TestBed.inject(ToastService);
    vi.spyOn(toast, 'info');
  });

  afterEach(() => http.verify());

  const verificar = (enCurso: number, limite: number) => {
    TestBed.inject(LimiteEnCursoService).verificar();
    http.expectOne('/api/tareas?estado=En%20Curso').flush(Array.from({ length: enCurso }, (_, i) => ({ id: i })));
    http.expectOne('/api/preferencias').flush({ dia_revision: 0, limite_en_curso: limite });
  };

  it('avisa si te pasas del límite', () => {
    verificar(6, 5);
    expect(toast.info).toHaveBeenCalledWith('Tienes 6 tareas en curso y tu límite es 5. ¿Cuál pausas?');
  });

  it('no avisa en el límite o por debajo', () => {
    verificar(5, 5);
    expect(toast.info).not.toHaveBeenCalled();
  });
});
