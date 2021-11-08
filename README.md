# microsoft/setup-msbuild
This action will help discover where the `MSBuild` tool is and automatically add it to the `PATH` environment variables for you so future steps in your Actions workflow can just initiate `msbuild` commands without knowing the full path.

> Please note this tool does NOT add other Visual Studio tools (like VSTest, cl, cmake, or others) to `PATH`

## Example Usage

```yml
- name: Add msbuild to PATH
  uses: microsoft/setup-msbuild@v1.1

- name: Build app for release
  run: msbuild src\YourProjectFile.csproj -t:rebuild -verbosity:diag -property:Configuration=Release
```

## Optional Parameters
There are a few additional parameters that can be set if you need them. These are optional and should only be set if you know that you need them or what you are doing.

### Specifying specific versions of Visual Studio (optional)
You may have a situation where your Actions runner has multiple versions of Visual Studio and you need to find a specific version of the tool.  Simply add the `vs-version` input to specify the range of versions to find.  If looking for a specific version, specify the minimum and maximum versions as shown in the example below, which will look for just 16.4.

```yml
- name: Add msbuild to PATH
  uses: microsoft/setup-msbuild@v1.1
  with:
    vs-version: '[16.4,16.5)'
```

The syntax is the same used for Visual Studio extensions, where square brackets like "[" mean inclusive, and parenthesis like "(" mean exclusive. A comma is always required, but eliding the minimum version looks for all older versions and eliding the maximum version looks for all newer versions. See the [vswhere wiki](https://github.com/microsoft/vswhere/wiki) for more details.

### Use pre-release versions of Visual Studio (optional)
If you need your Actions runner to target a pre-release version of Visual Studio, simply add the `vs-prerelease` input.  This is necessary if you want to run an action on a virtual environment that contains a pre-release version of Visual Studio or self-hosted images that you may have that also have pre-release versions of Visual Studio installed.

```yml
- name: Add msbuild to PATH
  uses: microsoft/setup-msbuild@v1.1
  with:
    vs-prerelease: true
```

### Specifying MSBuild architecture (optional)
By default the action will use the x86 architecture for MSBuild, but it is possible to target the x64 versions instead. Simply add the `msbuild-architecture` input. Valid input values are `x86` (default) and `x64`.

```yml
- name: Add msbuild to PATH
  uses: microsoft/setup-msbuild@v1.1
  with:
    msbuild-architecture: x64
```

## How does this work?
This makes use of the vswhere tool which is a tool delivered by Microsoft to help in identifying Visual Studio installs and various components.  This tool is installed on the hosted Windows runners for GitHub Actions.  If you are using a self-hosted runner, you either need to make sure vswhere.exe is in your agent's PATH or specify a full path to the location using:

```yml
- name: Add msbuild to PATH
  uses: microsoft/setup-msbuild@v1.1
  with:
    vswhere-path: 'C:\path\to\your\tools\'
```

## Notes on arguments
While the Action enables you to specify a `vswhere` path as well as a `vs-version`, these are more advanced options and when using GitHub-hosted runners you should not need these and is recommended you don't specify them as they are optional.  Using these require you to fully understand the runner environment, updates to the tools on the runner, and can cause failures if you are out of sync.  For GitHub-hosted runners, omitting these arguments is the preferred usage.

## Building this repo
As with most GitHub Actions, this requires NodeJS development tools.  After installing NodeJS, you can build this by executing:

```bash
npm install
npm run build
npm run pack
```

which will modify/create the /dist folder with the final index.js output

# Credits
Thank you to [Warren Buckley](https://github.com/warrenbuckley) for being a core contributor to this Action for the benefit of all developers!

# Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
