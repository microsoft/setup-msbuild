import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as fs from 'fs'
import * as path from 'path'
import * as io from '@actions/io'
import * as vsVer from './vs-ver'
import {ExecOptions} from '@actions/exec/lib/interfaces'

const IS_WINDOWS = process.platform === 'win32'
const VS_VERSION = core.getInput('vs-version') || 'latest'
const VSWHERE_PATH = core.getInput('vswhere-path')
const ALLOW_PRERELEASE = core.getInput('vs-prerelease') || 'false'
let MSBUILD_ARCH = core.getInput('msbuild-architecture') || 'x86'

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

async function checkVersionInPath(): Promise<boolean> {
  const tool = await io.which('msbuild', false)
  const execOutput = await exec.getExecOutput(`"${tool}"`, ['--ver'], {
    silent: true
  })

  // Exit if path is wrong or version does not match regex
  if (execOutput.exitCode !== 0) {
    return false
  }
  const versionMatch = execOutput.stdout.match(/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/)
  const versionString = versionMatch ? versionMatch[0] : ''
  if (!versionString) {
    return false
  }

  // If "latest" every found version goes
  if (VS_VERSION === 'latest') {
    return true
  }

  // Prepare arrays for tool version and min-max versions
  const splitVersion = versionString.split('.')
  const version: [number, number, number, number] = [
    parseInt(splitVersion[0]),
    parseInt(splitVersion[1]),
    parseInt(splitVersion[2]),
    parseInt(splitVersion[3])
  ]
  const constraints = VS_VERSION.split(',')
  const minInclusive = !constraints[0].startsWith('(')
  const maxInclusive =
    constraints.length === 2 ? constraints[1].endsWith(']') : false
  const minVersionString = (
    constraints[0].replace('[', '').replace('(', '') || '0.0'
  ).split('.')
  while (minVersionString.length !== 4) {
    minVersionString.push('0')
  }
  const minVersion: [number, number, number, number] = [
    parseInt(minVersionString[0]),
    parseInt(minVersionString[1]),
    parseInt(minVersionString[2]),
    parseInt(minVersionString[3])
  ]
  const maxVersionString = (
    (constraints[1] ? constraints[1].replace(')', '').replace(']', '') : '') ||
    '65535.65535.65535.65535'
  ).split('.')
  while (maxVersionString.length !== 4) {
    maxVersionString.push('0')
  }
  const maxVersion: [number, number, number, number] = [
    parseInt(maxVersionString[0]),
    parseInt(maxVersionString[1]),
    parseInt(maxVersionString[2]),
    parseInt(maxVersionString[3])
  ]

  // Check version
  if (minInclusive) {
    if (vsVer.lt(version, minVersion)) {
      return false
    }
  } else {
    if (vsVer.lte(version, minVersion)) {
      return false
    }
  }
  if (maxInclusive) {
    if (vsVer.gt(version, maxVersion)) {
      return false
    }
  } else {
    if (vsVer.gte(version, maxVersion)) {
      return false
    }
  }
  return true
}

async function run(): Promise<void> {
  try {
    // exit if non Windows runner and msbuild not already in PATH
    if (IS_WINDOWS === false) {
      if (await checkVersionInPath()) {
        core.info('Correct msbuild version is already in PATH')
        return
      }
      core.setFailed('setup-msbuild can only run vswhere on Windows runners')
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
          const toolPath = path.join(
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

    // extract the folder location for the tool
    const toolFolderPath = path.dirname(foundToolPath)

    // set the outputs for the action to the folder path of msbuild
    core.setOutput('msbuildPath', toolFolderPath)

    // add tool path to PATH
    core.addPath(toolFolderPath)
    core.debug(`Tool path added to PATH: ${toolFolderPath}`)
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('Unknown error')
    }
  }
}

run()
