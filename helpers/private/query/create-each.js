//   ██████╗██████╗ ███████╗ █████╗ ████████╗███████╗    ███████╗ █████╗  ██████╗██╗  ██╗
//  ██╔════╝██╔══██╗██╔════╝██╔══██╗╚══██╔══╝██╔════╝    ██╔════╝██╔══██╗██╔════╝██║  ██║
//  ██║     ██████╔╝█████╗  ███████║   ██║   █████╗      █████╗  ███████║██║     ███████║
//  ██║     ██╔══██╗██╔══╝  ██╔══██║   ██║   ██╔══╝      ██╔══╝  ██╔══██║██║     ██╔══██║
//  ╚██████╗██║  ██║███████╗██║  ██║   ██║   ███████╗    ███████╗██║  ██║╚██████╗██║  ██║
//   ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝    ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
//
// Run creates in order and return the records. This is needed because MySQL
// lacks the ability to return multiple insert id's from a bulk insert.
//
// So when a createEach call from Waterline is made with the `fetch: true` flag
// turned on, the records must be inserted one by one in order to return the
// correct primary keys.

var _ = require('@sailshq/lodash');

module.exports = function createEach(options, cb) {
  //  ╦  ╦╔═╗╦  ╦╔╦╗╔═╗╔╦╗╔═╗  ┌─┐┌─┐┌┬┐┬┌─┐┌┐┌┌─┐
  //  ╚╗╔╝╠═╣║  ║ ║║╠═╣ ║ ║╣   │ │├─┘ │ ││ ││││└─┐
  //   ╚╝ ╩ ╩╩═╝╩═╩╝╩ ╩ ╩ ╚═╝  └─┘┴   ┴ ┴└─┘┘└┘└─┘
  if (_.isUndefined(options) || !_.isPlainObject(options)) {
    throw new Error('Invalid options argument. Options must contain: collection and query.');
  }

  if (!_.has(options, 'collection') || !_.isObject(options.collection)) {
    throw new Error('Invalid option used in options argument. Missing or invalid collection.');
  }

  if (!_.has(options, 'query') || !_.isPlainObject(options.query)) {
    throw new Error('Invalid option used in options argument. Missing or invalid query flag.');
  }

  var collection = options.collection;
  var query = options.query;

  // Insert the documents into the db.
  collection.insertMany(query.newRecords, function insertCb(err, report) {
    if (err) {
      if (err.code === 11000 || err.code === 11001) {
        err.footprint = {
          identity: 'notUnique'
        };

        // If we can infer which attribute this refers to, add a `keys` array to the error.
        // First, see if only one value in the new record matches the value that triggered the uniqueness violation.
        var errKeys = _.filter(_.values(_.first(query.newRecords)), function filterFn(val) {
          return val === err.key;
        });

        if (errKeys.length === 1) {
          // If so, find the key (i.e. column name) that this value was assigned to, add set that in the `keys` array.
          var footprintKey = _.findKey(query.newRecord, function findFn(val) {
            return val === err.key;
          });

          // Set the footprint keys
          err.footprint.keys = [footprintKey];
        } else {
          err.footprint.keys = [];
        }
      }

      return cb(err);
    }

    if (query.meta && query.meta.fetch) {
      // Normally we would process the response using the
      // Parse Native Query Result machine in machinepack-mongo. However because
      // we want to return the entire record in a fetch just grab it off the
      // report using the `ops` key.
      var records = report.ops;
      return cb(undefined, records);
    }

    return cb();
  });
};
