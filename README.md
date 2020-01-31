# microsoft/setup-msbuild
You know how handy that 'Visual Studio Developer Command Prompt' is on your local machine?  And how it adds several things to `PATH` to allow you to just issue commands like `msbuild` or otherwise?  Use this action to setup similar flexibility in your Windows-based GitHub Actions runners.  This will let you discover where those tool paths are and automatically add them to the `PATH` environment variables for you so future steps in your Actions workflow can just initiate commands without knowing the full path.

## Usage

```
- name: Add msbuild to PATH
  uses: microsoft/setup-msbuild@v1.0.0
```

## Specifying specific versions of Visual Studio
You may have a situation where your Actions runner has multiple versions of Visual Studio and you need to find a specific version of the tool.  Simply add the `vs-version` input to specify the range of versions to find.  If looking for a specific version, enter that version number twice as a range.

```
- name: Add msbuild to PATH
  uses: microsoft/setup-msbuild@v1.0.0
    with:
      vs-version: [16.4,16.5]
```

## How does this work?
This makes use of the vswhere tool which is a tool is delivered by Microsoft to help in identifying Visual Studio installs and various components.  This tool is installed on the hosted Windows runners for GitHub Actions.  If you are using a self-hosted runner, you either need to make sure vswhere.exe is in your agent's PATH or specify a full path to the location using:

```
- name: Add msbuild to PATH
  uses: microsoft/setup-msbuild@v1.0.0
    with:
      vswhere-path: 'C:\path\to\your\tools\'
```

## Building this repo
As with most GitHub Actions, this requires NodeJS development tools.  After installing NodeJS, you can build this by executing:

```
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
