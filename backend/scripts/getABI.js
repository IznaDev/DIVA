// Script pour extraire l'ABI du contrat Voting
const fs = require('fs');
const path = require('path');

// Chemin vers le fichier JSON du contrat compilé
const votingJsonPath = path.join(__dirname, '../artifacts/contracts/Voting.sol/Voting.json');

try {
  // Lire le fichier JSON
  const votingJson = JSON.parse(fs.readFileSync(votingJsonPath, 'utf8'));
  
  // Extraire l'ABI
  const abi = JSON.stringify(votingJson.abi, null, 2);
  
  // Afficher l'ABI
  console.log(abi);
} catch (error) {
  console.error('Erreur lors de la lecture du fichier JSON:', error);
}
