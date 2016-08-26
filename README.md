# Whitehat ETC Withdraw Contract

This is the suggested withdraw contract for the ETC retrieved by the whitehat group from the DAO.
DAO Token Holders can withdraw their proportion of ETC from the amount that has already been deposited in the contract.

Until deployed in the ETC blockchain this is going to be a work in progress and interested parties in the community are invited to
discuss potential issues and contribute to it.

The balances considered to be the DAO token holder's balance are those taken as a snapshot at the
last block before the Hard Fork. The reasoning for this and the reason why DAO-C balances were not
used can be further seen in the [Reasoning](#reasoning) section.

People can withdraw as many times as they want. The contract may not initially have all the ETC that will be given to the DAO Token Holders. Some is still stuck in 1 attack DAOs and will be retrieved in the future. Additionally the exchanges may want to deposit directly to the withdraw contract. For those reasons DTH can reuse the contract as many times as they want to retrieve additional ETC each time the contract is topped up.

At each withdrawal, the DTH will be asked what percentage of his portion of ETC he would like to donate to the whitehat group for all the work they did in order to secure the ETH/ETC and make this return of value possible in the first place.

## Usage

There are 2 ways to use the contract:
1. withdraw()
2. proxyWithdraw()

They all accept a beneficiary address and a percentage. The beneficiary address will be the ETC address that will receive the ETC from the withdrawal while the percentage is what percentage (0-100) of the users ETC portion he would like to donate to the whitehat group.

### withdraw()

This is the simple withdraw function, where the message sender is considered as the DAO token holder whose ratio needs to be retrieved.

### proxyWithdraw()

The proxy withdraw function. Anyone can call this for someone else as long as he includes signed data retrieved by using web3.eth.sign(address, hash). The DAO token holder whose ratio needs to be retrieved is determined by performing ecrecover on the signed data.

This is also going to be used as a means to facilitate people withdrawing in the ETC chain without having to sync it but instead by performing an approval in the ETH chain. We would like to offer the ability to users to grant such approvals in the ETH chain and then we can perform the ETC withdrawal to a beneficiary address of their choice in the ETC chain. If users do not want to use the ETC chain at all, the beneficiary address could simply be the deposit address of an exchange. The only limitation to this is that the account that held the DAO balance has to be an end-user account. To see what you can do if you held DAO in a contract please check the [Next Section](#contractaccounts)

## ContractAccounts

Contract accounts (eg: multisig wallets) have the limitation that they can't use `web3.eth.sign()`. In the past we had designed a `botWithdraw()` function that also allowed contract wallets to withdraw using only the ETH chain and avoid syncing the ETC chain and the replay attacks that could come off as a result of that. After evaluating all of the community's feedback and after a lot of heated internal debate we removed it as a possible security risk which was also complicating the contract and the entire refund process.

Instead the people who held DAO at a contract have two choices.

1. If they want they can simply sync the ETC chain, copy their keys over, make absolutely sure they are protected from replay attacks and claim their
portion of the funds directly in the ETC chain.

2. Until the deployment of the withdrawal contract we have deployed the [`whauthorizeaddress.sol`](http://etherscan.io/address/0xd4fb7fd0c254a8c6211e441f7236fa9479708a99#code) contract in the ETH chain. This will give people who held DAO in a contract the ability to authorize an end-user address to get their claim for them. Before deploying the actual withdrawal contract, the authorization contract will terminate and a mapping of contractaccounts -> authorized-enduser-accounts will be created. During the actual withdrawal this mapping will be used and allow people who held DAO at a contract to use only the ETH chain to get their refund by using [proxyWithdraw()](#proxywithdraw)

## Reasoning

### Why not burn people's tokens at withdrawal?

Since the withdraw contract will be topped up multiple times, DTH will need to use their balance
multiple times. Additionally at some point perhaps even the "Dark DAO attacker" may want to return
his funds in a fair manner and people may still need to prove DAO balances once more.

### Why use a snapshot instead of a DAO-C balance?

In combination with the answer to the previous question:

Not burning tokens means that a snapshot of balances is needed instead of taking the current balance in DAO-C. The reason is that DAO-C tokens are still transferrable and people could claim a refund, then transfer to another address and attempt to claim a refund again. 


## Tests

To run the tests you can use [Mocha](https://mochajs.org/) and simply run: `mocha tests/deploy.js`.
