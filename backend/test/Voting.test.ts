import { ethers } from "hardhat";
import { expect } from "chai";
import { parseEther, TypedDataDomain, TypedDataField } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployVoting } from "./utils/fixtures";

describe("Voting contract tests:", function () {
    let voting: any;
    let divaToken: any;
    let mockUSDC: any;
    let votingRegistry: any;
    let postManager: any;
    let voter1: any;
    let voter2: any;
    let voter3: any;
    let url: string;
    let url2: string;

    before(async function () {
        const votingFixture = await loadFixture(deployVoting);
        voting = votingFixture.voting;
        divaToken = votingFixture.divaToken;
        votingRegistry = votingFixture.votingRegistry;
        postManager = votingFixture.postManager;
        mockUSDC = votingFixture.mockUSDC;
        voter1 = votingFixture.voter1;
        voter2 = votingFixture.voter2;
        voter3 = votingFixture.voter3;
        url = "https://www.exemple.com/content";
        url2 = "https://www.exemple2.com"



    })
    describe("Deployment tests", function () {
        it("should set the DivaToken address", async function () {
            expect(await voting.divaToken()).to.equal(await divaToken.getAddress());
        });
        it("should set the MockUSDC address", async function () {
            expect(await voting.mockUSDC()).to.equal(await mockUSDC.getAddress());
        });

    })
    let domain: TypedDataDomain;
    let types: Record<string, Array<TypedDataField>>;
    let voter1Wallet: any;
    let voter2Wallet: any;
    before(async function () {

        // Pour les tests, on peut créer un nouveau wallet pour simuler voter1
        const privateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
        voter1Wallet = new ethers.Wallet(privateKey, ethers.provider);

        const privateKey2 = "0x42c1095e998f97a5a0044966f0945389ae9e86dae88b7a8412f4603c6b78690d";
        voter2Wallet = new ethers.Wallet(privateKey2, ethers.provider);

        // Configurer le domaine EIP-712 pour les signatures
        const chainId = (await ethers.provider.getNetwork()).chainId;
        domain = {
            name: "MockUSDC",
            version: "1",
            chainId,
            verifyingContract: await mockUSDC.getAddress()
        };

        // Définir les types pour le permit
        types = {
            Permit: [
                { name: "owner", type: "address" },
                { name: "spender", type: "address" },
                { name: "value", type: "uint256" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" }
            ]
        };

        // Transférer des fonds à voter1Wallet pour qu'il puisse interagir
        await mockUSDC.mint(voter1Wallet.address, ethers.parseEther("1000"));
        await mockUSDC.mint(voter2Wallet.address, ethers.parseEther("1000"));

    });

    describe("Token purchase tests", function () {

        it("should successfully purchase Diva tokens with permit", async function () {
            const usdcAmount = ethers.parseEther("10");
            await mockUSDC.mint(voter1Wallet.address, usdcAmount);

            const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 heure dans le futur
            const nonce = await mockUSDC.nonces(voter1Wallet.address);

            const value = {
                owner: voter1Wallet.address,
                spender: await voting.getAddress(),
                value: usdcAmount,
                nonce: nonce,
                deadline: deadline
            };

            const signature = await voter1Wallet.signTypedData(domain, types, value);
            const { v, r, s } = ethers.Signature.from(signature);

            const initialDivaBalance = await divaToken.balanceOf(voter1Wallet.address);

            await voting.connect(voter1Wallet).purchaseDivas(
                usdcAmount,
                deadline,
                v,
                r,
                s
            );

            const conversionRate = await divaToken.conversionRate();
            const expectedDivaAmount = BigInt(usdcAmount) * BigInt(10 ** 12) * BigInt(conversionRate);
            const finalDivaBalance = await divaToken.balanceOf(voter1Wallet.address);

            expect(finalDivaBalance).to.equal(initialDivaBalance + expectedDivaAmount);
        });

        it("should revert when permit signature has expired", async function () {
            const usdcAmount = ethers.parseEther("10");

            // Deadline dans le passé
            const deadline = Math.floor(Date.now() / 1000) - 3600; // 1 heure dans le passé
            const nonce = await mockUSDC.nonces(voter1Wallet.address);

            const value = {
                owner: voter1Wallet.address,
                spender: await voting.getAddress(),
                value: usdcAmount,
                nonce: nonce,
                deadline: deadline
            };

            const signature = await voter1Wallet.signTypedData(domain, types, value);
            const { v, r, s } = ethers.Signature.from(signature);

            // La transaction devrait échouer car le deadline est dans le passé
            await expect(voting.connect(voter1Wallet).purchaseDivas(
                usdcAmount,
                deadline,
                v,
                r,
                s
            )).to.be.revertedWith("ERC20Permit: expired deadline");
        });

        it("should register the buyer as a voter ", async function () {
            expect(await votingRegistry.isRegistered(voter1Wallet.getAddress())).to.be.true;
        })

        it("should emit TransferDivas event when purchasing with permit", async function () {
            const usdcAmount = ethers.parseEther("10");

            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const nonce = await mockUSDC.nonces(voter1Wallet.address);

            const value = {
                owner: voter1Wallet.address,
                spender: await voting.getAddress(),
                value: usdcAmount,
                nonce: nonce,
                deadline: deadline
            };

            const signature = await voter1Wallet.signTypedData(domain, types, value);
            const { v, r, s } = ethers.Signature.from(signature);

            const conversionRate = await divaToken.conversionRate();
            const divaAmount = BigInt(usdcAmount) * BigInt(10 ** 12) * BigInt(conversionRate);

            await expect(voting.connect(voter1Wallet).purchaseDivas(
                usdcAmount,
                deadline,
                v,
                r,
                s
            )).to.emit(voting, "TransferDivas").withArgs(voter1Wallet.address, divaAmount);
        });
    })
    before(async function () {
        const usdcAmount = ethers.parseEther("100");
        await mockUSDC.mint(voter1Wallet.address, usdcAmount);
        await mockUSDC.mint(voter2Wallet.address, usdcAmount);

        // Transférer des ETH aux wallets de test pour payer les frais de transaction
        const [deployer] = await ethers.getSigners();
        await deployer.sendTransaction({
            to: voter1Wallet.address,
            value: ethers.parseEther("1")
        });
        await deployer.sendTransaction({
            to: voter2Wallet.address,
            value: ethers.parseEther("1")
        });

        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 heure dans le futur
        const nonce = await mockUSDC.nonces(voter1Wallet.address);
        const nonce2 = await mockUSDC.nonces(voter2Wallet.address);

        const value = {
            owner: voter1Wallet.address,
            spender: await voting.getAddress(),
            value: usdcAmount,
            nonce: nonce,
            deadline: deadline
        };

        const value2 = {
            owner: voter2Wallet.address,
            spender: await voting.getAddress(),
            value: usdcAmount,
            nonce: nonce2,
            deadline: deadline
        };

        const signature = await voter1Wallet.signTypedData(domain, types, value);
        const signature2 = await voter2Wallet.signTypedData(domain, types, value2);
        const { v, r, s } = ethers.Signature.from(signature);

        await voting.connect(voter1Wallet).purchaseDivas(
            usdcAmount,
            deadline,
            v,
            r,
            s
        );

        const { v: v2, r: r2, s: s2 } = ethers.Signature.from(signature2);
        await voting.connect(voter2Wallet).purchaseDivas(
            usdcAmount,
            deadline,
            v2,
            r2,
            s2
        );
    })

    describe(" Posts creating tests:", function () {
        it("should revert when a user unregistred attempt to post something", async function () {
            await expect(voting.connect(voter1).createPost(url)).to.be.revertedWith("Voter not registered");
        })
        it("should revert when a registred user attempt to post something with an insufficient balance", async function () {

            const votingAddress = await voting.getAddress();
            await divaToken.connect(voter1Wallet).approve(votingAddress, parseEther("4"));

            await expect(voting.connect(voter1Wallet).createPost(url)).to.rejectedWith("ERC20: insufficient allowance");
        })
        it("shoul not revert whan a voter post something with a sufficient balance", async function () {

            const votingAddress = await voting.getAddress();
            await divaToken.connect(voter1Wallet).approve(votingAddress, parseEther("5"))
            await expect(voting.connect(voter1Wallet).createPost(url)).to.be.not.reverted;
        })
        it("should revert when a voter attempt to post an url already posted", async function () {

            const votingAddress = await voting.getAddress();
            await divaToken.connect(voter1Wallet).approve(votingAddress, parseEther("5"))

            await divaToken.connect(voter1Wallet).approve(votingAddress, parseEther("5"))
            await expect(voting.connect(voter1Wallet).createPost(url)).to.be.revertedWith("URL already exists");

        })
        it("should emit a PostCreated event when a voter success to create a post", async function () {
            const votingAddress = await voting.getAddress();
            await divaToken.connect(voter1Wallet).approve(votingAddress, parseEther("5"))
            await expect(voting.connect(voter1Wallet).createPost(url2))
                .to.emit(postManager, "PostCreated");
        })
        it("should set the post ID by hashing the url", async function () {
            // Utiliser keccak256 et toUtf8Bytes pour calculer le hash comme le fait Solidity
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));

            // Convertir le hash en BigInt pour l'utiliser comme ID
            const postId = BigInt(iDUrl);

            // Vérifier que le post existe avec cet ID
            const post = await postManager.posts(postId);
            expect(post.urlExists).to.be.true;
        })
    })
    describe("Vote tests:", function () {
        it("should revert when a user unregistred attempt to vote", async function () {
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));
            // Convertir le hash en BigInt pour l'utiliser comme ID
            const postId = BigInt(iDUrl);
            // Utiliser la valeur 2 qui correspond à Fake dans l'enum VoteOption
            await expect(voting.connect(voter1).vote(postId, BigInt(2), parseEther("1")))
                .to.be.revertedWith("Voter not registered");
        })
        it("should revert when a user unregistred attempt to vote with a too high amount", async function () {
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));
            // Convertir le hash en BigInt pour l'utiliser comme ID
            const postId = BigInt(iDUrl);
            // Utiliser la valeur 2 qui correspond à Fake dans l'enum VoteOption
            await expect(voting.connect(voter1Wallet).vote(postId, BigInt(2), parseEther("60")))
                .to.be.revertedWith("Stake too high");
        })
        it("should revert when a user unregistred attempt to vote with a too low amount", async function () {
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));
            // Convertir le hash en BigInt pour l'utiliser comme ID
            const postId = BigInt(iDUrl);
            // Utiliser la valeur 2 qui correspond à Fake dans l'enum VoteOption
            await expect(voting.connect(voter1Wallet).vote(postId, BigInt(2), parseEther("0.09")))
                .to.be.revertedWith("Stake too low");
        })
        it("should not revert when a voter votes with a valid amount", async function () {
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));
            // Convertir le hash en BigInt pour l'utiliser comme ID
            const postId = BigInt(iDUrl);

            // Approuver le contrat Voting à dépenser les tokens DIVA de l'utilisateur
            const votingAddress = await voting.getAddress();
            await divaToken.connect(voter1Wallet).approve(votingAddress, parseEther("10"));

            // Utiliser la valeur 2 qui correspond à Fake dans l'enum VoteOption
            await expect(voting.connect(voter1Wallet).vote(postId, BigInt(2), parseEther("1")))
                .to.not.be.reverted;
        })
        it("should emit VoteCast event when a voter vote successfully", async function () {
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));
            const postId = BigInt(iDUrl);

            const votingAddress = await voting.getAddress();
            await divaToken.connect(voter2Wallet).approve(votingAddress, parseEther("10"));

            await expect(voting.connect(voter2Wallet).vote(postId, BigInt(2), parseEther("1")))
                .to.emit(postManager, "VoteCast")
                .withArgs(postId, voter2Wallet.getAddress(), BigInt(2), parseEther("1"))
        })
        it("should increment post's fake votes account after a vote 'fake'", async function () {
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));
            const PostId = BigInt(iDUrl);
            const postId = await postManager.posts(PostId);

            expect(postId.fakeVoteCount).equal(2);

        })
        it("should add the voter's stake amount to totalFakeStake when he votes 'fake'", async function () {
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));
            const PostId = BigInt(iDUrl);
            const postId = await postManager.posts(PostId);

            expect(postId.totalFakeStake).equal(parseEther("2"));

        })
        it("should add the voter's reputation to totalFakereputation when he votes 'fake'", async function () {
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));
            const PostId = BigInt(iDUrl);
            const postId = await postManager.posts(PostId);

            expect(postId.totalFakeReputation).equal(2);

        })
        it("should create a new vote with the choice's voter when he votes", async function () {
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));
            const postId = BigInt(iDUrl);

            // Récupérer l'adresse du votant
            const voter1Address = await voter1Wallet.getAddress();

            // Récupérer le vote et vérifier son choix
            const vote = await postManager.getVote(postId, voter1Address);
            expect(BigInt(vote.choice)).to.equal(BigInt(2));
        })

    })

    describe("Withdraw vote tests", function () {


        it("should allow a voter to withdraw their vote", async function () {
            // Vérifier le solde avant le retrait
            const voter1Address = await voter1Wallet.getAddress();
            const balanceBefore = await divaToken.balanceOf(voter1Address);

            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));
            const postId = BigInt(iDUrl);
            // Retirer le vote
            await voting.connect(voter1Wallet).withdrawVote(postId);

            // Vérifier le solde après le retrait
            const balanceAfter = await divaToken.balanceOf(voter1Address);

            // Le solde devrait avoir augmenté du montant misé
            expect(balanceAfter).to.be.gt(balanceBefore);
        })

        it("should revert when trying to withdraw a vote twice", async function () {

            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));
            const postId = BigInt(iDUrl);
            // Essayer de retirer le vote une deuxième fois
            await expect(voting.connect(voter1Wallet).withdrawVote(postId))
                .to.be.revertedWith("Vote already withdrawn");
        })

        it("should revert when trying to withdraw a non-existent vote", async function () {
            // Essayer de retirer un vote pour un post qui n'existe pas
            const nonExistentPostId = BigInt(ethers.keccak256(ethers.toUtf8Bytes("non-existent-url")));

            // Cela devrait échouer car le vote n'existe pas
            await expect(voting.connect(voter1Wallet).withdrawVote(nonExistentPostId))
                .to.be.reverted;
        })
        it("should emit VoteWithdran event when a voter delete his vote", async function () {
            const iDUrl = ethers.keccak256(ethers.toUtf8Bytes(url));
            const postId = BigInt(iDUrl);
            const voter2Add = await voter2Wallet.getAddress();
            // Essayer de retirer le vote une deuxième fois
            await expect(voting.connect(voter2Wallet).withdrawVote(postId))
                .to.emit(postManager, "VoteWithdrawn")
                .withArgs(postId, voter2Add);
        })

    })
})