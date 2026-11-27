import type { EnvironmentProviders, Provider } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';

/**
 * Build normal: sin nada. El build `demo` reemplaza este archivo por `providers.demo.ts`
 * (fileReplacements en angular.json), así el mock nunca entra al bundle de producción.
 */
export const demoInterceptors: HttpInterceptorFn[] = [];
export const demoProviders: (Provider | EnvironmentProviders)[] = [];
