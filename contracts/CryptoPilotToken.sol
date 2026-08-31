// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Testnet utility-token prototype for CryptoPilot.
/// @dev No public-sale, yield, revenue-share or price-support mechanics are included.
contract CryptoPilotToken is ERC20, ERC20Capped, Ownable {
    uint256 public constant MAX_SUPPLY = 100_000_000 ether;

    constructor(address treasury)
        ERC20("CryptoPilot Token", "CPT")
        ERC20Capped(MAX_SUPPLY)
        Ownable(treasury)
    {
        _mint(treasury, MAX_SUPPLY);
    }
}
