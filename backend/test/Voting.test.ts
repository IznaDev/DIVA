import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployDivaToken, deployMockUSDC, deployVoting } from "./utils/fixtures";

describe("2. Voting contract tests:", function () {
    let voting: any;
    let divaToken: any;
    let mockUSDC: any;
    before(async function () {
        const votingFixture = await loadFixture(deployVoting);
        voting = votingFixture.voting;
        divaToken = votingFixture.divaToken;
        mockUSDC = votingFixture.mockUSDC;
    })
    describe("2.1 Deployment tests", function () {
        it("should set the DivaToken address", async function () {
            expect(await voting.divaToken()).to.equal(await divaToken.getAddress());
        });
        it("should set the MockUSDC address", async function () {
            expect(await voting.mockUSDC()).to.equal(await mockUSDC.getAddress());
        });

    })
})