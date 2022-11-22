/**
 * @module package_handler
 * @desc Endpoint Handlers in all relating to the packages themselves.
 * @implements {common_handler}
 * @implements {users}
 * @implements {data}
 * @implements {query}
 * @implements {git}
 * @implements {logger}
 * @implements {error}
 * @implements {config}
 */

const common = require("./common_handler.js");
const query = require("../query.js");
const git = require("../git.js");
const logger = require("../logger.js");
const { server_url } = require("../config.js").getConfig();
const utils = require("../utils.js");
const database = require("../database.js");
const auth = require("../auth.js");

/**
 * @async
 * @function getPackages
 * @desc Endpoint to return all packages to the user. Based on any filtering
 * theyved applied via query parameters.
 * @param {object} req - The `Request` object inherited from the Express endpoint.
 * @param {object} res - The `Response` object inherited from the Express endpoint.
 * @property {http_method} - GET
 * @property {http_endpoint} - /api/packages
 */
async function getPackages(req, res) {
  let params = {
    page: query.page(req),
    sort: query.sort(req),
    direction: query.dir(req),
  };

  let packages = await database.getSortedPackages(
    params.page,
    params.direction,
    params.sort
  );

  if (!packages.ok) {
    await common.handleError(req, res, packages, 1001);
    return;
  }

  packages = await utils.constructPackageObjectShort(packages.content);

  let totalPages = await database.getTotalPackageEstimate();

  if (!totalPages.ok) {
    await common.handleError(req, res, totalPages, 1002);
    return;
  }

  res.append(
    "Link",
    `<${server_url}/api/packages?page=${params.page}&sort=${
      params.sort
    }&order=${
      params.direction
    }>; rel="self", <${server_url}/api/packages?page=${totalPages}&sort=${
      params.sort
    }&order=${
      params.direction
    }>; rel="last", <${server_url}/api/packages?page=${params.page++}&sort=${
      params.sort
    }&order=${params.direction}>; rel="next"`
  );

  res.status(200).json(packages);
  logger.httpLog(req, res);
}

/**
 * @async
 * @function postPackages
 * @desc This endpoint is used to publish a new package to the backend server.
 * Taking the repo, and your authentication for it, determines if it can be published,
 * then goes about doing so.
 * @param {object} req - The `Request` object inherited from the Express endpoint.
 * @param {object} res - The `Response` object inherited from the Express endpoint.
 * @return {string} JSON object of new data pushed into the database, but stripped of
 * sensitive informations like primary and foreign keys.
 * @property {http_method} - POST
 * @property {http_endpoint} - /api/packages
 */
async function postPackages(req, res) {
  let params = {
    repository: query.repo(req),
    auth: query.auth(req),
  };

  let user = await auth.verifyAuth(params.auth);

  // Check authentication.
  if (!user.ok) {
    await common.handleError(req, res, user);
    return;
  }

  // Check repository format validity.
  if (params.repository === "") {
    // The repository format is invalid.
    await common.badRepoJSON(req, res);
    return;
  }

  // Check the package does NOT exists.
  // We will utilize our database.getPackageByName to see if it returns an error,
  // which means the package doesn't exist.
  // Currently though the repository is in `owner/repo` format,
  // meanwhile getPackageByName expects just `repo`

  const repo = params.repository.split("/")[1];

  if (repo === undefined) {
    // The repository format is invalid.
    await common.badRepoJSON(req, res);
    return;
  }

  const exists = await database.getPackageByName(repo);

  if (exists.ok) {
    // The package exists.
    await common.packageExists(req, res);
    return;
  }

  // Even further though we need to check that the error is not found, since errors here can bubble.
  if (exists.short !== "Not Found") {
    // The server failed for some other bubbled reason, and is now encountering an error.
    await common.handleError(req, res, exists);
    return;
  }

  // Now we know the package doesn't exist. And we want to check that the user owns this repo on git.
  const gitowner = await git.ownership(user.content, params.repository);

  if (!gitowner.ok) {
    await common.handleError(req, res, gitowner);
    return;
  }

  // Now knowing they own the git repo, and it doesn't exist here, lets publish.
  let newPack = await git.createPackage(params.repository, user.content);

  if (!newPack.ok) {
    await common.handleError(req, res, newPack);
    return;
  }

  // Now with valid package data, we can insert them into the DB.
  let insertedNewPack = await database.insertNewPackage(newPack.content);

  if (!insertedNewPack.ok) {
    await common.handleError(req, res, insertedNewPack);
    return;
  }

  // Finally we can return what was actually put into the database.
  // Retrieve the data from database.getPackageByName() and
  // convert it into Package Object Full format.
  let newDbPack = await database.getPackageByName(repo, true);

  if (newDbPack.ok) {
    const packageObjectFull = await utils.constructPackageObjectFull(
      newDbPack.content
    );
    res.status(201).json(packageObjectFull);
  } else {
    common.serverError(req, res, "Cannot retrieve new package from DB");
  }
}

