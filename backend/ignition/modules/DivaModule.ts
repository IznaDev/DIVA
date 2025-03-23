import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DivaModule = buildModule("DivaModule", (m) => {
    const divaToken = m.contract("DivaToken", []);

    const voting = m.contract("Voting", [divaToken], {
        after: [divaToken]
    });

    return {
        divaToken,
        voting
    };
});

export default DivaModule;
