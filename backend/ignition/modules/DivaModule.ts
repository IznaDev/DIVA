import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DivaModule = buildModule("DivaModule", (m) => {
    // Déployer MockUSDC d'abord
    const mockUSDC = m.contract("MockUSDC", []);
    
    // Déployer Voting avec MockUSDC comme argument
    const voting = m.contract("Voting", [mockUSDC], {
        after: [mockUSDC]
    });

    return {
        mockUSDC,
        voting
    };
});

export default DivaModule;
