/*jslint node: true */
"use strict";

var async = require('async');
var ethConnector = require('./eth_connector');


exports.deploy = function(opts, cb) {
    var compilationResult;
    var withdraw;
    return async.waterfall([
        function(cb) {
            ethConnector.loadSol("../whetcwithdraw.sol", cb);
        },
        function(src, cb) {
            ethConnector.applyConstants(src, opts, cb);
        },
        function(src, cb) {
            ethConnector.compile(src, cb);
        },
        function(result, cb) {
            compilationResult = result;
            ethConnector.deploy(
                compilationResult.WhitehatWithdraw.interface,
                compilationResult.WhitehatWithdraw.bytecode,
                0,
                0,
                // start arguments
                opts._whg_donation,
                opts._daoBalanceSnapshotAddress,
                opts._botAddress,
                cb);
        }
   ], function(err, _withdraw) {
        withdraw = _withdraw ;
        if (err) return cb(err);
        cb(null,withdraw, compilationResult);
    });
};
