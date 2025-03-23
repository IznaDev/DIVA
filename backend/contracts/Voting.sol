// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Voting is Ownable {
    IERC20 public divaToken;
    IERC20 public mockUSDC;

    constructor(address _divaToken, address _mockUSDC) Ownable() {
        divaToken = IERC20(_divaToken);
        mockUSDC = IERC20(_mockUSDC);
    }
}
