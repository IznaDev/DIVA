import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DivaModule = buildModule("DivaModule", (m) => {
    const divaToken = m.contract("DivaToken", []);
    const votingRegistry = m.contract("VotingRegistry", []);
    const postManager = m.contract("PostManager", [votingRegistry]);

    const voting = m.contract("Voting", [divaToken, votingRegistry, postManager], {
        after: [divaToken]
    });

    return {
        divaToken,
        votingRegistry,
        postManager,
        voting
    };
});

export default DivaModule;
