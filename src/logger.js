/**
 * @module logger
 * @desc Allows easy logging of the server. Allowing it to become simple to add additional
 * logging methods if a log server is ever implemented.
 */

const { debug, LOG_LEVEL, LOG_FORMAT } = require("./config.js").getConfig();
const util = require("util");

/**
 * @function httpLog
 * @desc The standard logger for HTTP calls. Logging in a modified 'Apache Combined Log Format'.
 * @param {object} req - The `Request` object inherited from the Express endpoint.
 * @param {object} res - The `Response` object inherited from the Express endpoint.
 * @example <caption>Logging Output Format</caption>
 * HTTP:: IP [DATE (as ISO String)] "HTTP_METHOD URL PROTOCOL" STATUS_CODE DURATION_OF_REQUESTms
 */
function httpLog(req, res) {
  let date = new Date();
  let duration = Date.now() - (req.start ?? Date.now());
  console.log(
    `HTTP:: ${req.ip ?? "NO_IP"} [${date.toISOString() ?? "NO_DATE"}] "${
      req.method ?? "NO_METHOD"
    } ${sanitizeLogs(req.url) ?? "NO_URL"} ${req.protocol ?? "NO_PROT"}" ${
      res.statusCode ?? "NO_STATUS"
    } ${duration}ms`
  );
}

/**
 * @function errorLog
 * @desc An endpoint to log errors, as well as exactly where they occured. Allowing some insight into what caused
 * them, as well as how the server reacted to the end user.
 * @param {object} req - The `Request` object inherited from the Express endpoint.
 * @param {object} res - The `Response` object inherited from the Express endpoint.
 * @param {object|string} err - The error of what happened. Will take a raw error value, or a string created one.
 * @example <caption>Logging Output Format</caption>
 * ERROR:: IP "HTTP_METHOD URL PROTOCOL" STATUS_CODE DURATION_OF_REQUESTms ! ERROR
 */
function errorLog(req, res, err, num = 9999) {
  // this will be a generic error logger to grab some stats about what happened, how the server handled it. And of course the error.
  let duration = Date.now() - (req.start ?? Date.now());
  console.log(
    `ERROR-${num}:: ${req.ip ?? "NO_IP"} "${req.method ?? "NO_METHOD"} ${
      sanitizeLogs(req.url) ?? "NO_URL"
    } ${req.protocol ?? "NO_PROT"}" ${
      res.statusCode ?? "NO_STATUS"
    } ${duration}ms ! ${sanitizeLogs(err?.toString()) ?? "NO_ERR"}`
  );
}

/**
 * @function warningLog
 * @desc An endpoint to log warnings. This should be used for when an error recovered, but the server
 * did its best to recover from it. Providing no error to the end user.
 * @param {object} [req] - The Optional `Request` object inherited from the Express endpoint.
 * @param {object} [res] - The Optional `Response` object inherited from the Express endpoint.
 * @param {object|string} err - The error of what happened. And like `ErrorLog` takes the raw error, or a string created one.
 * @example <caption>Logging Output Format w/ Req and Res.</caption>
 * WARNING:: IP "HTTP_METHOD URL PROTOCOL" STATUS_CODE DURATION_OF_REQUESTms ! ERROR
 * @example <caption>Logging Output Format w/o Req and Res.</caption>
 * WARNING:: ERROR
 */
function warningLog(req, res, err, num = 9999) {
  // We must remember that in many instances warningLog is used to log generic warnings,
  // without ever being passed req or res. So these values cannot be relied on.
  let duration = Date.now() - (req?.start ?? Date.now());
  console.log(
    `WARNING-${num}:: ${req?.ip ?? "NO_IP"} "${req?.method ?? "NO_METHOD"} ${
      sanitizeLogs(req?.url) ?? "NO_URL"
    } ${req?.protocol ?? "NO_PROT"}" ${
      res?.statusCode ?? "NO_STATUS"
    } ${duration}ms ! ${sanitizeLogs(err?.toString()) ?? "NO_ERR"}`
  );
}

/**
 * @function infoLog
 * @desc An endpoint to log information only. Used sparingly, but may be helpful.
 * @param {string} value - The value of whatever is being logged.
 * @example <caption>Logging Output Format</caption>
 * INFO:: VALUE
 */
function infoLog(value) {
  console.log(`INFO:: ${sanitizeLogs(value) ?? "NO_LOG_VALUE"}`);
}

/**
 * @function debugLog
 * @desc An endpoint to log debug information only. This log will only show if enabled in the Config file.
 * That is if the `app.yaml` file has DEBUG as true.
 * @param {string} value - The value of whatever is being logged.
 * @example <caption>Logging Output Format</caption>
 * DEBUG:: VALUE
 */