/**
 * @async
 * @function getPackagesFeatured
 * @desc Allows the user to retreive the featured packages, as package object shorts.
 * This endpoint was originally undocumented. The decision to return 200 is based off similar endpoints.
 * Additionally for the time being this list is created manually, the same method used
 * on Atom.io for now. Although there are plans to have this become automatic later on.
 * @see {@link https://github.com/atom/apm/blob/master/src/featured.coffee|Source Code}
 * @see {@link https://github.com/confused-Techie/atom-community-server-backend-JS/issues/23|Discussion}
 * @param {object} req - The `Request` object inherited from the Express endpoint.
 * @param {object} res - The `Response` object inherited from the Express endpoint.
 * @property {http_method} - GET
 * @property {http_endpoint} - /api/packages/featured
 */
async function getPackagesFeatured(req, res) {
  // Returns Package Object Short array.
  // Supports engine query parameter.
  let col = await database.getFeaturedPackages();

  if (!col.ok) {
    await common.handleError(req, res, col, 1003);
    return;
  }

  let newCol = await utils.constructPackageObjectShort(col.content);

  res.status(200).json(newCol);
  logger.httpLog(req, res);
}

/**
 * @async
 * @function getPackagesSearch
 * @desc Allows user to search through all packages. Using their specified
 * query parameter.
 * @param {object} req - The `Request` object inherited from the Express endpoint.
 * @param {object} res - The `Response` object inherited from the Express endpoint.
 * @property {http_method} - GET
 * @property {http_endpoint} - /api/packages/search
 * @todo Note: This **has** been migrated to the new DB, and is fully functional.
 * The TODO here is to eventually move this to use the custom built in LCS search,
 * rather than simple search.
 */
async function getPackagesSearch(req, res) {
  let params = {
    sort: query.sort(req, "relevance"),
    page: query.page(req),
    direction: query.dir(req),
    query: query.query(req),
  };

  // Because the task of implementing the custom search engine is taking longer
  // than expected, this will instead use super basic text searching on the DB
  // side. This is only an effort to get this working quickly and should be changed later.
  // This also means for now, the default sorting method will be downloads, not relevance.

  let packs = await database.simpleSearch(
    params.query,
    params.page,
    params.direction,
    params.sort
  );

  if (!packs.ok) {
    if (packs.short == "Not Found") {
      // Because getting not found from the search, means the users
      // search just had no matches, we will specially handle this to return
      // an empty array instead.
      res.status(200).json([]);
      logger.httpLog(req, res);
      return;
    }

    await common.handleError(req, res, packs, 1007);
    return;
  }

  let newPacks = await utils.constructPackageObjectShort(packs.content);

  if (Object.keys(newPacks).length < 1) {
    newPacks = [];
    // This also helps protect against misreturned searches. As in getting a 404 rather
    // than empty search results.
    // See: https://github.com/confused-Techie/atom-backend/issues/59
  }

  let totalPageEstimate = await database.getTotalPackageEstimate();

  let totalPages = !totalPageEstimate.ok ? 1 : totalPageEstimate.content;

  // now to get headers.
  res.append(
    "Link",
    `<${server_url}/api/packages/search?q=${params.query}&page=${
      params.page
    }&sort=${params.sort}&order=${
      params.direction
    }>; rel="self", <${server_url}/api/packages?q=${
      params.query
    }&page=${totalPages}&sort=${params.sort}&order=${
      params.direction
    }>; rel="last", <${server_url}/api/packages/search?q=${params.query}&page=${
      params.page + 1
    }&sort=${params.sort}&order=${params.direction}>; rel="next"`
  );

  res.status(200).json(newPacks);
  logger.httpLog(req, res);
}

