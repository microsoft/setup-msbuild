import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as io from '@actions/io'
import {ExecOptions} from '@actions/exec/lib/interfaces'

const IS_WINDOWS = process.platform === 'win32'
const VS_VERSION = core.getInput('vs-version') || 'latest'
const VSWHERE_PATH = core.getInput('vswhere-path')
const ALLOW_PRERELEASE = core.getInput('vs-prerelease') || 'false'
const MSBUILD_ARCH_INPUT = core.getInput('msbuild-architecture')
let MSBUILD_ARCH = MSBUILD_ARCH_INPUT

// The minimum Visual Studio version for the v4 automatic 64-bit default.
export const MIN_VS_VERSION_FOR_X64 = 17

export function resolveMSBuildArchitecture(
  explicitArch: string,
  hostArch: string,
  vsMajorVersion: number | undefined,
  arm64Available: boolean,
  x64Available: boolean
): string {
  if (explicitArch) {
    return explicitArch
  }

  if (vsMajorVersion === undefined || vsMajorVersion < MIN_VS_VERSION_FOR_X64) {
    return 'x86'
  }

  if (hostArch === 'arm64') {
    if (arm64Available) {
      return 'arm64'
    }
    return x64Available ? 'x64' : 'x86'
  }

  if (hostArch === 'x64' || hostArch === 'amd64') {
    return 'x64'
  }

  return 'x86'
}

// Parses the major version number out of a vswhere `installationVersion` string
// such as "17.9.34728.123". Returns undefined if it cannot be parsed.
export function parseMajorVersion(
  installationVersion: string
): number | undefined {
  const match = installationVersion.trim().match(/^(\d+)/)
  if (!match) {
    return undefined
  }
  const major = parseInt(match[1], 10)
  return isNaN(major) ? undefined : major
}

// if a specific version of VS is requested
let VSWHERE_EXEC =
  '-products * -requires Microsoft.Component.MSBuild -property installationPath -latest '
if (ALLOW_PRERELEASE === 'true') {
  VSWHERE_EXEC += ' -prerelease '
}

if (VS_VERSION !== 'latest') {
  VSWHERE_EXEC += `-version "${VS_VERSION}" `
}

core.debug(`Execution arguments: ${VSWHERE_EXEC}`)

