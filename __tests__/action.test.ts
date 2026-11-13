import * as path from 'path'
import {ExecOptions} from '@actions/exec/lib/interfaces'

const installationPath = 'visual-studio'
const arm64Path = path.join(
  installationPath,
  'MSBuild\\Current\\Bin\\arm64\\MSBuild.exe'
)
const x64Path = path.join(
  installationPath,
  'MSBuild\\Current\\Bin\\amd64\\MSBuild.exe'
)
const x86Path = path.join(
  installationPath,
  'MSBuild\\Current\\Bin\\MSBuild.exe'
)

async function runAction(
  files: string[],
  explicitArch = '',
  version = '17.4.0.0',
  nativeArchOverride = ''
): Promise<{
  addedPath: jest.Mock
  failed: jest.Mock
  exec: jest.Mock
}> {
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')
  const runnerArch = process.env['RUNNER_ARCH']
  const nativeArch = process.env['PROCESSOR_ARCHITEW6432']
  let finish: () => void = () => {}
  const finished = new Promise<void>(resolve => {
    finish = resolve
  })
  const addedPath = jest.fn(() => finish())
  const failed = jest.fn(() => finish())
  const exec = jest.fn(
    async (command: string, _args: string[], options: ExecOptions) => {
      const stdout = options.listeners && options.listeners.stdout
      if (!stdout) {
        throw new Error('Missing stdout listener')
      }
      if (command.includes('installationVersion')) {
        stdout(Buffer.from(version.slice(0, 3)))
        stdout(Buffer.from(`${version.slice(3)}\n`))
      } else if (command.includes('installationPath')) {
        stdout(Buffer.from('visual-'))
        stdout(Buffer.from('studio\n'))
      } else {
        stdout(Buffer.from('17.4.0\n'))
      }
      return 0
    }
  )

  try {
    Object.defineProperty(process, 'platform', {value: 'win32'})
    process.env['RUNNER_ARCH'] = nativeArchOverride ? 'X86' : 'ARM64'
    if (nativeArchOverride) {
      process.env['PROCESSOR_ARCHITEW6432'] = nativeArchOverride
    } else {
      delete process.env['PROCESSOR_ARCHITEW6432']
    }
    jest.resetModules()
    jest.doMock('@actions/core', () => ({
      getInput: (name: string) =>
        name === 'msbuild-architecture' ? explicitArch : '',
      debug: jest.fn(),
      info: jest.fn(),
      setFailed: failed,
      setOutput: jest.fn(),
      addPath: addedPath
    }))
    jest.doMock('@actions/exec', () => ({exec}))
    jest.doMock('@actions/io', () => ({
      which: jest.fn().mockResolvedValue('vswhere.exe')
    }))
    jest.doMock('os', () => ({arch: () => 'x64'}))
    jest.doMock('fs', () => ({
      existsSync: (file: string) =>
        file === 'vswhere.exe' || files.includes(file)
    }))

    require('../src/main')
    await finished
    return {addedPath, failed, exec}
  } finally {
    if (platform) {
      Object.defineProperty(process, 'platform', platform)
    }
    if (runnerArch === undefined) {
      delete process.env['RUNNER_ARCH']
    } else {
      process.env['RUNNER_ARCH'] = runnerArch
    }
    if (nativeArch === undefined) {
      delete process.env['PROCESSOR_ARCHITEW6432']
    } else {
      process.env['PROCESSOR_ARCHITEW6432'] = nativeArch
    }
    jest.resetModules()
  }
}

describe('ARM64 action selection', () => {
  it('uses native ARM64 even when Node runs as x64', async () => {
    const result = await runAction([arm64Path, x64Path, x86Path])

    expect(result.failed).not.toHaveBeenCalled()
    expect(result.addedPath).toHaveBeenCalledWith(path.dirname(arm64Path))
    expect(result.exec).toHaveBeenCalledWith(
      `"${arm64Path}" -version -nologo`,
      [],
      expect.anything()
    )
  })

  it('uses the native Windows architecture when a 32-bit runner is emulated', async () => {
    const result = await runAction(
      [arm64Path, x86Path],
      '',
      '17.4.0.0',
      'ARM64'
    )

    expect(result.failed).not.toHaveBeenCalled()
    expect(result.addedPath).toHaveBeenCalledWith(path.dirname(arm64Path))
    expect(result.exec).toHaveBeenCalledWith(
      `"${arm64Path}" -version -nologo`,
      [],
      expect.anything()
    )
  })

  it('falls back to the installed x64 MSBuild', async () => {
    const result = await runAction([x64Path, x86Path])

    expect(result.failed).not.toHaveBeenCalled()
    expect(result.addedPath).toHaveBeenCalledWith(path.dirname(x64Path))
    expect(result.exec).toHaveBeenCalledWith(
      `"${x64Path}" -version -nologo`,
      [],
      expect.anything()
    )
  })

  it('falls back to x86 when neither 64-bit executable is installed', async () => {
    const result = await runAction([x86Path])

    expect(result.failed).not.toHaveBeenCalled()
    expect(result.addedPath).toHaveBeenCalledWith(path.dirname(x86Path))
    expect(result.exec).toHaveBeenCalledWith(
      `"${x86Path}" -version -nologo`,
      [],
      expect.anything()
    )
  })

  it('uses x86 for Visual Studio versions older than 17', async () => {
    const result = await runAction([arm64Path, x86Path], '', '16.11.0.0')

    expect(result.failed).not.toHaveBeenCalled()
    expect(result.addedPath).toHaveBeenCalledWith(path.dirname(x86Path))
    expect(result.exec).toHaveBeenCalledWith(
      `"${x86Path}" -version -nologo`,
      [],
      expect.anything()
    )
  })

  it('respects explicit x86 without querying the version', async () => {
    const result = await runAction([arm64Path, x86Path], 'x86')

    expect(result.failed).not.toHaveBeenCalled()
    expect(result.addedPath).toHaveBeenCalledWith(path.dirname(x86Path))
    expect(result.exec).toHaveBeenCalledWith(
      `"${x86Path}" -version -nologo`,
      [],
      expect.anything()
    )
    expect(
      result.exec.mock.calls.some(call =>
        call[0].includes('installationVersion')
      )
    ).toBe(false)
  })

  it('does not fall back when an explicit ARM64 executable is missing', async () => {
    const result = await runAction([x64Path, x86Path], 'arm64')

    expect(result.addedPath).not.toHaveBeenCalled()
    expect(result.failed).toHaveBeenCalledWith('Unable to find MSBuild.')
  })
})