/**
 * @async
 * @function getPackagesDetails
 * @desc Allows the user to request a single package object full, depending
 * on the package included in the path parameter.
 * @param {object} req - The `Request` object inherited from the Express endpoint.
 * @param {object} res - The `Response` object inherited from the Express endpoint.
 * @property {http_method} - GET
 * @property {http_endpoint} - /api/packages/:packageName
 */
async function getPackagesDetails(req, res) {
  let params = {
    engine: query.engine(req),
    name: decodeURIComponent(req.params.packageName),
  };
  let pack = await database.getPackageByName(params.name);

  if (!pack.ok) {
    await common.handleError(req, res, pack, 1004);
    return;
  }

  pack = await utils.constructPackageObjectFull(pack.content);

  if (params.engine) {
    // query.engine returns false if no valid query param is found.
    // before using engineFilter we need to check the truthiness of it.
    pack = await utils.engineFilter(pack, params.engine);
  }

  res.status(200).json(pack);
  logger.httpLog(req, res);
}

/**
 * @async
 * @function deletePackagesName
 * @desc Allows the user to delete a repo they have ownership of.
 * @param {object} req - The `Request` object inherited from the Express endpoint.
 * @param {object} res - The `Response` object inherited from the Express endpoint.
 * @property {http_method} - DELETE
 * @property {http_endpoint} - /api/packages/:packageName
 */
async function deletePackagesName(req, res) {
  let params = {
    auth: query.auth(req),
    packageName: decodeURIComponent(req.params.packageName),
  };

  let user = await auth.verifyAuth(params.auth);

  if (!user.ok) {
    await common.handleError(req, res, user, 1005);
    return;
  }

  let gitowner = await git.ownership(user.content, params.packageName);

  if (!gitowner.ok) {
    await common.handleError(req, res, gitowner, 4001);
    return;
  }

  // Now they are logged in locally, and have permission over the GitHub repo.
  let rm = await database.removePackageByName(params.packageName);

  if (!rm.ok) {
    await common.handleError(req, res, rm, 1006);
    return;
  }

  res.status(204).send();
  logger.httpLog(req, res);
}

/**
 * @async
 * @function postPackagesStar
 * @desc Used to submit a new star to a package from the authenticated user.
 * @param {object} req - The `Request` object inherited from the Express endpoint.
 * @param {object} res - The `Response` object inherited from the Express endpoint.
 * @property {http_method} - POST
 * @property {http_endpoint} - /api/packages/:packageName/star
 */
async function postPackagesStar(req, res) {
  let params = {
    auth: query.auth(req),
    packageName: decodeURIComponent(req.params.packageName),
  };

  let user = await auth.verifyAuth(params.auth);

  if (!user.ok) {
    await common.handleError(req, res, user, 1008);
    return;
  }

  const exists = await database.getPackageByName(params.packageName);

  if (!exists.ok) {
    // The package we are trying to star doesn't exist, resolve with a 404.
    await common.handleError(
      req,
      res,
      { ok: false, short: "Not Found", content: exists.content },
      1012
    );
    return;
  }

  let star = await database.updateStars(user.content, params.packageName);

  if (!star.ok) {
    await common.handleError(req, res, user, 1009);
    return;
  }

  let updatePack = await database.updatePackageIncrementStarByName(
    params.packageName
  );

  if (!updatePack.ok) {
    await common.handleError(req, res, updatePack, 1010);
    return;
  }

  // Now with a success we want to return the package back in this query
  let pack = await database.getPackageByName(params.packageName);

  if (!pack.ok) {
    await common.handleError(req, res, pack, 1011);
    return;
  }

  pack = await utils.constructPackageObjectFull(pack.content);

  res.status(200).json(pack);
  logger.httpLog(req, res);
}

