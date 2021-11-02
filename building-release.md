# Building a release
This is a quick document to walk through the process of building and releasing.

## Building the version
- Create a new branch [vMajor.Minor.Revision] for the version from `dev`
- Make changes in the new branch
- Build the branch/package
    - `npm install`
    - `npm run build`
    - `npm run pack`
- Prune the dependencies to only production
    - `npm prune --production`
- Uncomment `node_modules` in `.gitignore` **for this branch only**
- Commit the changes to the branch
- Push the new version branch
    - `git push origin [vMajor.Minor.Revision]`

## Releasing the new version
- Draft a new release to [vMajor.Minor.Revision]

## Update major version tag
If the update is non-breaking and the major version binding you can update the version tag to make the new release available to those binding to the major version tag ([GitHub Actions Versioning](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md)).

Do this from the version branch after push (using a v1 tag as example only here)

```
git tag -fa v1 -m "Update v1 tag"
git push origin v1 --force
```