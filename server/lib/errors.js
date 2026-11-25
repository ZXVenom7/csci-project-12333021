'use strict';

/** Error with an HTTP status that is safe to show to the client. */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
    this.expose = true;
  }
}

const badRequest = (message, details) => new HttpError(400, message, details);
const unauthorized = (message = 'Please sign in to continue.') => new HttpError(401, message);
const forbidden = (message = 'You do not have permission to do that.') => new HttpError(403, message);
const notFound = (message = 'Not found.') => new HttpError(404, message);
const conflict = (message) => new HttpError(409, message);

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict };
