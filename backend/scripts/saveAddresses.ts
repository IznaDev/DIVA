import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // Adresse du contrat Voting déployé
  const votingAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const mockUSDCAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  // Connexion au contrat Voting
  const voting = await ethers.getContractAt("Voting", votingAddress);

  // Récupération des adresses
  const divaTokenAddress = await voting.divaToken();
  const postManagerAddress = await voting.postManager();

  // Connexion au contrat DivaToken pour vérifier la supply
  const divaToken = await ethers.getContractAt("DivaToken", divaTokenAddress);
  const totalSupply = await divaToken.totalSupply();
  const decimals = await divaToken.decimals();
  const formattedSupply = ethers.formatUnits(totalSupply, decimals);

  // Création de l'objet avec les adresses
  const addresses = {
    mockUSDC: mockUSDCAddress,
    voting: votingAddress,
    divaToken: divaTokenAddress,
    postManager: postManagerAddress
  };

  // Chemin du fichier de sortie
  const outputPath = path.join(__dirname, "../deployedAddresses.json");

  // Écriture des adresses dans le fichier JSON
  fs.writeFileSync(
    outputPath,
    JSON.stringify(addresses, null, 2)
  );

  console.log(`Adresses sauvegardées dans ${outputPath}`);
  console.log("\nRésumé des contrats déployés :");
  console.log("-----------------------------");
  console.log("MockUSDC:", mockUSDCAddress);
  console.log("Voting:", votingAddress);
  console.log("DivaToken:", divaTokenAddress);
  console.log("PostManager:", postManagerAddress);

  console.log("\nInformations sur DivaToken :");
  console.log("---------------------------");
  console.log("Supply totale:", formattedSupply);
  console.log("Supply attendue: 400000000.0");

  if (formattedSupply !== "400000000.0") {
    console.warn("\n⚠️ ATTENTION: La supply totale ne correspond pas à la valeur attendue!");
    console.warn("Vérifiez le contrat DivaToken et assurez-vous que le minting initial est correct.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
