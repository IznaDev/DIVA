import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployMockUSDC } from "./utils/fixtures";

let mockUSDC: any;
let owner: any;


describe("3. MockUSDC contract tests:", function () {
    before(async function () {
        const mockUSDCFixture = await loadFixture(deployMockUSDC);
        mockUSDC = mockUSDCFixture.mockUSDC;
        owner = mockUSDCFixture.owner;
    })
    describe("3.1 Deployment tests", function () {
        it("should have correct name & symbol", async function () {
            expect(await mockUSDC.name()).to.equal("MockUSDC");
            expect(await mockUSDC.symbol()).to.equal("MUSDC");
        })
    })
    describe("3.2 Minting tests", function () {
        it("should allow owner to mint tokens", async function () {
            const ownerBalance = await mockUSDC.balanceOf(owner);
            expect(ownerBalance).to.equal(0);
            const amount = ethers.parseEther("100");
            await mockUSDC.mint(owner, amount);
            const finalBalance = await mockUSDC.balanceOf(owner);
            expect(finalBalance).to.equal(amount);
        })
    })
})