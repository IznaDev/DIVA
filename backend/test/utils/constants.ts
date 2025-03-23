import { ethers } from "hardhat";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const VOTE_STAKE_AMOUNT = ethers.parseEther("10");
export const INITIAL_MINT_AMOUNT = ethers.parseEther("100000000");

export const VOTING_PERIOD_DAYS = 3;
export const VOTING_PERIOD_SECONDS = VOTING_PERIOD_DAYS * 24 * 3600;