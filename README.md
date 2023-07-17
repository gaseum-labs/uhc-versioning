# UHC Versioning Action

This action manages automatic versioning and releases for the UHC Plugin

## Inputs

### `version_type`

One of either `major`, `minor`, or `patch`. Each corresponds to one of the three numbers in a semantic version. On a push to a branch with this action, this is the number that will be bumped up in the new release.

Example: `minor`

### `upload_file`

A path to the built asset that will be uploaded in the new release.

Example: `build/jars/uhc-plugin.jar`

### `base_version`

At the very beginning when there have been no releases yet, releases will start on this version number.

Example: `v1.0.0`
