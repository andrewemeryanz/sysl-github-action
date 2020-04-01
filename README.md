# Sysl Github Action

This action makes `sysl` available to workflows.

## Usage

To get the latest version of `sysl` just add this step:

```yaml
- name: Install Sysl
  uses: anz-bank/sysl-github-action/sysl@master
```

If you want to pin a major or minor version you can use the `.x` wildcard:

```yaml
- name: Install Sysl
  uses: anz-bank/sysl-github-action/sysl@master
  with:
    version: '1.x'
```

To pin the exact version:

```yaml
- name: Install Sysl
  uses: anz-bank/sysl-github-action/sysl@master
  with:
    version: '0.29.0'
```

## Version matching

The matched version will always return the latest stable version unless no stable versions match, in 
which case the latest pre-release version will be returned.
For example, given the following releases:
```text
1.1.0 - prerelease
1.0.1
1.0.0
``` 

Requesting version `1.x` will return `1.0.1` (the latest stable) whereas requesting `1.1.x` will 
return `1.1.0 - prerelease` (the latest prerelease).

## Development

To work on the codebase you have to install all the dependencies:

```sh
$ npm install
```

To run the tests:

```sh
$ npm run test
```

## Enable verbose logging for a pipeline

Additional log events with the prefix ::debug:: can be 
[enabled](https://github.com/actions/toolkit/blob/master/docs/action-debugging.md#step-debug-logs) 
by setting the secret `ACTIONS_STEP_DEBUG` to `true`.

## Release

We check in the `node_modules` to provide runtime dependencies to the system
using the action, so be careful not to `git add` all the development dependencies
you might have under your local `node_modules`. To release a new version of the
action the workflow should be the following:

1. `npm install` to add all the dependencies, included development.
1. `npm run test` to see everything works as expected.
1. `npm run build` to build the action under the `lib` folder.
1. `rm -rf node_modules` to remove all the dependencies.
1. `npm install --production` to add back **only** the runtime dependencies.
1. `git add lib node_modules` to check in the code that matters.
1. Open a pull request and request a review.
