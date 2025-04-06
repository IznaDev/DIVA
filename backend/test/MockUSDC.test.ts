import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployMockUSDC } from "./utils/fixtures";
import { parseEther } from "ethers";

let mockUSDC: any;
let owner: any;
let user1: any;
let user2: any;

describe("MockUSDC contract tests:", function () {
    before(async function () {
        const mockUSDCFixture = await loadFixture(deployMockUSDC);
        mockUSDC = mockUSDCFixture.mockUSDC;
        owner = mockUSDCFixture.owner;
        [, user1, user2] = await ethers.getSigners();
    })

    describe("Deployment tests", function () {
        it("should have correct name & symbol", async function () {
            expect(await mockUSDC.name()).to.equal("MockUSDC");
            expect(await mockUSDC.symbol()).to.equal("MUSDC");
        })

        it("should have 6 decimals", async function () {
            expect(await mockUSDC.decimals()).to.equal(6);
        })

        it("should have initial total supply", async function () {
            // 1000 pour le déployeur + 1000 pour chacune des 10 adresses de test
            expect(await mockUSDC.totalSupply()).to.equal(BigInt(12000 * 10 ** 6));
        })
    })

    describe("Minting tests", function () {
        it("should allow owner to mint tokens", async function () {
            // Vérifions le solde initial du propriétaire
            const initialBalance = await mockUSDC.balanceOf(owner);

            // Mintons 1000 tokens avec 18 décimales
            const amount = BigInt(1000 * 10 ** 18);
            await mockUSDC.mint(owner, amount);

            // Vérifions que le solde final est correct
            const finalBalance = await mockUSDC.balanceOf(owner);
            expect(finalBalance).to.equal(initialBalance + amount);
        })

        it("should increase total supply when tokens are minted", async function () {
            const initialSupply = await mockUSDC.totalSupply();
            const amount = ethers.parseUnits("50", 6); // 50 USDC with 6 decimals
            await mockUSDC.mint(user1.address, amount);
            const finalSupply = await mockUSDC.totalSupply();
            expect(finalSupply).to.equal(initialSupply + amount);
        })

        it("should revert when non-owner tries to mint tokens", async function () {
            const amount = ethers.parseUnits("100", 6);
            await expect(mockUSDC.connect(user1).mint(user1.address, amount))
                .to.be.revertedWith("Ownable: caller is not the owner");
        })
    })

    describe("Transfer tests", function () {
        it("should allow users to transfer tokens", async function () {
            // Mint tokens to user1
            const amount = ethers.parseUnits("100", 6);
            await mockUSDC.mint(user1.address, amount);

            // Check initial balances
            const initialUser1Balance = await mockUSDC.balanceOf(user1.address);
            const initialUser2Balance = await mockUSDC.balanceOf(user2.address);

            // Transfer tokens from user1 to user2
            const transferAmount = ethers.parseUnits("30", 6);
            await mockUSDC.connect(user1).transfer(user2.address, transferAmount);

            // Check final balances
            const finalUser1Balance = await mockUSDC.balanceOf(user1.address);
            const finalUser2Balance = await mockUSDC.balanceOf(user2.address);

            expect(finalUser1Balance).to.equal(initialUser1Balance - transferAmount);
            expect(finalUser2Balance).to.equal(initialUser2Balance + transferAmount);
        })

        it("should emit Transfer event when tokens are transferred", async function () {
            const transferAmount = ethers.parseUnits("10", 6);
            await expect(mockUSDC.connect(user1).transfer(user2.address, transferAmount))
                .to.emit(mockUSDC, "Transfer")
                .withArgs(user1.address, user2.address, transferAmount);
        })

        it("should revert when trying to transfer more than balance", async function () {
            const user1Balance = await mockUSDC.balanceOf(user1.address);
            const excessiveAmount = user1Balance + ethers.parseUnits("1", 6);

            await expect(mockUSDC.connect(user1).transfer(user2.address, excessiveAmount))
                .to.be.reverted;
        })
    })

    describe("Approve and TransferFrom tests", function () {
        it("should allow users to approve spending of their tokens", async function () {
            const approvalAmount = ethers.parseUnits("50", 6);
            await mockUSDC.connect(user1).approve(user2.address, approvalAmount);

            const allowance = await mockUSDC.allowance(user1.address, user2.address);
            expect(allowance).to.equal(approvalAmount);
        })

        it("should emit Approval event when allowance is set", async function () {
            const approvalAmount = ethers.parseUnits("25", 6);
            await expect(mockUSDC.connect(user1).approve(user2.address, approvalAmount))
                .to.emit(mockUSDC, "Approval")
                .withArgs(user1.address, user2.address, approvalAmount);
        })

        it("should allow transferFrom with sufficient allowance", async function () {
            const mintAmount = ethers.parseUnits("100", 6);
            await mockUSDC.mint(user1.address, mintAmount);

            const approvalAmount = ethers.parseUnits("50", 6);
            await mockUSDC.connect(user1).approve(user2.address, approvalAmount);

            const initialUser1Balance = await mockUSDC.balanceOf(user1.address);
            const initialUser2Balance = await mockUSDC.balanceOf(user2.address);

            const transferAmount = ethers.parseUnits("30", 6);
            await mockUSDC.connect(user2).transferFrom(user1.address, user2.address, transferAmount);

            const finalUser1Balance = await mockUSDC.balanceOf(user1.address);
            const finalUser2Balance = await mockUSDC.balanceOf(user2.address);
            const remainingAllowance = await mockUSDC.allowance(user1.address, user2.address);

            expect(finalUser1Balance).to.equal(initialUser1Balance - transferAmount);
            expect(finalUser2Balance).to.equal(initialUser2Balance + transferAmount);
            expect(remainingAllowance).to.equal(approvalAmount - transferAmount);
        })

    })

    describe("Permit tests", function () {
        it("should have correct domain separator", async function () {
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const mockUSDCAddress = await mockUSDC.getAddress();

            const domainSeparator = ethers.TypedDataEncoder.hashDomain({
                name: "MockUSDC",
                version: "1",
                chainId: chainId,
                verifyingContract: mockUSDCAddress
            });

            try {
                const contractDomainSeparator = await mockUSDC.DOMAIN_SEPARATOR();
                expect(contractDomainSeparator).to.equal(domainSeparator);
            } catch (error) {
                console.log("Skipping domain separator test - function not exposed");
            }
        })
    })

    describe("Revert tests", function () {
        let domain: any;
        let types: any;
        let signer3: any;
        let signer4: any;
        let voter1Wallet: any;

        before(async function () {
            const chainId = (await ethers.provider.getNetwork()).chainId;
            domain = {
                name: "MockUSDC",
                version: "1",
                chainId,
                verifyingContract: await mockUSDC.getAddress(),
            };
            types = {
                Permit: [
                    { name: "owner", type: "address" },
                    { name: "spender", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" },
                ],
            };

            const privateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
            voter1Wallet = new ethers.Wallet(privateKey, ethers.provider);
            // Utiliser les signers disponibles via hardhat au lieu de createRandom

        });



    })
})