async function run(): Promise<void> {
  try {
    // exit if non Windows runner
    if (IS_WINDOWS === false) {
      core.setFailed('setup-msbuild can only be run on Windows runners')
      return
    }

    // check to see if we are using a specific path for vswhere
    let vswhereToolExe = ''

    if (VSWHERE_PATH) {
      // specified a path for vswhere, use it
      core.debug(`Using given vswhere-path: ${VSWHERE_PATH}`)
      vswhereToolExe = path.join(VSWHERE_PATH, 'vswhere.exe')
    } else {
      // check in PATH to see if it is there
      try {
        const vsWhereInPath: string = await io.which('vswhere', true)
        core.debug(`Found tool in PATH: ${vsWhereInPath}`)
        vswhereToolExe = vsWhereInPath
      } catch {
        // fall back to VS-installed path
        vswhereToolExe = path.join(
          process.env['ProgramFiles(x86)'] as string,
          'Microsoft Visual Studio\\Installer\\vswhere.exe'
        )
        core.debug(`Trying Visual Studio-installed path: ${vswhereToolExe}`)
      }
    }

    if (!fs.existsSync(vswhereToolExe)) {
      core.setFailed(
        'setup-msbuild requires the path to where vswhere.exe exists'
      )

      return
    }

    core.debug(`Full tool exe: ${vswhereToolExe}`)

    let vsMajorVersion: number | undefined
    if (!MSBUILD_ARCH_INPUT) {
      let installationVersion = ''
      const versionOptions: ExecOptions = {}
      versionOptions.listeners = {
        stdout: (data: Buffer) => {
          installationVersion += data.toString()
        }
      }

      const versionExec = VSWHERE_EXEC.replace(
        '-property installationPath',
        '-property installationVersion'
      )
      await exec.exec(`"${vswhereToolExe}" ${versionExec}`, [], versionOptions)
      core.debug(`Found installation version: ${installationVersion.trim()}`)
      vsMajorVersion = parseMajorVersion(installationVersion)
    }

    let installationPath = ''
    const options: ExecOptions = {}
    options.listeners = {
      stdout: (data: Buffer) => {
        installationPath += data.toString()
      }
    }

    await exec.exec(`"${vswhereToolExe}" ${VSWHERE_EXEC}`, [], options)
    installationPath = installationPath.trim()
    core.debug(`Found installation path: ${installationPath}`)
    if (!installationPath) {
      core.setFailed('Unable to find MSBuild.')
      return
    }

    if (!MSBUILD_ARCH_INPUT) {
      // os.arch() describes Node, which can run under emulation on Windows.
      const hostArch = (
        process.env['PROCESSOR_ARCHITEW6432'] ||
        process.env['RUNNER_ARCH'] ||
        os.arch()
      ).toLowerCase()
      const arm64Available =
        hostArch === 'arm64' &&
        fs.existsSync(
          path.join(
            installationPath,
            'MSBuild\\Current\\Bin\\arm64\\MSBuild.exe'
          )
        )
      const x64Available =
        hostArch === 'arm64' &&
        !arm64Available &&
        fs.existsSync(
          path.join(
            installationPath,
            'MSBuild\\Current\\Bin\\amd64\\MSBuild.exe'
          )
        )
      MSBUILD_ARCH = resolveMSBuildArchitecture(
        MSBUILD_ARCH_INPUT,
        hostArch,
        vsMajorVersion,
        arm64Available,
        x64Available
      )
      if (
        hostArch === 'arm64' &&
        vsMajorVersion !== undefined &&
        vsMajorVersion >= MIN_VS_VERSION_FOR_X64 &&
        !arm64Available
      ) {
        core.info(`ARM64 MSBuild not found; using ${MSBUILD_ARCH} instead`)
      }
      core.info(
        `Auto-detected msbuild-architecture: ${MSBUILD_ARCH} (host architecture=${hostArch}, vsMajorVersion=${vsMajorVersion})`
      )
    }

    let foundToolPath = ''
    if (MSBUILD_ARCH === 'x64' || MSBUILD_ARCH === 'arm64') {
      const directory = MSBUILD_ARCH === 'x64' ? 'amd64' : 'arm64'
      const toolPath = path.join(
        installationPath,
        `MSBuild\\Current\\Bin\\${directory}\\MSBuild.exe`
      )
      core.debug(`Checking for path: ${toolPath}`)
      if (fs.existsSync(toolPath)) {
        foundToolPath = toolPath
      }
    } else {
      let toolPath = path.join(
        installationPath,
        'MSBuild\\Current\\Bin\\MSBuild.exe'
      )
      core.debug(`Checking for path: ${toolPath}`)
      if (!fs.existsSync(toolPath)) {
        toolPath = path.join(
          installationPath,
          'MSBuild\\15.0\\Bin\\MSBuild.exe'
        )
        core.debug(`Checking for path: ${toolPath}`)
      }
      if (fs.existsSync(toolPath)) {
        foundToolPath = toolPath
      }
    }

    if (!foundToolPath) {
      core.setFailed('Unable to find MSBuild.')
      return
    }

    core.info(`Found MSBuild tool path: ${foundToolPath}`)
    core.info(`Using MSBuild architecture: ${MSBUILD_ARCH}`)

    // try to get the MSBuild version for diagnostic purposes; a failure here shouldn't fail the action
    try {
      let msbuildVersion = ''
      const versionOptions: ExecOptions = {}
      versionOptions.listeners = {
        stdout: (data: Buffer) => {
          msbuildVersion += data.toString()
        }
      }
      await exec.exec(`"${foundToolPath}" -version -nologo`, [], versionOptions)
      core.info(`Found MSBuild version: ${msbuildVersion.trim()}`)
    } catch (error) {
      core.debug(`Unable to determine MSBuild version: ${error.message}`)
    }

    // extract the folder location for the tool
    const toolFolderPath = path.dirname(foundToolPath)

    // set the outputs for the action to the folder path of msbuild
    core.setOutput('msbuildPath', toolFolderPath)

    // add tool path to PATH
    core.addPath(toolFolderPath)
    core.info(`Tool path added to PATH: ${toolFolderPath}`)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
