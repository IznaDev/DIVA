// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DivaToken is ERC20, Ownable {
    uint256 public conversionRate = 10;
    uint256 constant I_ADDRESSES_LENGTH = 3;

    address[4] initialAddresses = [
        0x1234567890123456789012345678901234567890,
        0x2345678901234567890123456789012345678901,
        0x3456789012345678901234567890123456789012,
        0x4567890123456789012345678901234567890123
    ];

    constructor() ERC20("DivaToken", "DIVA") {
        transferOwnership(msg.sender);
        uint256 initialSupply = 100000000 * 10 ** decimals();

        for (uint256 i = 0; i < I_ADDRESSES_LENGTH; i++) {
            mint(initialAddresses[i], initialSupply);
        }
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
