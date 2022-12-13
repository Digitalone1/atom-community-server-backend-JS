/**
 * @module theme_handler
 * @desc Endpoint Handlers relating to themes only.
 * @implements {command_handler}
 * @implements {database}
 * @implements {utils}
 * @implements {logger}
 */

const common = require("./common_handler.js");
const database = require("../database.js");
const utils = require("../utils.js");
const logger = require("../logger.js");
const query = require("../query.js");
const { server_url } = require("../config.js").getConfig();

/**
 * @async
 * @function getThemeFeatured
 * @desc Used to retreive all Featured Packages that are Themes. Originally an undocumented
 * endpoint. Returns a 200 response based on other similar responses.
 * Additionally for the time being this list is created manually, the same method used
 * on Atom.io for now. Although there are plans to have this become automatic later on.
 * @see {@link https://github.com/atom/apm/blob/master/src/featured.coffee|Source Code}
 * @see {@link https://github.com/confused-Techie/atom-community-server-backend-JS/issues/23|Discussion}
 * @param {object} req - The `Request` object inherited from the Express endpoint.
 * @param {object} res - The `Response` object inherited from the Express endpoint.
 * @property {http_method} - GET
 * @property {http_endpoint} - /api/themes/featured
 */
async function getThemeFeatured(req, res) {
  // Returns Package Object Short Array
  // Supports engine query parameter.
  let col = await database.getFeaturedThemes();

  if (!col.ok) {
    await common.handleError(req, res, col);
    return;
  }

  let newCol = await utils.constructPackageObjectShort(col.content);

  res.status(200).json(newCol);
  logger.httpLog(req, res);
}

/**
 * @async
 * @function getThemes
 * @desc Endpoint to return all Themes to the user. Based on any filtering
 * they'ved applied via query parameters.
 * @param {object} req - The `Request` object inherited from the Express endpoint.
 * @param {object} res - The `Response` object inherited from the Express endpoint.
 * @property {http_method} - GET
 * @property {http_endpoint} - /api/themes
 */
async function getThemes(req, res) {
  const params = {
    page: query.page(req),
    sort: query.sort(req),
    direction: query.dir(req),
  };

  const packages = await database.getSortedPackages(
    params.page,
    params.direction,
    params.sort,
    true
  );

  if (!packages.ok) {
    logger.generic(
      3,
      `getThemes-getSortedPackages Not OK: ${packages.content}`
    );
    await common.handleError(req, res, packages);
    return;
  }

  const packObjShort = await utils.constructPackageObjectShort(
    packages.content
  );

  const packArray = Array.isArray(packObjShort) ? packObjShort : [packObjShort];

  const totalPages = await database.getTotalPackageEstimate();

  if (!totalPages.ok) {
    logger.generic(
      3,
      `getThemes-getTotalPackageEstimate Not OK: ${totalPages.content}`
    );
    await common.handleError(req, res, totalPages);
    return;
  }

  res.append(
    "Link",
    `<${server_url}/api/themes?page=${params.page}&sort=${params.sort}&order=${
      params.direction
    }>; rel="self", <${server_url}/api/themes?page=${totalPages.content}&sort=${
      params.sort
    }&order=${params.direction}>; rel="last", <${server_url}/api/themes?page=${
      params.page + 1
    }&sort=${params.sort}&order=${params.direction}>; rel="next"`
  );

  res.status(200).json(packArray);
  logger.httpLog(req, res);
}

/**
 * @async
 * @function getThemesSearch
 * @desc Endpoint to Search from all themes on the registry.
 * @param {object} req - The `Request` object inherited from the Express endpoint.
 * @param {object} res - The `Response` object inherited from the Express endpoint.
 * @property {http_method} - GET
 * @property {http_endpoint} - /api/themes/search
 */
async function getThemesSearch(req, res) {
  const params = {
    sort: query.sort(req, "relevance"),
    page: query.page(req),
    direction: query.dir(req),
    query: query.query(req),
  };

  const packs = await database.simpleSearch(
    params.query,
    params.page,
    params.direction,
    params.sort,
    true
  );

  if (!packs.ok) {
    if (packs.short == "Not Found") {
      logger.generic(
        4,
        "getThemesSearch-simpleSearch Responding with Empty Array for Not Found Status"
      );
      res.status(200).json([]);
      logger.httpLog(req, res);
      return;
    }
    logger.generic(3, `getThemesSearch-simpleSearch Not OK: ${packs.content}`);
    await common.handleError(req, res, packs);
    return;
  }

  const newPacks = await utils.constructPackageObjectShort(packs.content);
  let packArray = null;

  if (Array.isArray(newPacks)) {
    packArray = newPacks;
  } else if (Object.keys(newPacks).length < 1) {
    packArray = [];
    logger.generic(
      4,
      "getThemesSearch-simpleSearch Responding with Empty Array for 0 key Length Object"
    );
  } else {
    packArray = [newPacks];
  }

  const totalPackageEstimate = await database.getTotalPackageEstimate();

  const totalPages = !totalPackageEstimate.ok ? 1 : totalPackageEstimate.content;

  const safeQuery = encodeURIComponent(
    params.query.replace(/[<>"':;\\/]+/g, "")
  );
  // now to get headers.
  res.append(
    "Link",
    `<${server_url}/api/themes/search?q=${safeQuery}&page=${params.page}&sort=${
      params.sort
    }&order=${
      params.direction
    }>; rel="self", <${server_url}/api/themes?q=${safeQuery}&page=${
      totalPages.content
    }&sort=${params.sort}&order=${
      params.direction
    }>; rel="last", <${server_url}/api/themes/search?q=${safeQuery}&page=${
      params.page + 1
    }&sort=${params.sort}&order=${params.direction}>; rel="next"`
  );

  res.status(200).json(packArray);
  logger.httpLog(req, res);
}

module.exports = {
  getThemeFeatured,
  getThemes,
  getThemesSearch,
};
