import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Contract } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";


export async function createTestPost(
    voting: Contract,
    poster: HardhatEthersSigner,
    url: string,
    stakeAmount: bigint
) {
    return await voting.connect(poster).createPost(url, stakeAmount);
}

export async function voteOnTestPost(
    voting: Contract,
    voter: HardhatEthersSigner,
    postId: number,
    isTrue: boolean,
    isFake: boolean,
    stakeAmount: bigint
) {
    return await voting.connect(voter).voteOnPost(postId, isTrue, isFake, stakeAmount);
}

export async function advanceTime(days: number) {
    await time.increase(days * 24 * 3600);
}