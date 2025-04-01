import { ethers } from "hardhat";

async function main() {
  // Adresse du contrat Voting déployé
  const votingAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  
  // Connexion au contrat Voting
  const voting = await ethers.getContractAt("Voting", votingAddress);
  
  // Récupération des adresses
  const divaTokenAddress = await voting.divaToken();
  const votingRegistryAddress = await voting.votingRegistry();
  const postManagerAddress = await voting.postManager();
  
  console.log("DivaToken address:", divaTokenAddress);
  console.log("VotingRegistry address:", votingRegistryAddress);
  console.log("PostManager address:", postManagerAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
