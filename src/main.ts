import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as path from 'path'
import * as io from '@actions/io'
import {ExecOptions} from '@actions/exec/lib/interfaces'

const IS_WINDOWS = process.platform === 'win32'
const VS_VERSION = core.getInput('vs-version') || 'latest'
const VSWHERE_PATH =
  core.getInput('vswhere-path') ||
  path.join(
    process.env['ProgramFiles(x86)'] as string,
    'Microsoft Visual Studio\\Installer'
  )

// if a specific version of VS is requested
let VSWHERE_EXEC = '-latest '
if (VS_VERSION !== 'latest') {
  VSWHERE_EXEC += `-version ${VS_VERSION} `
}
VSWHERE_EXEC +=
  '-requires Microsoft.Component.MSBuild -find MSBuild\\**\\Bin\\MSBuild.exe'

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
      vswhereToolExe = path.join(VSWHERE_PATH, 'vswhere.exe')
    } else {
      // check in PATH to see if it is there
      try {
        const vsWhereInPath: string = await io.which('vswhere', true)
        core.debug(`Found tool in PATH: ${vsWhereInPath}`)
        vswhereToolExe = path.join(vsWhereInPath, 'vswhere.exe')
      } catch {
        // wasn't found because which threw
      } finally {
        core.setFailed(
          'setup-msbuild requires the path to where vswhere.exe exists'
        )
      }
    }

    core.debug(`Full tool exe: ${vswhereToolExe}`)

    let foundToolPath = ''
    const options: ExecOptions = {}
    options.listeners = {
      stdout: (data: Buffer) => {
        // eslint-disable-next-line prefer-const
        let output = data.toString()
        foundToolPath += output
      }
    }

    // execute the find putting the result of the command in the options foundToolPath
    await exec.exec(`"${vswhereToolExe}" ${VSWHERE_EXEC}`, [], options)

    if (!foundToolPath) {
      core.setFailed('Unable to find msbuild.')
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
