// SPDX=Licence-Identifier: MIT

pragma solidity ^0.8.19;
import "@oppenzeppelin/contracts/token/ERC20/ERC20.sol";
import "@prb/math/SD59x18.sol";
import "forge-std/console.sol";

contract LJtok is ERC20 {
    //esave: stores energy values for different number of particles
    //possave: stores positions for different number of particles
    //maxlen: maximum number of particles
    //costview: cost to view data
    //minexchangeRate: minimum exchange rate for the owner of the contract
    //initialSupply: initial supply of tokens for the owner of the contract
    //minchange: minimum change in energy to accept a new configuration
    //exchangeRate: exchange rate for each account
    //owner: owner of the contract
    //topBalances: top 10 balances
    //topRates: top 10 exchange rates
    //accAccess: Cluster sizes that each account has access to
    mapping(uint256 => int256) public esave;
    mapping(uint256 => uint256[]) public possave;
    uint256 public maxlen;
    uint256 public costview;
    uint256 public minexchangeRate = 1000;
    uint256 public initialSupply = 10000000;
    int256 minchange = 103;
    mapping(address => uint256) public exchangeRate;
    address payable public owner;
    struct TopSave {
        uint balance;
        address addr;
    }
    TopSave[10] public topBalances;
    TopSave[10] public topRates;
    mapping(address => uint256[]) public accAccess;

    constructor() ERC20("LJtoken", "LJT") {
        owner = payable(msg.sender);
        _mint(owner, initialSupply * 10 ** uint(decimals()));
        exchangeRate[owner] = minexchangeRate;
        elaborateTopBalance(owner);
        elaborateTopRate(owner);
        maxlen = 50;
        costview = 1;
    }

    //Initialize called by owner
    function init_owner(uint256 npart) public {
        require(msg.sender == owner, "Need to be owner");
        require(npart <= maxlen, "Maximum particle is 50");
        require(npart > 1, "Number of particle should be greater than 1");
        uint256[] memory pos = new uint256[](npart * 3);
        pos = init_sc(npart);
        int256 energy = calcEnergy(pos);
        esave[npart] = energy;
        possave[npart] = pos;
    }

    //Initialize the energy and positions as simple cubic lattice
    function init_sc(uint256 npart) private pure returns (uint256[] memory) {
        uint ndim = intoUint256(
            ceil(convert(int(npart)).pow(convert(1).div(convert(3))))
        ) / 10 ** 18;
        uint xnow = 0;
        uint ynow = 0;
        uint znow = 0;
        uint ntot = npart * 3;
        uint multconst = 1122462;
        uint256[] memory pos = new uint256[](ntot);
        for (uint i1 = 0; i1 < npart; i1++) {
            pos[i1 * 3] = xnow * multconst;
            pos[i1 * 3 + 1] = ynow * multconst;
            pos[i1 * 3 + 2] = znow * multconst;
            xnow = xnow + 1;
            if (xnow >= ndim) {
                xnow = 0;
                ynow = ynow + 1;
                if (ynow >= ndim) {
                    ynow = 0;
                    znow = znow + 1;
                }
            }
        }
        return pos;
    }

    //Accounts with top balances are tracked.
    function elaborateTopBalance(address account) private {
        uint8 removeIndex = 20;
        for (uint8 i = 0; i < topBalances.length; i++) {
            if (topBalances[i].addr == account) {
                removeIndex = i;
            }
        }

        if (removeIndex != 20) {
            for (uint8 j = removeIndex; j < topBalances.length - 1; j++) {
                topBalances[j] = topBalances[j + 1];
            }
            delete topBalances[topBalances.length - 1];
        }

        uint256 balance = balanceOf(account);
        for (uint8 i = 0; i < topBalances.length; i++) {
            if (balance > topBalances[i].balance) {
                for (uint8 j = 9; j > i; j--) {
                    topBalances[j] = topBalances[j - 1];
                }

                topBalances[i].balance = balance;
                topBalances[i].addr = account;
                return;
            }
        }
    }

    //Accounts with top rates are tracked.
    function elaborateTopRate(address account) private {
        uint8 removeIndex = 20;
        for (uint8 i = 0; i < topRates.length; i++) {
            if (topRates[i].addr == account) {
                removeIndex = i;
            }
        }

        if (removeIndex != 20) {
            for (uint8 j = removeIndex; j < topRates.length - 1; j++) {
                topRates[j] = topRates[j + 1];
            }
            delete topRates[topRates.length - 1];
        }

        uint256 balance = exchangeRate[account];
        for (uint8 i = 0; i < topRates.length; i++) {
            if (balance > topRates[i].balance) {
                for (uint8 j = 9; j > i; j--) {
                    topRates[j] = topRates[j - 1];
                }

                topRates[i].balance = balance;
                topRates[i].addr = account;
                return;
            }
        }
    }

    //Returns the top 10 accounts with highest rates
    function viewTopRate()
        public
        view
        returns (address[10] memory, uint256[10] memory)
    {
        address[10] memory addresses;
        uint256[10] memory rates;
        for (uint i = 0; i < topRates.length; i++) {
            addresses[i] = topRates[i].addr;
            rates[i] = topRates[i].balance;
        }
        return (addresses, rates);
    }

    //Returns the top 10 accounts with highest balances
    function viewTopBalance()
        public
        view
        returns (address[10] memory, uint256[10] memory)
    {
        address[10] memory addresses;
        uint256[10] memory balances;
        for (uint i = 0; i < topBalances.length; i++) {
            addresses[i] = topBalances[i].addr;
            balances[i] = topBalances[i].balance;
        }
        return (addresses, balances);
    }

    //Mines a new token and stores the energy and positions if the energy is lower than the stored value
    function mineToken(uint256[] memory pos) public returns (int256) {
        require(
            pos.length % 3 == 0,
            "Invalid input: position array length must be a multiple of 3"
        );
        uint256 nlen = pos.length / 3;
        require(nlen <= maxlen, "Maximum particle is 50");
        require(nlen > 1, "Number of particle should be greater than 1");
        int256 energy = calcEnergy(pos);
        require(
            energy < ((esave[nlen] * minchange) / 100),
            "Energy is not lower than the value in the contract"
        );
        // Mint 10 tokens to the message sender
        _mint(msg.sender, 10 * 10 ** uint(decimals()));
        elaborateTopBalance(msg.sender);
        esave[nlen] = energy;
        possave[nlen] = pos;
        return energy;
    }

    //Calculates the energy of a configuration
    function calcEnergy(uint256[] memory pos) public pure returns (int256) {
        SD59x18 energy;
        SD59x18 dist;
        uint256 nlen = pos.length / 3;
        energy = sd(0);
        for (uint i1 = 0; i1 < nlen - 1; i1++) {
            for (uint i2 = i1 + 1; i2 < nlen; i2++) {
                dist = sd(0);
                for (uint j = 0; j < 3; j++) {
                    SD59x18 temp = SD59x18
                        .wrap(int(pos[i1 * 3 + j]) * 10 ** 12)
                        .sub(SD59x18.wrap(int(pos[i2 * 3 + j]) * 10 ** 12));
                    dist = dist.add(temp.mul(temp));
                }
                SD59x18 sr2 = dist.inv();
                SD59x18 sr6 = sr2.mul(sr2).mul(sr2);
                SD59x18 sr12 = sr6.mul(sr6);
                SD59x18 etemp = sr12.sub(sr6);
                energy = energy.add(etemp);
            }
        }
        return unwrap(energy.mul(sd(4.0e18)));
    }

    //User can buy LJT from other accounts
    function buyToken(address account) public payable {
        require(msg.value > 0, "Ether value must be greater than 0.");
        //If the user has not set up the exchange rate, set it equal to the owner of the contract.
        if (exchangeRate[account] == 0) {
            exchangeRate[account] = exchangeRate[owner];
        }
        uint256 amountToBuy = msg.value * exchangeRate[account];
        require(
            amountToBuy <= balanceOf(account),
            "Not enough tokens available in the account"
        );
        _transfer(account, msg.sender, amountToBuy);
        elaborateTopBalance(account);
        elaborateTopBalance(msg.sender);
        payable(account).transfer(msg.value);
    }

    //Contract owner can set the exchange rate
    function setexrateowner(uint256 rater) public {
        require(msg.sender == owner, "Need to be owner");
        require(
            rater > minexchangeRate,
            "Rate needs to be higher than max rate"
        );
        exchangeRate[owner] = rater;
        elaborateTopRate(owner);
    }

    //User can set the exchange rate
    function setExchangeRate(uint256 rater) public {
        exchangeRate[msg.sender] = rater;
        elaborateTopRate(msg.sender);
    }

    //Returns the exchange rate of an address
    function getexrate(
        address account
    ) external view returns (uint256, uint256) {
        return (balanceOf(account), exchangeRate[account]);
    }

    //User gains access to a cluster data by paying LJT equivalent to costview
    function gainAccess(uint256 _value) public {
        require(
            balanceOf(msg.sender) > costview * 10 ** uint(decimals()),
            "Not enough tokens"
        );
        bool checker = true;
        for (uint256 i = 0; i < accAccess[msg.sender].length; i++) {
            if (accAccess[msg.sender][i] == _value) {
                checker = false;
            }
        }
        require(checker, "You already have access to this data");
        _transfer(msg.sender, owner, costview * 10 ** uint(decimals()));
        accAccess[msg.sender].push(_value);
    }

    //User can view the cluster sizes that they have access to
    function viewAccess() external view returns (uint256[] memory) {
        return accAccess[msg.sender];
    }

    //User can view the data of a cluster that they have access to
    function viewData(
        uint256 nlen
    ) external view returns (int256, uint256[] memory) {
        require(nlen <= maxlen, "Maximum particle is 50");
        bool checker;
        for (uint256 i = 0; i < accAccess[msg.sender].length; i++) {
            if (accAccess[msg.sender][i] == nlen) {
                checker = true;
            }
        }
        require(checker, "You do not have access to this data");
        return (esave[nlen], possave[nlen]);
    }
}
