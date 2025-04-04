import { ethers } from "hardhat";
import { expect } from "chai";
import { parseEther } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployDivaToken, deployVoting } from "./utils/fixtures";
import { INITIAL_MINT_AMOUNT } from "./utils/constants";

describe("DivaToken contract tests:", function () {
    let divaToken: any;
    let owner: any;
    let user1: any;
    let user2: any;
    let foundersList: string[];

    before(async function () {
        const divaTokenFixture = await loadFixture(deployDivaToken);
        divaToken = divaTokenFixture.divaToken;
        owner = divaTokenFixture.owner;


        [, user1, user2] = await ethers.getSigners();

        foundersList = [
            "0x1234567890123456789012345678901234567890",
            "0x2345678901234567890123456789012345678901",
            "0x3456789012345678901234567890123456789012",
            "0x4567890123456789012345678901234567890123"
        ];
    })

    describe("Deployment tests", function () {
        it("should have correct name & symbol", async function () {
            expect(await divaToken.name()).to.equal("DivaToken");
            expect(await divaToken.symbol()).to.equal("DIVA");
        })

        it("should have 18 decimals", async function () {
            expect(await divaToken.decimals()).to.equal(18);
        })

        it("should assign initial supply of 100 million DIVA to the hardcoded addresses", async function () {
            const hardcodedAddresses = foundersList.slice(0, 4);

            for (const address of hardcodedAddresses) {
                const balanceAddress = await divaToken.balanceOf(address);
                expect(balanceAddress).to.equal(INITIAL_MINT_AMOUNT);
            }
        })

        it("should have the correct total supply", async function () {
            const expectedTotalSupply = INITIAL_MINT_AMOUNT * BigInt(4);
            expect(await divaToken.totalSupply()).to.equal(expectedTotalSupply);
        })

        it("should set the owner correctly", async function () {
            expect(await divaToken.owner()).to.equal(owner.address);
        })
    })

    describe("Conversion Rate tests", function () {
        it("should return the correct conversion rate", async function () {
            expect(await divaToken.conversionRate()).to.equal(10);
        })
    })

    describe("Minting tests", function () {
        it("should allow owner to mint tokens", async function () {
            const initialBalance = await divaToken.balanceOf(user1.address);
            const mintAmount = parseEther("1000");

            await divaToken.connect(owner).mint(user1.address, mintAmount);

            const finalBalance = await divaToken.balanceOf(user1.address);
            expect(finalBalance).to.equal(initialBalance + mintAmount);
        })

        it("should increase total supply when tokens are minted", async function () {
            const initialSupply = await divaToken.totalSupply();
            const mintAmount = parseEther("2000");

            await divaToken.connect(owner).mint(user2.address, mintAmount);

            const finalSupply = await divaToken.totalSupply();
            expect(finalSupply).to.equal(initialSupply + mintAmount);
        })

        it("should revert when non-owner tries to mint tokens", async function () {
            const mintAmount = parseEther("1000");

            await expect(divaToken.connect(user1).mint(user1.address, mintAmount))
                .to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("should return true when minting is successful", async function () {
            const mintAmount = parseEther("500");
            const result = await divaToken.connect(owner).mint(user1.address, mintAmount);

            // Vérifier que la transaction a été confirmée
            const receipt = await result.wait();
            expect(receipt.status).to.equal(1);
        })
    })

    describe("Transfer tests", function () {
        it("should allow users to transfer tokens", async function () {
            const mintAmount = parseEther("1000");
            await divaToken.connect(owner).mint(user1.address, mintAmount);

            const initialUser1Balance = await divaToken.balanceOf(user1.address);
            const initialUser2Balance = await divaToken.balanceOf(user2.address);

            const transferAmount = parseEther("300");
            await divaToken.connect(user1).transfer(user2.address, transferAmount);

            const finalUser1Balance = await divaToken.balanceOf(user1.address);
            const finalUser2Balance = await divaToken.balanceOf(user2.address);

            expect(finalUser1Balance).to.equal(initialUser1Balance - transferAmount);
            expect(finalUser2Balance).to.equal(initialUser2Balance + transferAmount);
        })

        it("should emit Transfer event when tokens are transferred", async function () {
            const transferAmount = parseEther("100");

            await expect(divaToken.connect(user1).transfer(user2.address, transferAmount))
                .to.emit(divaToken, "Transfer")
                .withArgs(user1.address, user2.address, transferAmount);
        })

        it("should revert when trying to transfer more than balance", async function () {
            const user1Balance = await divaToken.balanceOf(user1.address);
            const excessiveAmount = user1Balance + parseEther("1");

            await expect(divaToken.connect(user1).transfer(user2.address, excessiveAmount))
                .to.be.reverted;
        })
    })

    describe("Approve and TransferFrom tests", function () {
        it("should allow users to approve spending of their tokens", async function () {
            const approvalAmount = parseEther("500");
            await divaToken.connect(user1).approve(user2.address, approvalAmount);

            const allowance = await divaToken.allowance(user1.address, user2.address);
            expect(allowance).to.equal(approvalAmount);
        })

        it("should emit Approval event when allowance is set", async function () {
            const approvalAmount = parseEther("250");

            await expect(divaToken.connect(user1).approve(user2.address, approvalAmount))
                .to.emit(divaToken, "Approval")
                .withArgs(user1.address, user2.address, approvalAmount);
        })

        it("should allow transferFrom with sufficient allowance", async function () {
            // Mint tokens to user1
            const mintAmount = parseEther("1000");
            await divaToken.connect(owner).mint(user1.address, mintAmount);

            // Approve user2 to spend user1's tokens
            const approvalAmount = parseEther("500");
            await divaToken.connect(user1).approve(user2.address, approvalAmount);

            // Check initial balances
            const initialUser1Balance = await divaToken.balanceOf(user1.address);
            const initialOwnerBalance = await divaToken.balanceOf(owner.address);

            // User2 transfers tokens from user1 to owner
            const transferAmount = parseEther("300");
            await divaToken.connect(user2).transferFrom(user1.address, owner.address, transferAmount);

            // Check final balances
            const finalUser1Balance = await divaToken.balanceOf(user1.address);
            const finalOwnerBalance = await divaToken.balanceOf(owner.address);
            const remainingAllowance = await divaToken.allowance(user1.address, user2.address);

            expect(finalUser1Balance).to.equal(initialUser1Balance - transferAmount);
            expect(finalOwnerBalance).to.equal(initialOwnerBalance + transferAmount);
            expect(remainingAllowance).to.equal(approvalAmount - transferAmount);
        })

        it("should revert transferFrom with insufficient allowance", async function () {
            // Check current allowance
            const currentAllowance = await divaToken.allowance(user1.address, user2.address);
            const excessiveAmount = currentAllowance + parseEther("1");

            // Attempt to transfer more than the allowance
            await expect(divaToken.connect(user2).transferFrom(user1.address, owner.address, excessiveAmount))
                .to.be.reverted;
        })
    })

    describe("Ownership tests", function () {
        let voting: any;
        let poster1: any;
        let divaToken: any;

        before(async function () {
            const votingFixture = await loadFixture(deployVoting);
            voting = votingFixture.voting;
            divaToken = votingFixture.divaToken;
            poster1 = votingFixture.poster1;
        })

        it("should be owned by the Voting contract", async function () {
            expect(await divaToken.owner()).to.equal(await voting.getAddress());
        })

        it("should revert when other than the Voting contract attempts to mint tokens", async function () {
            await expect(divaToken.connect(owner).mint(poster1.address, parseEther("100")))
                .to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("should verify the owner is the Voting contract", async function () {
            // Vérifier que le propriétaire du contrat DivaToken est bien le contrat Voting
            const divaTokenOwner = await divaToken.owner();
            const votingAddress = await voting.getAddress();

            expect(divaTokenOwner).to.equal(votingAddress);

            // Vérifier que le contrat Voting a les permissions nécessaires
            // en vérifiant que le contrat DivaToken est bien détenu par le contrat Voting
            const ownershipTransferred = divaTokenOwner === votingAddress;
            expect(ownershipTransferred).to.be.true;
        })
    })
})
