var _ = require('lodash');
var Web3 = require('web3');

var web3eth = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
var web3etc = new Web3(new Web3.providers.HttpProvider("http://localhost:8546"));


var whAuthorizeAddressAbi = [];

// TODO Fill the address
var whAuthorizeAddress = web3eth.contract(whAuthorizeAddressAbi).at('');


function getAuthorizations(cb) {
    var authorizations = {};
    var filter = whAuthorizeAddress.Authorize({}, {fromBlock: 2000000});
    filter.get(function(err, authorizeEvents) {
        if (err) return cb(err);
        _.each(authorizeEvents, function(e) {
            authorizations[e.args.dthContract] = {
                dthContract: e.args.dthContract,
                authorizedAddress: e.args.authorizedAddress,
            };
        });
        cb(null, _.values(authorizations));
    });
}


function deployAAContract(cb) {
var authorizedaddressesContract = web3.eth.contract([{"constant":false,"inputs":[],"name":"seal","outputs":[],"type":"function"},{"constant":true,"inputs":[{"name":"_authorizedAddress","type":"address"}],"name":"getRepresentedDTH","outputs":[{"name":"_dth","type":"address"}],"type":"function"},{"constant":false,"inputs":[{"name":"data","type":"uint256[]"}],"name":"fill","outputs":[],"type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"type":"function"},{"constant":true,"inputs":[],"name":"sealed","outputs":[{"name":"","type":"bool"}],"type":"function"},{"inputs":[],"type":"constructor"}]);
    var authorizedaddresses = authorizedaddressesContract.new(
       {
         from: web3.eth.accounts[0],
         data: '60606040525b33600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908302179055505b6103d68061003f6000396000f360606040526000357c0100000000000000000000000000000000000000000000000000000000900480633fb27b8514610065578063607af21614610074578063884b5dc2146100b65780638da5cb5b14610109578063e4b203ef1461014257610063565b005b6100726004805050610167565b005b61008a6004808035906020019091905050610204565b604051808273ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b6101076004808035906020019082018035906020019191908080602002602001604051908101604052809392919081815260200183836020028082843782019150505050505090909190505061026d565b005b610116600480505061039d565b604051808273ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b61014f60048050506103c3565b60405180821515815260200191505060405180910390f35b600034111561017557610002565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161415806101de5750600160149054906101000a900460ff165b156101e857610002565b6001600160146101000a81548160ff021916908302179055505b565b6000600034111561021457610002565b600060005060008373ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050610268565b919050565b600060006000600034111561028157610002565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161415806102ea5750600160149054906101000a900460ff165b156102f457610002565b600092505b8351831015610396578383815181101561000257906020019060200201519150836001840181518110156100025790602001906020020151905081600060005060008373ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908302179055505b60028301925082506102f9565b5b50505050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b600160149054906101000a900460ff168156',
         gas: 4700000
       }, function (err, contract){
        if (err) return cb(err);

        if (typeof contract.address !== 'undefined') {
             console.log('AA Contract mined! address: ' + contract.address + ' transactionHash: ' + contract.transactionHash);
             cb(contract);
        }
    });
}

function fillAAContract(aa, authorizations, cb) {

    var multiple = 50;

    var pos=0;
    async.whilst(
        function() { return pos < authorizations.length; },
        function(cb) {
            var sendAuthorizations = authorizations.slice(pos, pos+multiple);
            var data = [];
            for (var i=0; i<sendAuthorizations.length; i++) {
                var a = sendAuthorizations[i];
                data.push(a.dthContract);
                data.push(a.authorizedAddress);
            }
            pos += multiple;
            aa.fill(data, {from: eth.accounts[0], gas: 3700000}, cb);
        },
        cb
    );
}

function sealContract(aa, cb) {
    aa.seal({from: eth.accounts[0]}, cb);
}

getAuthorizations(function(err, authorizations) {
    if (err) {
        console.log("Error getAuthorizations: " + err);
        process.exit(1);
    }
    deployAAContract(function(err, aa) {
        if (err) {
            console.log("Error deployAAContract: " + err);
            process.exit(1);
        }
        fillAAContract(aa, authorizations, function(err) {
            if (err) {
                console.log("Error fillAAContract: " + err);
                process.exit(1);
            }
            sealContract(aa, function(err) {
                if (err) {
                    console.log("Error sealContract: " + err);
                    process.exit(1);
                }
                console.log("Authorization contract deployed and filled at: " + aa.address);
                process.exit(0);
            });
        });
    });
});
