// The contract that allows DTH to withdraw funds that the white hat
// group has managed to retrieve.
//
// There are 3 ways to use the contract:
// 1. withdraw()
// 2. proxyWithdraw()
// 3. botWithdraw()
//
// For a description of each method, take a look at the docstrings.
//
// License: BSD3

contract DAOBalanceSnapShot {
    function balanceOf(address _dth) constant returns(uint);
    function totalSupply() constant returns(uint );
}


contract Owned {
    /// Prevents methods from perfoming any value transfer
    modifier noEther() {if (msg.value > 0) throw; _}
    /// Allows only the owner to call a function
    modifier onlyOwner { if (msg.sender != owner) throw; _ }

    address owner;

    function Owned() { owner = msg.sender;}



    function changeOwner(address _newOwner) onlyOwner {
        owner = _newOwner;
    }

    function getOwner() noEther constant returns (address) {
        return owner;
    }
}

contract WhitehatWithdraw is Owned {
    /// The balances of the DTH taken in the snapshot block. TBD

    DAOBalanceSnapShot daoBalance;
    mapping (address => uint) paidOut;
    mapping (address => bool) certifiedDepositors;
    uint totalFunds;
    uint deployTime;
    address whg_donation;
    address bot;
    address escape;
    address remainingBeneficary;

    event Withdraw(address indexed dth, address indexed beneficiary, uint256  amountToDth, uint256 amountToWhg);
    event CertifiedDepositorsChanged(address indexed _depositor, bool _allowed);
    event Deposit(uint amount);
    event EscapeCalled(uint amount);
    event RemainingClaimed(uint amount);

    function WhitehatWithdraw(address _whg_donation, address _daoBalanceSnapshotAddress, address _botAddress, address _escapeAddress, address _remainingBeneficiary) {
        whg_donation = _whg_donation;
        daoBalance = DAOBalanceSnapShot(_daoBalanceSnapshotAddress);
        bot = _botAddress;
        escape = _escapeAddress;
        remainingBeneficary = _remainingBeneficiary;

        totalFunds = msg.value;
        deployTime = now;

        // both the owner and the whitehat multisig can perform deposits to this contract
        certifiedDepositors[0x1ac729d2db43103faf213cb9371d6b42ea7a830f] = true;
        certifiedDepositors[msg.sender] = true;
    }

    /// Calculates the remaining funds available for a DTH to withdraw
    ///
    /// @param _dth          The address of the DAO Token Holder for whom
    ///                      to get the funds remaining for withdrawal
    /// @return              The amount of funds remaining for withdrawal
    function calculateWithdraw(address _dth) constant noEther returns(uint) {
        uint tokens = daoBalance.balanceOf(_dth);

        uint acumulatedReward = tokens * totalFunds / daoBalance.totalSupply();
        if (acumulatedReward < paidOut[_dth]) {
            return 0;
        }

        return acumulatedReward - paidOut[_dth];
    }

    /// The core of the withdraw functionality. It is called by all other withdraw functions
    ///
    /// @param _percentage    The percentage of the funds that the DTH wants to keep
    ///                       for himself. It should be a number ranging from 0
    ///                       to 100. Anything not claimed by the DTH will be going
    ///                       as a donation to the Whitehat Group.
    /// @param _dth           The address of the DAO token holder for whom the
    ///                       withdrawal is going to happen
    /// @param _beneficiary   The address that will receive the _percentage of
    ///                       the funds corresponding to the _dth.
    function commonWithdraw(uint _percentage, address _dth, address _beneficiary) internal {
        if (_percentage > 100) {
            return;
        }

        uint toPay = calculateWithdraw(_dth);
        if (toPay == 0) {
            return;
        }

        if (toPay > this.balance)
            toPay = this.balance;

        uint portionDth = toPay * _percentage / 100;
        uint portionWhg = toPay - portionDth;
        paidOut[_dth] += toPay;

        if ( !whg_donation.send(portionWhg) ||  !_beneficiary.send(portionDth) ) {
            throw;
        }

        Withdraw(_dth, _beneficiary,  portionDth, portionWhg);
    }

    /// The simple withdraw function, where the message sender is considered as
    /// the DAO token holder whose ratio needs to be retrieved.
    function withdraw(uint _percentage, address _beneficiary) noEther {
        commonWithdraw(_percentage, msg.sender, _beneficiary);
    }

    /// The proxy withdraw function. Anyone can call this for someone else as long
    /// as he includes signed data retrieved by using web3.eth.sign(address, hash).
    /// The DAO token holder whose ratio needs to be retrieved is determined by
    /// performing ecrecover on the signed data.
    function proxyWithdraw(uint _percentage, address _beneficiary, uint8 _v, bytes32 _r, bytes32 _s) noEther {
        bytes32 _hash = sha3("Withdraw DAOETC to ", _beneficiary, _percentage);
        address _dth = ecrecover(_hash, _v, _r, _s);
        commonWithdraw(_percentage, _dth, _beneficiary);
    }

    /// The bot withdraw function is a function that the only "the bot" can call.
    /// Once a user who does not use the ETC chain has used the bot withdraw the
    /// bot will use this function to perform withdrawal for that user.
    ///
    /// Bot Withdrawal is primarily for users who do not want to synchronize the ETC
    /// chain and would rather prove ownership in the ETH chain and provide a beneciary
    /// ETC address for the bot to withdraw to. This could allow for people to withdraw
    /// directly to an exchange's deposit address without sycnronizing the ETC chain.
    function botWithdraw(uint _percentage, address _dth, address _beneficiary) noEther {
        if (msg.sender != bot) {
            throw;
        }
        commonWithdraw(_percentage, _dth, _beneficiary);
    }

    /// This is the only way to send money to the contract, adding to the total
    /// amount of ETH to be refunded.
    ///
    /// Only people who are considered certified depositors like the whitehat ETC multisig
    /// or addresses owned by exchanges should be able to deposit more ETC for withdrals.
    /// If you need to become a certified depositor please contact Bity SA.
    function deposit() returns (bool) {
        if (!certifiedDepositors[msg.sender]) {
            throw;
        }
        totalFunds += msg.value;
        Deposit(msg.value);
        return true;
    }

    /// Last Resort call, to allow for a reaction if something bad happens to
    /// the contract or if some security issue is uncovered.
    function escapeHatch() noEther onlyOwner returns (bool) {
        uint total = this.balance;
        escape.send(total);
        EscapeCalled(total);
    }

    /// Allows the claiming of the remaining funds after a given amount of time
    /// Amount is set to 6 months for now but may still change in the future.
    function claimRemaining() noEther returns (bool) {
        if (now < deployTime + 24 weeks) {
            throw;
        }
        uint total = this.balance;
        remainingBeneficary.send(total);
        RemainingClaimed(total);
    }

    function () { //no donations
        throw;
    }

    function getPaidOut(address _account) noEther constant returns (uint) {
        return paidOut[_account];
    }

    function getMyBalance(address _account) noEther constant returns (uint) {
        return daoBalance.balanceOf(_account);
    }

    function getTotalFunds() noEther constant returns (uint) {
        return totalFunds;
    }

    function getWHGDonationAddress() noEther constant returns (address) {
        return whg_donation;
    }

    function getBotAddress() noEther constant returns (address) {
        return bot;
    }

    function isCertifiedDepositor(address _depositor) noEther constant returns (bool) {
        return certifiedDepositors[_depositor];
    }

    function changeCertifiedDepositors(address _depositor, bool _allowed) onlyOwner noEther external returns (bool _success) {
        certifiedDepositors[_depositor] = _allowed;
        CertifiedDepositorsChanged(_depositor, _allowed);
        return true;
    }
}
