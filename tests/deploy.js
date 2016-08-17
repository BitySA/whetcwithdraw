"use strict";

var ethConnector = require('./js/eth_connector');
var simplewithdrawHelper = require('./js/simplewithdraw_helper');
var snapshotHelper = require('./js/dao_balance_snapshot_helper');
var assert = require('assert');
var async = require('async');
var BigNumber = require('bignumber.js');

var D160 = new BigNumber("10000000000000000000000000000000000000000",16);


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
            console.log("Snapshot Address: " + snapshot.address);
            done();
        });
    });

    it('should deploy Withdraw Contract', function(done) {
        this.timeout(40000);
        simplewithdrawHelper.deploy({
            _whg_donation: ethConnector.accounts[2],
            _daoBalanceSnapshotAddress: snapshot.address,
            _botAddress: ethConnector.accounts[0]
        }, function(err, contract) {
            assert.ifError(err);
            assert.ok(contract);
            withdraw = contract;
            console.log("Withdraw Contract Address: " + withdraw.address);
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
        withdraw.deposit(
            {from: ethConnector.accounts[0],
             value: fundsToDeposit
            }, function(err) {
                assert.ifError(err);
                withdraw.getTotalFunds(
                    {from: ethConnector.accounts[0]
                    }, function (err, res) {
                        assert.ifError(err);
                        console.log("Total funds are: " +res);
                        assert.equal(
                            res,
                            fundsToDeposit,
                            "Total funds mismatch"
                        );
                        done();
                    });
            });
    });

    it('should calculate ones token balance from withdraw contract', function(done) {
        this.timeout(40000);
        withdraw.getMyBalance(
            ethConnector.accounts[1],
            function (err, res) {
                assert.ifError(err);
                console.log("Our balance is: " + res);
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
                console.log("Our withdraw is: " + res);
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
        ethConnector.web3.eth.getBalance(
            ethConnector.accounts[1]
            ,function (err, res) {
                assert.ifError(err);
                oldBalance = res;
                withdraw.withdraw(
                    100,
                    ethConnector.accounts[1],
                    {from: ethConnector.accounts[1]
                    }, function (err) {
                        assert.ifError(err);
                        ethConnector.web3.eth.getBalance(
                            ethConnector.accounts[1]
                            ,function (err, res) {
                                assert.ifError(err);
                                newBalance = res;
                                assert(
                                    oldBalance.add("6666666666666666666").minus(newBalance).lt(90000),
                                    "Did not withdraw the expected amount of ETH"
                                );
                                done();
                            })})});
    });

});
