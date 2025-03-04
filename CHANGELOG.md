# Changelog

* Format inspired by [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
* Project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## [Unreleased]

* Improved Documentation
* Improved Version management
* Replaced StateStore with more secure version
* Added support for finding owner of a renamed GitHub repo
* Fixed usage of `URL` within code
* Added ability to update package metadata on a new version publish
* Added new Featured Packages
* Fixed a bug when updating a package version
* Improved handling of remote GitHub API HTTP Errors
* Improved Log Sanitizing
* Improved ability to retrieve the owner of a package's repo
* Fixed a bug that wouldn't allow a version of a package to be deleted
* Added Swagger Documentation, and in cloud endpoint to access.
* Added ability to limit mocks when running the dev server
* Added support for `theme` slug replacement on `/packages` routes
* Added Options Support for all Endpoints
* Enabled RateLimiting
* Removed StateStore
* New Management of Stargazers on the Database
* Fixed Pagination on Search and other relevant endpoints

## [v1.0.0](https://github.com/pulsar-edit/package-backend/releases/tag/v1.0.0)

* Created all routes to achieve feature parity with Atom.io API Server
* Created all Database interactions to support existing set of routes
* Feature Parity with all Query Parameters used in upstream API Server

> Additional improvements available via Commit Messages and Pull Requests
