/*jslint node: true */
"use strict";

var async = require('async');
var ethConnector = require('./eth_connector');


exports.deploy = function(opts,cb) {
    var compilationResult;
    var snapshot;
    return async.waterfall([
        function(cb) {
            ethConnector.loadSol("../daobalance/dao_balance_snapshot.sol", cb);
        },
        function(src, cb) {
            ethConnector.applyConstants(src, opts, cb);
        },
        function(src, cb) {
            ethConnector.compile(src, cb);
        },
        function(result, cb) {
            compilationResult = result;
            ethConnector.deploy(compilationResult.DAOBalanceSnapShot.interface,
                compilationResult.DAOBalanceSnapShot.bytecode,
                0,
                0,
                cb);
        }
   ], function(err, _snapshot) {
        snapshot = _snapshot;
        if (err) return cb(err);
        cb(null,snapshot, compilationResult);
    });
};
