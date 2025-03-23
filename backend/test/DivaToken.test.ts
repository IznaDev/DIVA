import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployDivaToken, deployMockUSDC, deployVoting } from "./utils/fixtures";
import { INITIAL_MINT_AMOUNT } from "./utils/constants";



describe("1. DivaToken contract tests:", function () {
    let divaToken: any;
    let owner: any;
    before(async function () {
        const divaTokenFixture = await loadFixture(deployDivaToken);
        divaToken = divaTokenFixture.divaToken;
        owner = divaTokenFixture.owner;
    })
    describe("1.1 Deployment tests", function () {
        it("should have correct name & symbol", async function () {
            expect(await divaToken.name()).to.equal("DivaToken");
            expect(await divaToken.symbol()).to.equal("DIVA");
        })
        it("should assign initial supply of 100 million DIVA to the hardcoded address", async function () {
            const hardcodedAddresses = [
                "0x1234567890123456789012345678901234567890",
                "0x2345678901234567890123456789012345678901",
                "0x3456789012345678901234567890123456789012"
            ];

            for (const address of hardcodedAddresses) {
                const balanceAddress = await divaToken.balanceOf(address);
                expect(balanceAddress).to.equal(INITIAL_MINT_AMOUNT);
            }

        })
    })
    /* describe("1.2 Token purchase tests", function () {
         it("should allow the DApp user to mint tokens", async function () {
             const { divaToken,
                 mockUSDT,
                 voting,
                 poster1, } = await loadFixture(deployVoting);
 
             await divaToken.setAuthorizedContract(await voting.getAddress(), true);
 
             const usdtAmount = ethers.parseEther("100");
             await mockUSDT.mint(poster1.address, usdtAmount);
 
             await mockUSDT.connect(poster1).approve(await divaToken.getAddress(), usdtAmount);
 
             const initialDivaBalance = await divaToken.balanceOf(poster1.address);
 
             await voting.connect(poster1).purchaseDivaToken(usdtAmount);
 
             const expectedDivaAmount = usdtAmount / BigInt(10);
             const finalDivaBalance = await divaToken.balanceOf(poster1.address);
             expect(finalDivaBalance).to.equal(initialDivaBalance + expectedDivaAmount);
             expect(await mockUSDT.balanceOf(poster1.address)).to.equal(0);
             expect(await mockUSDT.balanceOf(await divaToken.getAddress())).to.equal(usdtAmount);
 
         })
 
     })*/
})
