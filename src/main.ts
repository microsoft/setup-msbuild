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

// The minimum Visual Studio/MSBuild major version that ships a native x64 MSBuild.exe
export const MIN_VS_VERSION_FOR_X64 = 17

// Determines the effective MSBuild architecture to use.
// If the user explicitly specified `msbuild-architecture`, that choice is always respected.
// Otherwise (breaking change as of v4), the action auto-detects and prefers x64 when
// running on a 64-bit OS and the resolved VS/MSBuild installation is version 17.0 or later.
// If the VS version can't be determined, or the host isn't 64-bit, it falls back to x86.
export function resolveMSBuildArchitecture(
  explicitArch: string,
  isWindows64Bit: boolean,
  vsMajorVersion: number | undefined
): string {
  if (explicitArch) {
    return explicitArch
  }

  if (
    isWindows64Bit &&
    vsMajorVersion !== undefined &&
    vsMajorVersion >= MIN_VS_VERSION_FOR_X64
  ) {
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

    // if the user did not explicitly specify an architecture, auto-detect the
    // preferred architecture based on the host OS and the resolved VS/MSBuild version
    if (!MSBUILD_ARCH_INPUT) {
      let vsMajorVersion: number | undefined
      const versionOptions: ExecOptions = {}
      versionOptions.listeners = {
        stdout: (data: Buffer) => {
          const installationVersion = data.toString().trim()
          core.debug(`Found installation version: ${installationVersion}`)
          const parsed = parseMajorVersion(installationVersion)
          if (parsed !== undefined) {
            vsMajorVersion = parsed
          }
        }
      }

      const versionExec = VSWHERE_EXEC.replace(
        '-property installationPath',
        '-property installationVersion'
      )
      await exec.exec(`"${vswhereToolExe}" ${versionExec}`, [], versionOptions)

      const isWindows64Bit = os.arch() === 'x64' || os.arch() === 'arm64'
      MSBUILD_ARCH = resolveMSBuildArchitecture(
        MSBUILD_ARCH_INPUT,
        isWindows64Bit,
        vsMajorVersion
      )
      core.info(
        `Auto-detected msbuild-architecture: ${MSBUILD_ARCH} (os.arch=${os.arch()}, vsMajorVersion=${vsMajorVersion})`
      )
    }

    let foundToolPath = ''
    const options: ExecOptions = {}
    options.listeners = {
      stdout: (data: Buffer) => {
        const installationPath = data.toString().trim()
        core.debug(`Found installation path: ${installationPath}`)

        // x64 and arm64 only exist in one possible location, so no fallback probing
        if (MSBUILD_ARCH === 'x64' || MSBUILD_ARCH === 'arm64') {
          // x64 is actually amd64 so change to that
          if (MSBUILD_ARCH === 'x64') {
            MSBUILD_ARCH = 'amd64'
          }
          let toolPath = path.join(
            installationPath,
            `MSBuild\\Current\\Bin\\${MSBUILD_ARCH}\\MSBuild.exe`
          )
          core.debug(`Checking for path: ${toolPath}`)
          if (!fs.existsSync(toolPath)) {
            return
          }
          foundToolPath = toolPath
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
            if (!fs.existsSync(toolPath)) {
              return
            }
          }

          foundToolPath = toolPath
        }
      }
    }

    // execute the find putting the result of the command in the options foundToolPath
    await exec.exec(`"${vswhereToolExe}" ${VSWHERE_EXEC}`, [], options)

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
