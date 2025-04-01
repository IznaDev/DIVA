//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockUSDC is ERC20, Ownable, ERC20Permit {
    uint256 constant TEST_ACCOUNTS_LENGTH = 10;

    address[TEST_ACCOUNTS_LENGTH] public test_accounts = [
        address(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266),
        address(0xa0Ee7A142d267C1f36714E4a8F75612F20a79720),
        address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8),
        address(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC),
        address(0x90F79bf6EB2c4f870365E785982E1f101E93b906),
        address(0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199),
        address(0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65),
        address(0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc),
        address(0x976EA74026E726554dB657fA54763abd0C3a0aa9),
        address(0x14dC79964da2C08b23698B3D3cc7Ca32193d9955)
    ];

    constructor() ERC20("MockUSDC", "MUSDC") ERC20Permit("MockUSDC") {
        // Mint initial supply to the deployer (1 million USDC)
        _mint(msg.sender, 1000 * 10 ** 18);
        transferOwnership(msg.sender);

        for (uint256 i = 0; i < TEST_ACCOUNTS_LENGTH; i++) {
            mint(test_accounts[i], 1000 * 10 ** 18);
        }
    }

    /**
     * @dev Mints tokens to the specified address
     * @param to The address that will receive the minted tokens
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Returns the number of decimals used for token - 6 for USDC
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /**
     * @dev Burns tokens from the caller's account
     * @param amount The amount of tokens to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
