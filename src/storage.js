/**
 * @module storage
 * @desc This module is the second generation of data storage methodology,
 * in which this provides static access to files stored within regular cloud
 * file storage. Specifically intended for use with Google Cloud Storage.
 */

const { Storage } = require("@google-cloud/storage");
const logger = require("./logger.js");
const { CacheObject } = require("./cache.js");
const { GCLOUD_STORAGE_BUCKET, GOOGLE_APPLICATION_CREDENTIALS } =
  require("./config.js").getConfig();

let gcs_storage;
let cached_banlist, cached_featuredlist;

/**
 * @function checkGCS
 * @desc Sets up the Google Cloud Storage Class, to ensure its ready to use.
 */
function checkGCS() {
  if (gcs_storage === undefined) {
    gcs_storage = new Storage({
      keyFilename: GOOGLE_APPLICATION_CREDENTIALS,
    });
  }
}

/**
 * @async
 * @function getBanList
 * @desc Reads the ban list from the Google Cloud Storage Space.
 * Returning the cached parsed JSON object.
 * If it has been read before during this instance of hosting just the cached
 * version is returned.
 */
async function getBanList() {
  checkGCS();

  const getNew = async function () {
    try {
      let contents = await gcs_storage
        .bucket(GCLOUD_STORAGE_BUCKET)
        .file("name_ban_list.json")
        .download();
      cached_banlist = new CacheObject(JSON.parse(contents));
      cached_banlist.last_validate = Date.now();
      return { ok: true, content: cached_banlist.data };
    } catch (err) {
      return { ok: false, content: err, short: "Server Error" };
    }
  };

  if (cached_banlist === undefined) {
    logger.debugLog("Creating Ban List Cache.");
    return getNew();
  }

  if (!cached_banlist.Expired) {
    logger.debugLog("Ban List Cache NOT Expired.");
    return { ok: true, content: cached_banlist.data };
  }

  logger.debugLog("Ban List Cache IS Expired.");
  return getNew();
}

/**
 * @async
 * @function getFeaturedPackages
 * @desc Returns the hardcoded featured packages file from Google Cloud Storage.
 * Caching the object once read for this instance of the server run.
 */
async function getFeaturedPackages() {
  checkGCS();

  const getNew = async function () {
    try {
      let contents = await gcs_storage
        .bucket(GCLOUD_STORAGE_BUCKET)
        .file("featured_packages.json")
        .download();
      cached_featuredlist = new CacheObject(JSON.parse(contents));
      cached_featuredlist.last_validate = Date.now();
      return { ok: true, content: cached_featuredlist.data };
    } catch (err) {
      return { ok: false, content: err, short: "Server Error" };
    }
  };

  if (cached_featuredlist === undefined) {
    logger.debugLog("Creating Ban List Cache.");
    return getNew();
  }

  if (!cached_featuredlist.Expired) {
    logger.debugLog("Ban List Cache NOT Expired.");
    return { ok: true, content: cached_featuredlist.data };
  }

  logger.debugLog("Ban List Cache IS Expired.");
  return getNew();
}

module.exports = {
  checkGCS,
  getBanList,
  getFeaturedPackages,
};