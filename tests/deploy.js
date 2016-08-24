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
        oldB.add(diffB).minus(newB).abs().lt(99000),
        msg + ". Expected " + diffB + " but got " + newB.minus(oldB)
    );
}

function expectNumbersEqual(expect, got, msg) {
    expect = new BigNumber(expect);
    got = new BigNumber(got);
    assert(expect.equals(got), msg + ". Expected " + expect + " but got " + got);
}

var g_balances = [];
var g_snapshot_balances = [];
var g_total;
var g_ratios;
var g_total_deposit = new BigNumber(0);
var whgAccIdx = 9;
var whgAcc;

function generateBalances() {
    g_total = new BigNumber(100000000000000);
    g_ratios = [ new BigNumber(0.1), new BigNumber(0.2), new BigNumber(0.4), new BigNumber(0.3)];
    whgAcc = ethConnector.accounts[whgAccIdx];
    for (var i = 0; i < g_ratios.length; i++) {
	g_balances[i] = g_total.mul(g_ratios[i]);
	g_snapshot_balances[i] = [D160.mul(g_balances[i]).add(ethConnector.accounts[i]).toString(10)];
    }
}

function asciiToHex(str) {
    var res = "";
    for (var i = 0; i < str.length; i++) {
        res += str.charCodeAt(i).toString(16);
    }
    return res;
}

function pad(pad, str, padLeft) {
    if (typeof str === 'undefined')
        return pad;
    if (padLeft) {
        return (pad + str).slice(-pad.length);
    } else {
        return (str + pad).substring(0, pad.length);
    }
}

function padTo64Bytes(hexstr) {
    return pad('0000000000000000000000000000000000000000000000000000000000000000', hexstr, true);
}

