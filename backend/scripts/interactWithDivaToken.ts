import { ethers } from "hardhat";

async function main() {
  // Adresses des contrats déployés
  const divaTokenAddress = "0xCafac3dD18aC6c6e92c921884f9E4176737C052c";
  
  // Connexion au contrat DivaToken
  const divaToken = await ethers.getContractAt("DivaToken", divaTokenAddress);
  
  // Récupération d'informations
  const name = await divaToken.name();
  const symbol = await divaToken.symbol();
  const totalSupply = await divaToken.totalSupply();
  const decimals = await divaToken.decimals();
  
  console.log("DivaToken Information:");
  console.log("----------------------");
  console.log("Name:", name);
  console.log("Symbol:", symbol);
  console.log("Decimals:", decimals);
  console.log("Total Supply:", ethers.formatUnits(totalSupply, decimals));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
