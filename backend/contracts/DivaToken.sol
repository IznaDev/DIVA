// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title DivaToken
/// @notice Token ERC20 avec support des signatures EIP-2612 (permit)
contract DivaToken is ERC20, ERC20Permit, Ownable {
    uint256 constant I_ADDRESSES_LENGTH = 4;

    address[I_ADDRESSES_LENGTH] foundersList = [
        0x1234567890123456789012345678901234567890,
        0x2345678901234567890123456789012345678901,
        0x3456789012345678901234567890123456789012,
        0x4567890123456789012345678901234567890123
    ];

    /// @notice Initialise le token et distribue l'approvisionnement initial
    constructor() ERC20("DivaToken", "DIVA") ERC20Permit("DivaToken") {
        transferOwnership(msg.sender);
        uint256 initialSupply = 100000000 * 10 ** decimals();

        for (uint256 i = 0; i < I_ADDRESSES_LENGTH; i++) {
            mint(foundersList[i], initialSupply);
        }
    }

    /// @notice Crée de nouveaux tokens
    /// @param to Adresse du destinataire
    /// @param _amount Montant à créer
    /// @return Succès de l'opération
    function mint(address to, uint256 _amount) public onlyOwner returns (bool) {
        _mint(to, _amount);
        return true;
    }
}
