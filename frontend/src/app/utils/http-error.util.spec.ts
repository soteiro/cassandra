import { HttpErrorResponse } from '@angular/common/http';
import { getErrorMessage } from './http-error.util';

describe('getErrorMessage', () => {
  const httpError = (error: unknown) => new HttpErrorResponse({ error, status: 400 });

  it('should use a plain-text body', () => {
    expect(getErrorMessage(httpError('nombre duplicado'), 'fallback')).toBe('nombre duplicado');
  });

  it('should use body.message, then body.error', () => {
    expect(getErrorMessage(httpError({ message: 'm' }), 'fallback')).toBe('m');
    expect(getErrorMessage(httpError({ error: 'e' }), 'fallback')).toBe('e');
  });

  it.each([
    ['an object without message', { code: 42 }],
    ['an empty string', '   '],
    ['null', null],
    ['a non-string message', { message: { nested: true } }],
  ])('should fall back for %s', (_, body) => {
    expect(getErrorMessage(httpError(body), 'fallback')).toBe('fallback');
  });

  it('should fall back for non-HTTP errors', () => {
    expect(getErrorMessage(undefined, 'fallback')).toBe('fallback');
    expect(getErrorMessage(new Error('x'), 'fallback')).toBe('fallback');
  });
});
