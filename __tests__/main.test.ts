import {parseMajorVersion, resolveMSBuildArchitecture} from '../src/main'

jest.mock('@actions/core', () => ({
  getInput: jest.fn().mockReturnValue(''),
  debug: jest.fn(),
  setFailed: jest.fn()
}))

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
    expect(resolveMSBuildArchitecture('x86', 'arm64', 17, true, true)).toBe(
      'x86'
    )
    expect(resolveMSBuildArchitecture('x64', 'ia32', 15, false, false)).toBe(
      'x64'
    )
    expect(resolveMSBuildArchitecture('arm64', 'x64', 16, false, false)).toBe(
      'arm64'
    )
  })

  it('defaults to x64 on an x64 host with VS 17 or later', () => {
    expect(resolveMSBuildArchitecture('', 'x64', 17, false, false)).toBe('x64')
    expect(resolveMSBuildArchitecture('', 'amd64', 18, false, false)).toBe(
      'x64'
    )
  })

  it('prefers native ARM64 when it is available', () => {
    expect(resolveMSBuildArchitecture('', 'arm64', 17, true, true)).toBe(
      'arm64'
    )
  })

  it('falls back to x64 and then x86 when ARM64 MSBuild is unavailable', () => {
    expect(resolveMSBuildArchitecture('', 'arm64', 17, false, true)).toBe('x64')
    expect(resolveMSBuildArchitecture('', 'arm64', 17, false, false)).toBe(
      'x86'
    )
  })

  it('defaults to x86 for older versions and 32-bit hosts', () => {
    expect(resolveMSBuildArchitecture('', 'arm64', 16, true, true)).toBe('x86')
    expect(resolveMSBuildArchitecture('', 'x64', 16, false, false)).toBe('x86')
    expect(resolveMSBuildArchitecture('', 'ia32', 17, false, false)).toBe('x86')
  })

  it('defaults to x86 when the VS/MSBuild version could not be determined', () => {
    expect(resolveMSBuildArchitecture('', 'arm64', undefined, true, true)).toBe(
      'x86'
    )
  })
})