function signIntent(address, beneficiary, percentage, cb) {
    var text = asciiToHex("Withdraw DAOETC to ")
        + beneficiary.substr(2, beneficiary.length)
        + padTo64Bytes(percentage.toString(16));
    var sha = ethConnector.web3.sha3(text, {encoding: 'hex'});
    ethConnector.web3.eth.sign(address, sha, function(e, sig) {
        sig = sig.substr(2, sig.length);
        var r = '0x' + sig.substr(0, 64);
        var s = '0x' + sig.substr(64, 64);
        var v = ethConnector.web3.toDecimal(sig.substr(128, 2)) + 27;
        cb(null, {sha:sha, v:v, r:r, s:s});
    });
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
	    generateBalances();
        simplewithdrawHelper.deploy({
            _whg_donation: whgAcc,
            _daoBalanceSnapshotAddress: snapshot.address,
            _botAddress: ethConnector.accounts[9],
            _escapeAddress: ethConnector.accounts[9],
            _remainingBeneficiary: ethConnector.accounts[9]
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
	    g_snapshot_balances,
            {from: ethConnector.accounts[0]}
            , function(err, withdraw) {
                assert.ifError(err);
            });
    });

    it('should seal the balanceSnapshot contract', function(done) {
        this.timeout(40000);
        snapshot.seal({from: ethConnector.accounts[0]}, function(err, withdraw) {
            assert.ifError(err);
            done();
        });
    });

    it('query balanceSnapshot contract', function(done) {
        this.timeout(40000);
        snapshot.balanceOf(ethConnector.accounts[0],
                           function (err, balance) {
                               assert.ifError(err);
			       expectNumbersEqual(
				   g_balances[0],
                                   balance,
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
		    expectNumbersEqual(
		        fundsToDeposit,
                results[1],
                "Total funds mismatch"
		    );
		    done();
        });
    });

    it('should fail to deposit from non-certified account', function(done) {
        this.timeout(40000);
        var fundsToDeposit = ethConnector.web3.toWei(10, 'ether');
	    g_total_deposit = g_total_deposit.add(fundsToDeposit);
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
		        expectNumbersEqual(
                    g_balances[1],
                    res,
                    "Balance mismatch from withdraw contract");
                done();
            });
    });

    it('should calculate ones withdraw amount', function(done) {
        this.timeout(40000);
	    async.series([
	        function(cb) {
		        withdraw.getTotalFunds(cb);
	        }, function(cb) {
		        withdraw.calculateWithdraw(ethConnector.accounts[1], cb);
            },
	    ], function (err, results) {
            assert.ifError(err);
	        expectNumbersEqual(
		        results[0].mul(g_ratios[1]),
                results[1],
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
                newBalance, oldBalance, g_ratios[1].mul(g_total_deposit),
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
                ethConnector.web3.eth.getBalance(whgAcc, cb);
            } , function(cb) {
    		    withdraw.withdraw(ethConnector.accounts[0], 40, {from: ethConnector.accounts[0]}, cb);
    	    }, function(cb) {
    		    ethConnector.web3.eth.getBalance(ethConnector.accounts[0], cb);
    	    }, function(cb) {
    		    ethConnector.web3.eth.getBalance(whgAcc, cb);
    	    },
        ], function (err, results) {
            assert.ifError(err);
    	    var oldBalanceAcc = new BigNumber(results[0]);
    	    var oldBalanceWHG = new BigNumber(results[1]);
    	    var newBalanceAcc = new BigNumber(results[3]);
    	    var newBalanceWHG = new BigNumber(results[4]);

            expectDiffToBe(
                newBalanceAcc, oldBalanceAcc, g_ratios[0].mul(g_total_deposit).mul(0.6),
                "Did not withdraw the expected amount of ETH"
            );
            expectDiffToBe(
                newBalanceWHG, oldBalanceWHG, g_ratios[0].mul(g_total_deposit).mul(0.4),
                "Did not donate the expected amount of ETH"
            );
    	    done();
        });

    });

    it('should sign and use proxyWithdraw to get 100% of ones portion', function(done) {
        this.timeout(40000);
        var percentageWHG = 0;
	    signIntent(ethConnector.accounts[3], ethConnector.accounts[3], percentageWHG, function (err, sres) {
            async.series([
                function(cb) {
                    ethConnector.web3.eth.getBalance(ethConnector.accounts[3], cb);
                }, function(cb) {
                    ethConnector.web3.eth.getBalance(whgAcc, cb);
                }, function(cb) {
    		        withdraw.proxyWithdraw(
                        ethConnector.accounts[3],
                        percentageWHG,
                        sres.v,
                        sres.r,
                        sres.s,
                        {from: ethConnector.accounts[9]},
                        cb
                    );
    	        }, function(cb) {
    		        ethConnector.web3.eth.getBalance(ethConnector.accounts[3], cb);
    	        }, function(cb) {
    		        ethConnector.web3.eth.getBalance(whgAcc, cb);
    	        },
            ], function (err, results) {
                assert.ifError(err);
    	        var oldBalanceAcc = new BigNumber(results[0]);
    	        var oldBalanceWHG = new BigNumber(results[1]);
    	        var newBalanceAcc = new BigNumber(results[3]);
    	        var newBalanceWHG = new BigNumber(results[4]);

                expectDiffToBe(
                    newBalanceAcc, oldBalanceAcc, g_ratios[3].mul(g_total_deposit),
                    "Did not withdraw the expected amount of ETH"
                );
                expectDiffToBe(
                    newBalanceWHG, oldBalanceWHG, new BigNumber(0),
                    "Did not donate the expected amount of ETH"
                );
    	        done();
            });
        });

    });

    it('should sign and use proxyWithdraw to get 57% of ones portion', function(done) {
        this.timeout(40000);
        var percentageWHG = 43;
	    signIntent(ethConnector.accounts[2], ethConnector.accounts[2], percentageWHG, function (err, sres) {
            async.series([
                function(cb) {
                    ethConnector.web3.eth.getBalance(ethConnector.accounts[2], cb);
                }, function(cb) {
                    ethConnector.web3.eth.getBalance(whgAcc, cb);
                }, function(cb) {
    		        withdraw.proxyWithdraw(
                        ethConnector.accounts[2],
                        percentageWHG,
                        sres.v,
                        sres.r,
                        sres.s,
                        {from: ethConnector.accounts[9]},
                        cb
                    );
    	        }, function(cb) {
    		        ethConnector.web3.eth.getBalance(ethConnector.accounts[2], cb);
    	        }, function(cb) {
    		        ethConnector.web3.eth.getBalance(whgAcc, cb);
    	        },
            ], function (err, results) {
                assert.ifError(err);
    	        var oldBalanceAcc = new BigNumber(results[0]);
    	        var oldBalanceWHG = new BigNumber(results[1]);
    	        var newBalanceAcc = new BigNumber(results[3]);
    	        var newBalanceWHG = new BigNumber(results[4]);

                expectDiffToBe(
                    newBalanceAcc, oldBalanceAcc, g_ratios[2].mul(g_total_deposit).mul(0.57),
                    "Did not withdraw the expected amount of ETH"
                );
                expectDiffToBe(
                    newBalanceWHG, oldBalanceWHG, g_ratios[2].mul(g_total_deposit).mul(0.43),
                    "Did not donate the expected amount of ETH"
                );
    	        done();
            });
        });

    });

    it('should deposit from a newly certified account', function(done) {
        this.timeout(40000);
        var fundsToDeposit = ethConnector.web3.toWei(20, 'ether');
	    g_total_deposit = g_total_deposit.add(fundsToDeposit);
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
	    var previous_deposit = ethConnector.web3.toWei(10, 'ether');
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
	        expectNumbersEqual(
		        g_ratios[1].mul(previous_deposit),
		        paidOut,
		        "Mismatch in what should have already been paid out"
	        );
            expectDiffToBe(
                newBalance, oldBalance,
		        g_ratios[1].mul(g_total_deposit).minus(paidOut),
                "Did not withdraw the expected amount of ETH"
            );
            done();
    	});
    });

    it('should withdraw 70% of ones portion after topping up', function(done) {
        this.timeout(40000);
	    var previous_deposit = ethConnector.web3.toWei(10, 'ether');
        async.series([
            function(cb) {
                ethConnector.web3.eth.getBalance(ethConnector.accounts[0], cb);
            } , function(cb) {
                ethConnector.web3.eth.getBalance(whgAcc, cb);
            } , function(cb) {
    		withdraw.getPaidOut(ethConnector.accounts[0], cb);
            } , function(cb) {
    		withdraw.withdraw(ethConnector.accounts[0], 30, {from: ethConnector.accounts[0]}, cb);
    	    }, function(cb) {
    		ethConnector.web3.eth.getBalance(ethConnector.accounts[0], cb);
    	    }, function(cb) {
    		ethConnector.web3.eth.getBalance(whgAcc, cb);
    	    },
        ], function (err, results) {
            assert.ifError(err);
    	    var oldBalanceAcc = new BigNumber(results[0]);
    	    var oldBalanceWHG = new BigNumber(results[1]);
            var paidOut = new BigNumber(results[2]);
    	    var newBalanceAcc = new BigNumber(results[4]);
    	    var newBalanceWHG = new BigNumber(results[5]);

	    expectNumbersEqual(
		g_ratios[0].mul(previous_deposit),
		paidOut,
		"Mismatch in what should have already been paid out"
	    );
            expectDiffToBe(
                newBalanceAcc, oldBalanceAcc, g_ratios[0].mul(g_total_deposit).minus(paidOut).mul(0.7),
                "Did not withdraw the expected amount of ETH"
            );
            expectDiffToBe(
                newBalanceWHG, oldBalanceWHG, g_ratios[0].mul(g_total_deposit).minus(paidOut).mul(0.3),
                "Did not donate the expected amount of ETH"
            );
    	    done();
        });

    });

    it('should proxy withdraw 91% of ones portion after topping up', function(done) {
        this.timeout(40000);
	    var previous_deposit = ethConnector.web3.toWei(10, 'ether');
        var percentageWHG = 9;
        signIntent(ethConnector.accounts[2], ethConnector.accounts[2], percentageWHG, function (err, sres) {
            async.series([
                function(cb) {
                    ethConnector.web3.eth.getBalance(ethConnector.accounts[2], cb);
                } , function(cb) {
                    ethConnector.web3.eth.getBalance(whgAcc, cb);
                } , function(cb) {
    		        withdraw.getPaidOut(ethConnector.accounts[2], cb);
                } , function(cb) {
    		        withdraw.proxyWithdraw(
                        ethConnector.accounts[2],
                        percentageWHG,
                        sres.v,
                        sres.r,
                        sres.s,
                        {from: ethConnector.accounts[9]},
                        cb
                    );
    	        }, function(cb) {
    		        ethConnector.web3.eth.getBalance(ethConnector.accounts[2], cb);
    	        }, function(cb) {
    		        ethConnector.web3.eth.getBalance(whgAcc, cb);
    	        },
            ], function (err, results) {
                assert.ifError(err);
    	        var oldBalanceAcc = new BigNumber(results[0]);
    	        var oldBalanceWHG = new BigNumber(results[1]);
                var paidOut = new BigNumber(results[2]);
    	        var newBalanceAcc = new BigNumber(results[4]);
    	        var newBalanceWHG = new BigNumber(results[5]);

	            expectNumbersEqual(
		            g_ratios[2].mul(previous_deposit),
		            paidOut,
		            "Mismatch in what should have already been paid out"
	            );
                expectDiffToBe(
                    newBalanceAcc, oldBalanceAcc, g_ratios[2].mul(g_total_deposit).minus(paidOut).mul(0.91),
                    "Did not withdraw the expected amount of ETH"
                );
                expectDiffToBe(
                    newBalanceWHG, oldBalanceWHG, g_ratios[2].mul(g_total_deposit).minus(paidOut).mul(0.09),
                    "Did not donate the expected amount of ETH"
                );
    	        done();
            });
        });

    });
});
