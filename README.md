# Whitehat ETC Withdraw Contract

This is the suggested withdraw contract for the ETC retrieved by the whitehat group from the DAO.
DAO Token Holders can withdraw their proportion of ETC from the amount that has already been deposited in the contract.

Until deployed in the ETC blockchain this is going to be a work in progress and interested parties in the community are invited to
discuss potential issues and contribute to it.

The balances considered to be the DAO token holder's balance are those taken as a snapshot at the
last block before the Hard Fork. The reasoning for this and the reason why DAO-C balances were not
used can be further seen in the [Reasoning](#reasoning) section.

People can withdraw as many times as they want. The contract may not initially have all the ETC that will be given to the DAO Token Holders. Some is still stuck in 3 attack DAOs and will be retrieved in different times. Additionally the exchanges may want to deposit directly to the withdraw contract. For those reasons DTH can reuse the contract as many times as they want to retrieve additional ETC each time the contract is topped up.

At each withdrawal, the DTH will be asked for the percentage of his portion of ETC that he would like to retrieve. The remaining will be given as a donation to the whitehat group for all the work they did in order to secure the ETH/ETC and make this return of value possible in the first place.

## Usage

There are 3 ways to use the contract:
1. withdraw()
2. proxyWithdraw()
3. botWithdraw()

They all accept a beneficiary address and a percentage. The beneficiary address will be the ETC address that will receive the ETC from the withdrawal while the percentage is what percentage (0-100) of the users ETC portion he would like to retrieve and what would he like to give as a donation.

### withdraw()

This is the simple withdraw function, where the message sender is considered as the DAO token holder whose ratio needs to be retrieved.

### proxyWithdraw()

The proxy withdraw function. Anyone can call this for someone else as long as he includes signed data retrieved by using web3.eth.sign(address, hash). The DAO token holder whose ratio needs to be retrieved is determined by performing ecrecover on the signed data.

### botWithdraw()

The bot withdraw function is a function that only "the bot" can call.
Once a user who does not use the ETC chain has used this option, the
bot will use this function to perform withdrawal for that user.

Bot Withdrawal is primarily for users who do not want to synchronize the ETC
chain and would rather prove ownership in the ETH chain and provide a beneciary
ETC address for the bot to withdraw to. This could allow for people to withdraw
directly to an exchange's deposit address without sycnronizing the ETC chain.

The bot is made possible by the `crosswithdraw.sol` contract which will be deployed in the ETH chain.

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
