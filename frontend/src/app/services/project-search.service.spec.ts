import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ProjectSearchService } from './project-search.service';
import { proyectService } from './proyect.service';
import { ProjectResponse } from '../models/proyect.model';

const project = (id: number, nombre: string, nombre_padre?: string) =>
  ({ id, nombre, nombre_padre }) as ProjectResponse;

describe('ProjectSearchService', () => {
  const projects = signal<ProjectResponse[] | undefined>(undefined);
  let service: ProjectSearchService;

  beforeEach(() => {
    projects.set([
      project(1, 'Cassandra'),
      project(2, 'Kairos'),
      project(3, 'Backend', 'Cassandra'),
      project(4, 'Casa nueva'),
      project(5, 'Encaste'),
    ]);
    TestBed.configureTestingModule({
      providers: [{ provide: proyectService, useValue: { proyectResource: { value: projects } } }],
    });
    service = TestBed.inject(ProjectSearchService);
  });

  it('should return an empty list while projects are not loaded', () => {
    projects.set(undefined);
    expect(service.search('cas')).toEqual([]);
  });

  it('should return the first projects when the query is blank', () => {
    const result = service.search('   ', 2);
    expect(result.map((m) => m.project.id)).toEqual([1, 2]);
  });

  it('should rank prefix matches before substring matches, each sorted by name', () => {
    const result = service.search('cas');
    expect(result.map((m) => m.project.nombre)).toEqual(['Casa nueva', 'Cassandra', 'Encaste']);
  });

  it('should be case-insensitive and trim the query', () => {
    expect(service.search('  KAI ').map((m) => m.project.id)).toEqual([2]);
  });

  it('should build the path with the parent project name', () => {
    const [match] = service.search('backend');
    expect(match.path).toBe('Cassandra / Backend');
    expect(service.search('kairos')[0].path).toBe('Kairos');
  });

  it('should respect the limit', () => {
    expect(service.search('a', 1).length).toBe(1);
  });
});