/**
 * @async
 * @function deletePackageStar
 * @desc Used to remove a star from a specific package for the authenticated usesr.
 * @param {object} req - The `Request` object inherited from the Express endpoint.
 * @param {object} res - The `Response` object inherited from the Express endpoint.
 * @property {http_method} - DELETE
 * @property {http_endpoint} - /api/packages/:packageName/star
 */
async function deletePackagesStar(req, res) {
  let params = {
    auth: query.auth(req),
    packageName: decodeURIComponent(req.params.packageName),
  };

  let user = await auth.verifyAuth(params.auth);

  if (!user.ok) {
    await common.handleError(req, res, user);
    return;
  }

  let unstar = await database.updateDeleteStar(
    user.content,
    params.packageName
  );

  if (!unstar.ok) {
    await common.handleError(req, res, unstar);
    return;
  }

  let updatePack = await database.updatePackageDecrementStarByName(
    params.packageName
  );

  if (!updatePack.ok) {
    await common.handleError(req, res, updatePack);
    return;
  }

  // On a successful action here we will return an empty 201
  res.status(201).send();
  logger.httpLog(req, res);
}

/**
 * @async
 * @function getPackagesStargazers
 * @desc Endpoint returns the array of `star_gazers` from a specified package.
 * Taking only the package wanted, and returning it directly.
 * @param {object} req - The `Request` object inherited from the Express endpoint.
 * @param {object} res - The `Response` object inherited from the Express endpoint.
 * @property {http_method} - GET
 * @property {http_endpoint} - /api/packages/:packageName/stargazers
 */
async function getPackagesStargazers(req, res) {
  let params = {
    packageName: decodeURIComponent(req.params.packageName),
  };
  let pack = await database.getPackageByName(params.packageName);

  if (!pack.ok) {
    await common.handleError(req, res, pack);
    return;
  }

  let stars = await database.getStarringUsersByPointer(pack.content);

  if (!stars.ok) {
    await common.handleError(req, res, stars);
    return;
  }

  let gazers = await database.getUserCollectionById(stars.content);

  if (!gazers.ok) {
    await common.handleError(req, res, gazers);
    return;
  }

  res.status(200).json(gazers.content);
  logger.httpLog(req, res);
}

/**
 * @async
 * @function postPackagesVersion
 * @desc Allows a new version of a package to be published. But also can allow
 * a user to rename their application during this process.
 * @param {object} req - The `Request` object inherited from the Express endpoint.
 * @param {object} res - The `Response` object inherited from the Express endpoint.
 * @property {http_method} - POST
 * @property {http_endpoint} - /api/packages/:packageName/versions
 * @todo Find methodology of handling rename.
 */
