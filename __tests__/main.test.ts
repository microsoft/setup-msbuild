import {parseMajorVersion, getMSBuildArchitectures} from '../src/main'

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

describe('getMSBuildArchitectures', () => {
  it('always respects an explicit architecture, regardless of OS/version', () => {
    expect(getMSBuildArchitectures('x86', 'arm64', 17)).toEqual(['x86'])
    expect(getMSBuildArchitectures('x64', 'ia32', 15)).toEqual(['x64'])
    expect(getMSBuildArchitectures('arm64', 'x64', 16)).toEqual(['arm64'])
  })

  it('defaults to x64 on an x64 host with VS 17 or later', () => {
    expect(getMSBuildArchitectures('', 'x64', 17)).toEqual(['x64'])
    expect(getMSBuildArchitectures('', 'amd64', 18)).toEqual(['x64'])
  })

  it('orders ARM64 candidates from native to emulated architectures', () => {
    expect(getMSBuildArchitectures('', 'arm64', 17)).toEqual([
      'arm64',
      'x64',
      'x86'
    ])
  })

  it('defaults to x86 for older versions and 32-bit hosts', () => {
    expect(getMSBuildArchitectures('', 'arm64', 16)).toEqual(['x86'])
    expect(getMSBuildArchitectures('', 'x64', 16)).toEqual(['x86'])
    expect(getMSBuildArchitectures('', 'ia32', 17)).toEqual(['x86'])
  })

  it('defaults to x86 when the VS/MSBuild version could not be determined', () => {
    expect(getMSBuildArchitectures('', 'arm64', undefined)).toEqual(['x86'])
  })
})