function debugLog(value) {
  if (debug) {
    console.log(`DEBUG:: ${sanitizeLogs(value) ?? "NO_LOG_VALUE"}`);
  }
}

/**
 * @function sanitizeLogs
 * @desc This function intends to assist in sanitizing values from users that
 * are input into the logs. Ensuring log forgery does not occur.
 * And to help ensure that other malicious actions are unable to take place to
 * admins reviewing the logs.
 * @param {string} val - The user provided value to sanitize.
 * @returns {string} A sanitized log from the provided value.
 * @see {@link https://cwe.mitre.org/data/definitions/117.html}
 */
function sanitizeLogs(val) {
  // Removes New Line, Carriage Return, Tabs,
  // TODO: Should probably also defend against links within this.
  return val?.replace(/\n|\r/g, "")?.replace(/\t/g, "");
}

/**
 * @function generic
 * @desc A generic logger, that will can accept all types of logs. And from then
 * create warning, or info logs debending on the Log Level provided.
 * Additionally the generic logger accepts a meta object argument, to extend
 * it's logging capabilities, to include system objects, or otherwise unexpected values.
 * It will have support for certain objects in the meta field to create specific
 * logs, but otherwise will attempt to display the data provided.
 * @param {integer} lvl - The Log Level to output. With the following definition.
 * 1 - Fatal
 * 2 - Error
 * 3 - Warning
 * 4 - Information
 * 5 - Debug
 * 6 - Trace
 * @param {string} val - The main information to contain within the log.
 * @param {object} [meta] - An optional Object to include, this object as described
 * above can contain additional information either expected of the log, or that
 * is not natively supported, but will be attempted to display.
 */
function generic(lvl, val, meta = {}) {
  if (lvl === undefined) {
    // we will use our own supported logging to log that an invalid log was attempted.
    lvl = 6;
  }
  if (val === undefined) {
    val = "logger.generic() Called with Missing `val`";
  }

  // Now to check through our supported meta keys.

  // Additionally this will support a set of log types. The log type will determine
  // the structure of the resulting log message.
  // Supported Types:
  // default - The log will prioritze the val passed, and not much else.
  // object - Would also require the meta.obj to be set to an object you'd like to
  //          to appear in the log.
  // error - The log will prioritze searching for error details.
  //    If error is specified try to include the following additional meta property.
  //      err - The raw error message thrown whenever possible.

  // Now before we do any processing on the log, lets determine if it's within our
  // server config log level.
  if (lvl > LOG_LEVEL) {
    // Since the level here is lower than the defined log level we will return
    // without any activity.
    return;
  }

  let type = "default";
  if (meta.type !== undefined) {
    type = meta.type;
  }

  let output = "";

  switch (lvl) {
    case 1:
      output += `[FATAL]:: ${val ?? ""}`;
      break;
    case 2:
      output += `[ERROR]:: ${val ?? ""}`;
      break;
    case 3:
      output += `[WARNING]:: ${val ?? ""}`;
      break;
    case 4:
      output += `[INFO]:: ${val ?? ""}`;
      break;
    case 5:
      output += `[DEBUG]:: ${val ?? ""}`;
      break;
    case 6:
      output += `[TRACE]:: ${val ?? ""}`;
      break;
    default:
      output += `[UNSUPORTED]:: ${val ?? ""}`;
      break;
  }

  switch (type) {
    case "error":
      output += craftError(meta);
      break;
    case "object":
      if (meta.obj !== undefined) {
        output += util.inspect(meta.obj);
      }
      break;
    case "default":
    default:
      break;
  }

  switch (LOG_FORMAT) {
    case "stdout":
      console.log(output);
      break;
    default:
      // Unsupported method. Use "stdout" by default.
      console.log("#BAD_LOG_FORMAT#" + output);
      break;
  }
}

function craftError(meta) {
  // This takes the meta object from the generic error handler, and returns a string
  // depending on what values are provided and supported.
  let ret = "";

  if (meta.err) {
    ret += ` ${meta.err.name ?? "Error"} Occured: ${
      meta.err.fileName !== undefined && meta.err.lineNumber !== undefined
        ? ` in ${meta.err.fileName}#${meta.err.lineNumber}`
        : ""
    }: ${meta.err.cause ?? meta.err?.toString()}`;
  } else {
    ret += " Unspecified Error Occured.";
  }
  return ret;
}

module.exports = {
  httpLog,
  errorLog,
  warningLog,
  infoLog,
  debugLog,
  sanitizeLogs,
  generic,
};
