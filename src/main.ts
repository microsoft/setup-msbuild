import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as fs from 'fs'
import * as path from 'path'
import * as io from '@actions/io'
import {ExecOptions} from '@actions/exec/lib/interfaces'

const IS_WINDOWS = process.platform === 'win32'
const VS_VERSION = core.getInput('vs-version') || 'latest'
const VSWHERE_PATH = core.getInput('vswhere-path')
const ALLOW_PRERELEASE = core.getInput('vs-prerelease') || 'false'
const MSBUILD_ARCH = core.getInput('msbuild-architecture') || 'x86'

// if a specific version of VS is requested
let VSWHERE_EXEC = '-products * -requires Microsoft.Component.MSBuild -property installationPath -latest '
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

    let foundToolPath = ''
    const options: ExecOptions = {}
    options.listeners = {
      stdout: (data: Buffer) => {
        const installationPath = data.toString().trim()
        core.debug(`Found installation path: ${installationPath}`)

        // x64 only exists in one possible location, so no fallback probing
        if (MSBUILD_ARCH === "x64") {
          let toolPath = path.join(
            installationPath,
            'MSBuild\\Current\\Bin\\amd64\\MSBuild.exe'
          );
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
    core.setFailed(error.message)
  }
}

run()
