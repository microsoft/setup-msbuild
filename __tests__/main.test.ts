import {
  MIN_VS_VERSION_FOR_X64,
  parseMajorVersion,
  resolveMSBuildArchitecture
} from '../src/main'

describe('parseMajorVersion', () => {
  it('parses a standard installationVersion string', () => {
    expect(parseMajorVersion('17.9.34728.123')).toBe(17)
  })

  it('parses a single-segment version', () => {
    expect(parseMajorVersion('16')).toBe(16)
  })

  it('trims whitespace before parsing', () => {
    expect(parseMajorVersion('  17.0.0.0  ')).toBe(17)
  })

  it('returns undefined for an empty string', () => {
    expect(parseMajorVersion('')).toBeUndefined()
  })

  it('returns undefined for a non-numeric string', () => {
    expect(parseMajorVersion('not-a-version')).toBeUndefined()
  })
})

describe('resolveMSBuildArchitecture', () => {
  it('always respects an explicit architecture, regardless of OS/version', () => {
    expect(resolveMSBuildArchitecture('x86', true, 17)).toBe('x86')
    expect(resolveMSBuildArchitecture('x64', false, 15)).toBe('x64')
    expect(resolveMSBuildArchitecture('arm64', true, 17)).toBe('arm64')
  })

  it('defaults to x64 on a 64-bit host with VS/MSBuild 17+', () => {
    expect(resolveMSBuildArchitecture('', true, MIN_VS_VERSION_FOR_X64)).toBe(
      'x64'
    )
    expect(resolveMSBuildArchitecture('', true, 18)).toBe('x64')
  })

  it('defaults to x86 on a 64-bit host with VS/MSBuild older than 17', () => {
    expect(resolveMSBuildArchitecture('', true, 16)).toBe('x86')
  })

  it('defaults to x86 on a non-64-bit host even with VS/MSBuild 17+', () => {
    expect(resolveMSBuildArchitecture('', false, 17)).toBe('x86')
  })

  it('defaults to x86 when the VS/MSBuild version could not be determined', () => {
    expect(resolveMSBuildArchitecture('', true, undefined)).toBe('x86')
  })
})
