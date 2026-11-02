import { isNewerVersion, parseVersion } from './version.util';

describe('parseVersion', () => {
  it.each([
    ['v1.2.3', [1, 2, 3]],
    ['1.2.3', [1, 2, 3]],
    [' 0.10.0 ', [0, 10, 0]],
    ['0.0.0-dev', [0, 0, 0]],
  ])('should parse %j', (input, expected) => {
    expect(parseVersion(input)).toEqual(expected);
  });

  it.each(['', '1.2', 'latest', null, undefined])('should reject %j', (input) => {
    expect(parseVersion(input)).toBeNull();
  });
});

describe('isNewerVersion', () => {
  it.each([
    ['v0.2.2', '0.2.1', true],
    ['v0.3.0', '0.2.9', true],
    ['v1.0.0', '0.99.99', true],
    ['v0.10.0', '0.9.0', true], // numérico, no lexicográfico
    ['v0.2.1', '0.2.1', false],
    ['v0.2.0', '0.2.1', false],
    ['v0.2.1', '0.0.0-dev', true],
    ['basura', '0.2.1', false],
    ['v0.2.1', 'basura', false],
  ])('isNewerVersion(%j, %j) should be %s', (candidate, current, expected) => {
    expect(isNewerVersion(candidate, current)).toBe(expected);
  });
});