async function postPackagesVersion(req, res) {
  let params = {
    tag: query.tag(req),
    rename: query.rename(req),
    auth: query.auth(req),
    packageName: decodeURIComponent(req.params.packageName),
  };

  // On renaming:
  // When a package is being renamed, we will expect that packageName will match a previously published package.
  // But then the `name` of their `package.json` will be different. And if they are, we expect that `auth` is true.
  // Because otherwise it will fail. That's the methodology, the logic here just needs to catch up.

  let user = await auth.verifyAuth(params.auth);

  if (!user.ok) {
    await common.handleError(req, res, user);
    return;
  }

  // To support a rename, we need to check if they have permissions over this packages new name.
  // Which means we have to check if they have ownership AFTER we collect it's data.

  let packExists = await database.getPackageByName(params.packageName);

  if (!packExists.ok) {
    await common.handleError(req, res, packExists);
    return;
  }

  // Now it's important to note, that getPackageJSON was intended to be an internal function.
  // As such does not return a Server Status Object. This may change later, but for now, we will expect `undefined` to not be success.
  let packJSON = await git.getPackageJSON(
    `${user.content.username}/${packExists.name}`,
    user.content
  );

  if (packJSON === undefined) {
    await common.handleError(req, res, {
      ok: false,
      short: "Bad Package",
      content: `Failed to get Package: ${params.packageName}`,
    });
    return;
  }

  if (pack.name !== params.packageName && !params.rename) {
    // Only return error if the names don't match, and rename isn't enabled.
    await common.handleError(req, res, {
      ok: false,
      short: "Bad Repo",
      content: "Package name doesn't match local name, with rename false",
    });
    return;
  }

  // Else we will continue, and trust the name provided from the package as being accurate. And now we can ensure the user
  // actually owns this repo, with our updated name.

  let gitowner = await git.ownership(user.content, packJSON.name);

  if (!gitowner.ok) {
    await common.handleError(req, res, gitowner);
    return;
  }

  // Now the only thing left to do, is add this new version with the name from the package. And check again if the name is incorrect, since it'll
  // need a new entry onto the names.

  if (pack.name !== params.packageName && params.rename) {
    // The flow for creating a new package name.
    let newName = await database.insertNewPackageName(
      pack.name,
      params.packageName
    );

    if (!newName.ok) {
      await common.handleError(req, res, newName);
      return;
    }

    // Now add the new version key.
  }

  // Now add the new Version key.

  // TODO: Unkown how to handle a rename, so it must be planned before completion.
  await common.notSupported(req, res);
  logger.httpLog(req, res);
}

/**
 * @async
 * @function getPackagesVersion
 * @desc Used to retreive a specific version from a package.
 * @param {object} req - The `Request` object inherited from the Express endpoint.
 * @param {object} res - The `Response` object inherited from the Express endpoint.
 * @property {http_method} - GET
 * @property {http_endpoint} - /api/packages/:packageName/versions/:versionName
 */
async function getPackagesVersion(req, res) {
  let params = {
    packageName: decodeURIComponent(req.params.packageName),
    versionName: query.engine(req.params.versionName),
  };
  // Check the truthiness of the returned query engine.
  if (!params.versionName) {
    // we return a 404 for the version, since its an invalid format
    await common.notFound(req, res);
    return;
  }
  // Now we know the version is a valid semver.

  let pack = await database.getPackageVersionByNameAndVersion(
    params.packageName,
    params.versionName
  );

  if (!pack.ok) {
    await common.handleError(req, res, pack);
    return;
  }

  let packRes = await utils.constructPackageObjectJSON(pack.content);

  res.status(200).json(packRes);
  logger.httpLog(req, res);
}

/**
 * @async
 * @function getPackagesVersionTarball
 * @desc Allows the user to get the tarball for a specific package version.
 * Which should initiate a download of said tarball on their end.
 * @param {object} req - The `Request` object inherited from the Express endpoint.
 * @param {object} res - The `Response` object inherited from the Express endpoint.
 * @property {http_method} - GET
 * @property {http_endpoint} - /api/packages/:packageName/versions/:versionName/tarball
 */
