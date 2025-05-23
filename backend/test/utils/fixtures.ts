import { ethers } from "hardhat";

export async function deployDivaToken() {
    const [owner] = await ethers.getSigners();

    const DivaToken = await ethers.getContractFactory("DivaToken");
    const divaToken = await DivaToken.deploy();

    return {
        divaToken, owner
    };
}

export async function deployMockUSDC() {
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    return { mockUSDC, owner: mockUSDC.owner() };
}

export async function deployPostManager() {
    const [owner] = await ethers.getSigners();

    const PostManager = await ethers.getContractFactory("PostManager");
    const postManager = await PostManager.deploy();

    return { postManager, owner }
}

export async function deployVoting() {
    const [owner, poster1, poster2, voter1, voter2,
        voter3, voter4, voter5, voter6,
        voter7, voter8, voter9, voter10] = await ethers.getSigners();

    const { mockUSDC } = await deployMockUSDC();
    const mockUSDCAddress = await mockUSDC.getAddress();

    const Voting = await ethers.getContractFactory("Voting");
    const voting = await Voting.deploy(mockUSDCAddress);

    const divaTokenAddress = await voting.divaToken();
    const DivaToken = await ethers.getContractFactory("DivaToken");
    const divaToken = await DivaToken.attach(divaTokenAddress);

    // VotingRegistry est maintenant intégré dans PostManager

    const postManagerAddress = await voting.postManager();
    const PostManager = await ethers.getContractFactory("PostManager");
    const postManager = await PostManager.attach(postManagerAddress)


    return {
        voting, divaToken, mockUSDC, postManager, owner, poster1, poster2, voter1, voter2,
        voter3, voter4, voter5, voter6, voter7, voter8, voter9, voter10
    };
}