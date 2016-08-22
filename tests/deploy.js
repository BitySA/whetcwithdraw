"use strict";

var ethConnector = require('./js/eth_connector');
var simplewithdrawHelper = require('./js/simplewithdraw_helper');
var snapshotHelper = require('./js/dao_balance_snapshot_helper');
var assert = require('assert');
var async = require('async');
var BigNumber = require('bignumber.js');

var D160 = new BigNumber("10000000000000000000000000000000000000000",16);

function expectDiffToBe(newB, oldB, diffB, msg) {
    assert(
        oldB.add(diffB).minus(newB).abs().lt(90000),
        msg + ". Expected " + diffB + " but got " + newB.minus(oldB) + "."
    );
}

describe('Deploy Test', function() {
    var snapshot;
    var withdraw;
    before(function(done) {
        ethConnector.init('testrpc',done);
    });

    it('should deploy balanceSnapshot', function(done) {
        this.timeout(40000);
        snapshot = snapshotHelper.deploy({
        }, function(err, contract) {
            assert.ifError(err);
            assert.ok(contract);
            snapshot = contract;
            done();
        });
    });

    it('should deploy Withdraw Contract', function(done) {
        this.timeout(40000);
        simplewithdrawHelper.deploy({
            _whg_donation: ethConnector.accounts[2],
            _daoBalanceSnapshotAddress: snapshot.address,
            _botAddress: ethConnector.accounts[0],
            _escapeAddress: ethConnector.accounts[2],
            _remainingBeneficiary: ethConnector.accounts[2]
        }, function(err, contract) {
            assert.ifError(err);
            assert.ok(contract);
            withdraw = contract;
            done();
        });
    });

    it('should populate the balanceSnapshot contract', function() {
        this.timeout(40000);
            snapshot.fill(
                [D160.mul(100000000).add(ethConnector.accounts[0]).toString(10),
                 D160.mul(200000000).add(ethConnector.accounts[1]).toString(10)
                ],
                {from: ethConnector.accounts[0]}
            , function(err, withdraw) {
                assert.ifError(err);
            });
    });

    it('should seal the balanceSnapshot contract', function(done) {
        this.timeout(40000);
            snapshot.seal( {from: ethConnector.accounts[0]}
            , function(err, withdraw) {
                assert.ifError(err);
                done();
            });
    });

    it('query balanceSnapshot contract', function(done) {
        this.timeout(40000);
        snapshot.balanceOf(ethConnector.accounts[0],
                           function (err, balance) {
                               assert.ifError(err);
                               assert.equal(
                                   balance,
                                   100000000,
                                   "Balance mismatch"
                               );
                               done();
                           });
    });

    it('should deposit in the withdraw contract', function(done) {
        this.timeout(40000);
        var fundsToDeposit = ethConnector.web3.toWei(10, 'ether');
	    async.series([
	        function(cb) {
		        withdraw.deposit({from: ethConnector.accounts[0], value: fundsToDeposit}, cb);
	        }, function(cb) {
		        withdraw.getTotalFunds(cb);
            },
	    ], function (err, results) {
            assert.ifError(err);
            assert.equal(
                results[1],
                fundsToDeposit,
                "Total funds mismatch"
            );
            done();
        });
    });

    it('should fail to deposit from non-certified account', function(done) {
        this.timeout(40000);
        var fundsToDeposit = ethConnector.web3.toWei(10, 'ether');
	    async.series([
	        function(cb) {
                withdraw.getTotalFunds(cb);
	        }, function(cb) {
		            withdraw.deposit({from: ethConnector.accounts[1], value: fundsToDeposit}, cb);
	        }, function(cb) {
		        withdraw.getTotalFunds(cb);
            },
	    ], function (err, results) {
            assert.equal(err, "Error: VM Exception while executing transaction: invalid JUMP");
            done();
        });
    });

    it('should calculate ones token balance from withdraw contract', function(done) {
        this.timeout(40000);
        withdraw.getMyBalance(
            ethConnector.accounts[1],
            function (err, res) {
                assert.ifError(err);
                assert.equal(
                    res,
                    200000000,
                    "Balance mismatch from withdraw contract"
                );
                done();
            });
    });

    it('should calculate ones withdraw amount', function(done) {
        this.timeout(40000);
        withdraw.calculateWithdraw(
            ethConnector.accounts[1],
            function (err, res) {
                assert.ifError(err);
                assert.equal(
                    res,
                    6666666666666666666,
                    "Amount to withdraw does not match"
                );
                done();
            });
    });

    it('should withdraw ones full portion', function(done) {
        this.timeout(40000);
        var oldBalance;
        var newBalance;

	async.series([
	    function(cb) {
		ethConnector.web3.eth.getBalance(ethConnector.accounts[1], cb);
	    }, function(cb) {
		    withdraw.withdraw(ethConnector.accounts[1], 0, {from: ethConnector.accounts[1]}, cb);
	    }, function(cb) {
		ethConnector.web3.eth.getBalance(ethConnector.accounts[1], cb);
	    },
	], function (err, results) {
	    assert.ifError(err);
	    oldBalance = new BigNumber(results[0]);
	    newBalance = new BigNumber(results[2]);
        expectDiffToBe(
            newBalance, oldBalance, "6666666666666666666",
            "Did not withdraw the expected amount of ETH"
        );
        done();
	});
    });

    it('should withdraw 60% of ones portion', function(done) {
        this.timeout(40000);
        async.series([
            function(cb) {
                ethConnector.web3.eth.getBalance(ethConnector.accounts[0], cb);
            } , function(cb) {
                ethConnector.web3.eth.getBalance(ethConnector.accounts[2], cb);
            } , function(cb) {
		        withdraw.withdraw(ethConnector.accounts[0], 40, {from: ethConnector.accounts[0]}, cb);
	        }, function(cb) {
		        ethConnector.web3.eth.getBalance(ethConnector.accounts[0], cb);
	        }, function(cb) {
		        ethConnector.web3.eth.getBalance(ethConnector.accounts[2], cb);
	        },
        ], function (err, results) {
            assert.ifError(err);
	        var oldBalanceAcc = new BigNumber(results[0]);
	        var oldBalanceWHG = new BigNumber(results[1]);
	        var newBalanceAcc = new BigNumber(results[3]);
	        var newBalanceWHG = new BigNumber(results[4]);

            expectDiffToBe(
                newBalanceAcc, oldBalanceAcc, "1999999999999999999",
                "Did not withdraw the expected amount of ETH"
            );
            expectDiffToBe(
                newBalanceWHG, oldBalanceWHG, "1333333333333333333",
                "Did not donate the expected amount of ETH"
            );
	        done();
        });

    });

    it('should deposit from a newly certified account', function(done) {
        this.timeout(40000);
        var fundsToDeposit = ethConnector.web3.toWei(20, 'ether');
	    async.series([
	        function(cb) {
		        withdraw.getTotalFunds(cb);
            }, function(cb) {
		        withdraw.changeCertifiedDepositors(ethConnector.accounts[1], true, {from: ethConnector.accounts[0]}, cb);
	        }, function(cb) {
                withdraw.deposit({from: ethConnector.accounts[1], value: fundsToDeposit}, cb);
	        }, function(cb) {
		        withdraw.getTotalFunds(cb);
	        }, function(cb) {
		        withdraw.isCertifiedDepositor(ethConnector.accounts[1], cb);
            },
	    ], function (err, results) {
            assert.ifError(err);
            var oldTotal = new BigNumber(results[0]);
            var newTotal = new BigNumber(results[3]);
            assert(results[4], "Account should now be a certified depositor");
            assert(
                newTotal.minus(oldTotal).equals(fundsToDeposit),
                "Should have deposited the correct amount"
            );
            done();
        });
    });

    it('should withdraw ones full portion after topping up', function(done) {
        this.timeout(40000);
	    async.series([
	        function(cb) {
		        ethConnector.web3.eth.getBalance(ethConnector.accounts[1], cb);
	        }, function(cb) {
		        withdraw.getPaidOut(ethConnector.accounts[1], cb);
	        }, function(cb) {
		        withdraw.withdraw(ethConnector.accounts[1], 0, {from: ethConnector.accounts[1]}, cb);
	        }, function(cb) {
		        ethConnector.web3.eth.getBalance(ethConnector.accounts[1], cb);
	        },
	    ], function (err, results) {
	        assert.ifError(err);
	        var oldBalance = new BigNumber(results[0]);
	        var newBalance = new BigNumber(results[3]);
            var paidOut = new BigNumber(results[1]);
            assert(
                paidOut.equals("6666666666666666666"),
                "Mismatch in what should have already been paid out"
            );
            expectDiffToBe(
                newBalance, oldBalance, "13333333333333333333",
                "Did not withdraw the expected amount of ETH"
            );
            done();
	    });
    });

    it('should withdraw 70% of ones portion after topping up', function(done) {
        this.timeout(40000);
        async.series([
            function(cb) {
                ethConnector.web3.eth.getBalance(ethConnector.accounts[0], cb);
            } , function(cb) {
                ethConnector.web3.eth.getBalance(ethConnector.accounts[2], cb);
            } , function(cb) {
		        withdraw.getPaidOut(ethConnector.accounts[0], cb);
            } , function(cb) {
		        withdraw.withdraw(ethConnector.accounts[0], 30, {from: ethConnector.accounts[0]}, cb);
	        }, function(cb) {
		        ethConnector.web3.eth.getBalance(ethConnector.accounts[0], cb);
	        }, function(cb) {
		        ethConnector.web3.eth.getBalance(ethConnector.accounts[2], cb);
	        },
        ], function (err, results) {
            assert.ifError(err);
	        var oldBalanceAcc = new BigNumber(results[0]);
	        var oldBalanceWHG = new BigNumber(results[1]);
            var paidOut = new BigNumber(results[2]);
	        var newBalanceAcc = new BigNumber(results[4]);
	        var newBalanceWHG = new BigNumber(results[5]);

            assert(
                paidOut.equals("3333333333333333333"),
                "Mismatch in what should have already been paid out"
            );
            expectDiffToBe(
                newBalanceAcc, oldBalanceAcc, "4666666666666666666",
                "Did not withdraw the expected amount of ETH"
            );
            expectDiffToBe(
                newBalanceWHG, oldBalanceWHG, "1999999999999999999",
                "Did not donate the expected amount of ETH"
            );
	        done();
        });

    });
});