async function getPackagesVersionTarball(req, res) {
  let params = {
    packageName: decodeURIComponent(req.params.packageName),
    versionName: query.engine(req.params.versionName),
  };
  // Now that migration has began we know that each version will have
  // a tarball_url key on it, linking directly to the tarball from gh for that version.

  // we initially want to ensure we have a valid version.
  if (!params.versionName) {
    // since query.engine gives false if invalid, we can just check if its truthy
    // additionally if its false, we know the version will never be found.
    await common.notFound(req, res);
    return;
  }

  // first lets get the package
  let pack = await database.getPackageVersionByNameAndVersion(
    params.packageName,
    params.versionName
  );

  if (!pack.ok) {
    await common.handleError(req, res, pack);
    return;
  }

  let save = await database.updatePackageIncrementDownloadByName(
    params.packageName
  );

  if (!save.ok) {
    logger.warningLog(req, res, save.content);
    // we don't want to exit on a failed to update downloads count, but should be logged.
  }

  // For simplicity, we will redirect the request to gh tarball url, to allow
  // the download to take place from their servers.
  res.redirect(pack.content.meta.tarball_url);
  logger.httpLog(req, res);
  return;
}

/**
 * @async
 * @function deletePackageVersion
 * @desc Allows a user to delete a specific version of their package.
 * @param {object} req - The `Request` object inherited from the Express endpoint.
 * @param {object} res - The `Response` object inherited from the Express endpoint.
 * @property {http_method} - DELETE
 * @property {http_endpoint} - /api/packages/:packageName/versions/:versionName
 */
async function deletePackageVersion(req, res) {
  let params = {
    auth: query.auth(req),
    packageName: decodeURIComponent(req.params.packageName),
    versionName: req.params.versionName,
  };

  // Verify the user has local and remote permissions
  let user = await auth.verifyAuth(params.auth);

  if (!user.ok) {
    await common.handleError(req, res, user);
    return;
  }

  let gitowner = await git.ownership(user.content, params.packageName);

  if (!gitowner.ok) {
    await common.handleError(req, res, gitowner);
    return;
  }

  // Lets also first check to make sure the package exists.
  let packageExists = await database.getPackageByName(params.packageName);

  if (!packageExists.ok) {
    await common.handleError(req, res, packageExists);
    return;
  }

  // Mark the specified version for deletion, if version is valid
  let removeVersion = await database.removePackageVersion(
    params.packageName,
    params.versionName
  );

  if (!removeVersion.ok) {
    await common.handleError(req, res, removeVersion);
    return;
  }

  res.status(204).send();
  logger.httpLog(req, res);
}

/**
 * @async
 * @function postPackagesEventUninstall
 * @desc Used when a package is uninstalled, decreases the download count by 1.
 * And saves this data, Originally an undocumented endpoint.
 * The decision to return a '201' was based on how other POST endpoints return,
 * during a successful event.
 * @see {@link https://github.com/atom/apm/blob/master/src/uninstall.coffee}
 * @param {object} req - The `Request` object inherited from the Express endpoint.
 * @param {object} res - The `Response` object inherited from the Express endpoint.
 * @property {http_method} - POST
 * @property {http_endpoint} - /api/packages/:packageName/versions/:versionName/events/uninstall
 */
async function postPackagesEventUninstall(req, res) {
  let params = {
    auth: query.auth(req),
    packageName: decodeURIComponent(req.params.packageName),
    versionName: req.params.versionName,
  };

  let user = await auth.verifyAuth(params.auth);

  if (!user.ok) {
    await common.handleError(req, res, user);
    return;
  }

  // TODO: How does this impact performance? Wonder if we could return
  // the next command with more intelligence to know the pack doesn't exist.
  let packExists = await database.getPackageByName(params.packageName);

  if (!packExists.ok) {
    await common.handleError(req, res, packExists);
    return;
  }

  let write = await database.updatePackageDecrementDownloadByName(
    params.packageName
  );

  if (!write.ok) {
    await common.handleError(req, res, write);
    return;
  }

  res.status(200).json({ ok: true });
  logger.httpLog(req, res);
}

module.exports = {
  getPackages,
  postPackages,
  getPackagesFeatured,
  getPackagesSearch,
  getPackagesDetails,
  deletePackagesName,
  postPackagesStar,
  deletePackagesStar,
  getPackagesStargazers,
  postPackagesVersion,
  getPackagesVersion,
  getPackagesVersionTarball,
  deletePackageVersion,
  postPackagesEventUninstall,
};
