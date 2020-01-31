import * as core from '@actions/core'
import * as toolCache from '@actions/tool-cache'
import * as exec from '@actions/exec'
import * as path from 'path'
import {ExecOptions} from '@actions/exec/lib/interfaces'

const IS_WINDOWS = process.platform === 'win32'
const VS_VERSION = core.getInput('vs-version') || 'latest'
const VSWHERE_PATH = core.getInput('vswhere-path') || ''
const VSWHERE_VERSION = '2.8.4'

// if a specific version of VS is requested
let VSWHERE_EXEC = ''
if (VS_VERSION === 'latest') {
  VSWHERE_EXEC += '-latest '
} else {
  VSWHERE_EXEC += `-version ${VS_VERSION} `
}
VSWHERE_EXEC +=
  '-requires Microsoft.Component.MSBuild -find MSBuild\\**\\Bin\\MSBuild.exe'

core.debug(`Execution path: ${VSWHERE_EXEC}`)

async function run(): Promise<void> {
  try {
    // exit if non Windows runner
    if (IS_WINDOWS === false) {
      core.setFailed('setup-msbuild can only be run on Windows runners')
      return
    }

    // check to see if we are using a specific path for vswhere
    let vswhereToolExe = ''
    let cachedToolDirectory = ''

    if (VSWHERE_PATH) {
      // specified a path for vswhere, use it and cache the location
      vswhereToolExe = path.join(VSWHERE_PATH, 'vswhere.exe')
      cachedToolDirectory = await toolCache.cacheDir(
        VSWHERE_PATH,
        'vswhere',
        VSWHERE_VERSION
      )
    } else {
      // using the tool on the runner
      // check and see if we have a cache for the specified tool version
      // eslint-disable-next-line @typescript-eslint/await-thenable
      cachedToolDirectory = await toolCache.find('vswhere', VSWHERE_VERSION)

      // TODO: Remove this when runner has proper tool
      if (cachedToolDirectory) {
        core.debug(`Found cached version of vswhere-${VSWHERE_VERSION}`)
      } else {
        cachedToolDirectory = await installTool()
      }
    }

    // add cache dir to PATH
    core.addPath(cachedToolDirectory)

    vswhereToolExe = path.join(cachedToolDirectory, 'vswhere.exe')
    core.debug(`Full cached tool exe: ${vswhereToolExe}`)

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
    await exec.exec(`${vswhereToolExe} ${VSWHERE_EXEC}`, [], options)

    if (!foundToolPath) {
      core.setFailed('Unable to find msbuild.')
      return
    }

    // extract the folder location for the tool
    const toolFolderPath = path.dirname(foundToolPath)
    core.debug(`Tool Path: ${toolFolderPath}`)

    // set the outputs for the action to the folder path of msbuild
    core.setOutput('msbuildPath', toolFolderPath)

    // add tool path to PATH
    core.addPath(toolFolderPath)
  } catch (error) {
    core.setFailed(error.message)
  }
}

async function installTool(): Promise<string> {
  // cached tool was not found, retrieve it
  core.debug(`Downloading vswhere-${VSWHERE_VERSION}`)

  // using choco install we get proper tool and it automatically puts in the PATH
  await exec.exec(
    `choco install vswhere -y --no-progress -force -v --version=${VSWHERE_VERSION}`
  )

  // add the tool to the cache
  const newCachedToolDirectory = await toolCache.cacheDir(
    'C:\\ProgramData\\chocolatey\\lib\\vswhere\\tools',
    'vswhere',
    VSWHERE_VERSION
  )

  core.debug(`New cached tool directory=${newCachedToolDirectory}`)

  return newCachedToolDirectory
}

run()
