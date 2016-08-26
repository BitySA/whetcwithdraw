/*jslint node: true */
"use strict";

var async = require('async');
var ethConnector = require('./eth_connector');


exports.deploy = function(opts,cb) {
    var compilationResult;
    var authorized_addresses;
    return async.waterfall([
        function(cb) {
            ethConnector.loadSol("../address_authorization/authorized_addresses.sol", cb);
        },
        function(src, cb) {
            ethConnector.applyConstants(src, opts, cb);
        },
        function(src, cb) {
            ethConnector.compile(src, cb);
        },
        function(result, cb) {
            compilationResult = result;
            ethConnector.deploy(compilationResult.AuthorizedAddresses.interface,
                compilationResult.AuthorizedAddresses.bytecode,
                0,
                0,
                cb);
        }
   ], function(err, _result) {
        authorized_addresses = _result;
        if (err) return cb(err);
        cb(null, authorized_addresses, compilationResult);
    });
};
