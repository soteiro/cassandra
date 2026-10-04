import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Observable } from 'rxjs';
import { FinanzasService } from './finanzas.service';
import { expectHttpCall, HttpCase, setupHttpTesting } from '../../testing/http-testing';

describe('FinanzasService', () => {
  let http: HttpTestingController;
  let service: FinanzasService;

  beforeEach(() => {
    http = setupHttpTesting();
    service = TestBed.inject(FinanzasService);
  });

  afterEach(() => http.verify());

  const base = '/api/finanzas';

  it.each<HttpCase>([
    { name: 'getBancos', call: () => service.getBancos(), method: 'GET', url: `${base}/bancos` },
    { name: 'createBanco', call: () => service.createBanco({ nombre: 'BCI' } as never), method: 'POST', url: `${base}/bancos`, body: { nombre: 'BCI' } },
    { name: 'updateBanco', call: () => service.updateBanco(1, { nombre: 'X' } as never), method: 'PUT', url: `${base}/bancos/1` },
    { name: 'deleteBanco', call: () => service.deleteBanco(1), method: 'DELETE', url: `${base}/bancos/1` },
    { name: 'getGrupos', call: () => service.getGrupos(), method: 'GET', url: `${base}/grupos` },
    { name: 'createGrupo', call: () => service.createGrupo({ nombre: 'Casa' } as never), method: 'POST', url: `${base}/grupos` },
    { name: 'updateGrupo', call: () => service.updateGrupo(2, {}), method: 'PUT', url: `${base}/grupos/2` },
    { name: 'deleteGrupo', call: () => service.deleteGrupo(2), method: 'DELETE', url: `${base}/grupos/2` },
    { name: 'getMovimientosEsperados', call: () => service.getMovimientosEsperados(), method: 'GET', url: `${base}/movimientos-esperados` },
    { name: 'createMovimientoEsperado', call: () => service.createMovimientoEsperado({} as never), method: 'POST', url: `${base}/movimientos-esperados` },
    { name: 'updateMovimientoEsperado', call: () => service.updateMovimientoEsperado(3, {}), method: 'PUT', url: `${base}/movimientos-esperados/3` },
    { name: 'deleteMovimientoEsperado', call: () => service.deleteMovimientoEsperado(3), method: 'DELETE', url: `${base}/movimientos-esperados/3` },
    { name: 'getPlantilla', call: () => service.getPlantilla(2026, 10), method: 'GET', url: `${base}/plantilla?anio=2026&mes=10` },
    { name: 'getPlantillaById', call: () => service.getPlantillaById(4), method: 'GET', url: `${base}/plantilla/4` },
    { name: 'createPlantillaItem', call: () => service.createPlantillaItem({} as never), method: 'POST', url: `${base}/plantilla` },
    { name: 'updatePlantillaItem', call: () => service.updatePlantillaItem(4, { estado: 'pagado' } as never), method: 'PUT', url: `${base}/plantilla/4`, body: { estado: 'pagado' } },
    { name: 'deletePlantillaItem', call: () => service.deletePlantillaItem(4), method: 'DELETE', url: `${base}/plantilla/4` },
    { name: 'getResumen', call: () => service.getResumen(2026, 1), method: 'GET', url: `${base}/resumen?anio=2026&mes=1` },
    { name: 'clonarPeriodo', call: () => service.clonarPeriodo({ anio: 2026 } as never), method: 'POST', url: `${base}/clonar`, body: { anio: 2026 } },
    { name: 'getListaDeseos', call: () => service.getListaDeseos(), method: 'GET', url: '/api/lista-deseos' },
    { name: 'getListaDeseos (filtros)', call: () => service.getListaDeseos(false, 7), method: 'GET', url: '/api/lista-deseos?comprado=false&grupo_id=7' },
    { name: 'createListaDeseos', call: () => service.createListaDeseos({} as never), method: 'POST', url: '/api/lista-deseos' },
    { name: 'updateListaDeseos', call: () => service.updateListaDeseos(5, {} as never), method: 'PUT', url: '/api/lista-deseos/5' },
    { name: 'deleteListaDeseos', call: () => service.deleteListaDeseos(5), method: 'DELETE', url: '/api/lista-deseos/5' },
  ])('$name should call $method $url', (c) => expectHttpCall(http, c));

  describe('batch operations', () => {
    it.each<[string, () => Observable<unknown[]>]>([
      ['batchUpdateEstado', () => service.batchUpdateEstado([], 'pagado' as never)],
      ['batchDelete', () => service.batchDelete([])],
      ['batchUpdateCategoria', () => service.batchUpdateCategoria([], 1)],
      ['batchUpdateBanco', () => service.batchUpdateBanco([], 1)],
    ])('%s should emit [] without requests for an empty id list', (_, call) => {
      const next = vi.fn();
      call().subscribe(next);
      expect(next).toHaveBeenCalledWith([]);
    });

    it('batchUpdateEstado should PUT every id and emit all results', () => {
      const next = vi.fn();
      service.batchUpdateEstado([1, 2], 'pagado' as never).subscribe(next);

      const reqs = http.match((r) => r.url.startsWith(`${base}/plantilla/`));
      expect(reqs.map((r) => [r.request.method, r.request.url, r.request.body])).toEqual([
        ['PUT', `${base}/plantilla/1`, { estado: 'pagado' }],
        ['PUT', `${base}/plantilla/2`, { estado: 'pagado' }],
      ]);
      reqs.forEach((r, i) => r.flush({ id: i + 1 }));

      expect(next).toHaveBeenCalledWith([{ id: 1 }, { id: 2 }]);
    });

    it('batchUpdateCategoria and batchUpdateBanco should send the right field (null allowed)', () => {
      service.batchUpdateCategoria([1], null).subscribe();
      service.batchUpdateBanco([2], 9).subscribe();

      expect(http.expectOne(`${base}/plantilla/1`).request.body).toEqual({ grupo_item_id: null });
      expect(http.expectOne(`${base}/plantilla/2`).request.body).toEqual({ banco_id: 9 });
      http.match(() => true).forEach((r) => r.flush({}));
    });

    it('batchDelete should DELETE every id', () => {
      service.batchDelete([1, 2, 3]).subscribe();
      const reqs = http.match((r) => r.method === 'DELETE');
      expect(reqs.length).toBe(3);
      reqs.forEach((r) => r.flush({ mensaje: 'ok' }));
    });

    it('batch operations should fail if any request fails', () => {
      const error = vi.fn();
      service.batchDelete([1, 2]).subscribe({ error });
      http.expectOne(`${base}/plantilla/1`).flush({});
      http.expectOne(`${base}/plantilla/2`).flush(null, { status: 500, statusText: 'err' });
      expect(error).toHaveBeenCalled();
    });
  });
});
