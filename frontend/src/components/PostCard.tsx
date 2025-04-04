'use client';

import { Button } from "./ui/button";
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ExternalLink, Globe } from 'lucide-react';

interface PostCardProps {
  id: string;
  url: string;
  poster: string;
  timestamp: number;
}

export default function PostCard({ id, url, poster, timestamp }: PostCardProps) {
  // Fonction pour tronquer une adresse Ethereum
  const shortenAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Obtenir le nom du domaine de l'URL
  let domain = '';
  try {
    domain = new URL(url).hostname;
  } catch (error) {
    console.error("URL invalide:", url);
    domain = url;
  }

  // Formater l'horodatage
  const formattedTime = formatDistanceToNow(
    new Date(typeof timestamp === 'number' ? timestamp * 1000 : Date.now()),
    { addSuffix: true, locale: fr }
  );

  return (
    <div className="bg-[#252432] rounded-lg p-4 shadow-md mb-4 border border-[#CF662D]/20 hover:border-[#CF662D]/50 transition-colors">
      {/* En-tête du post */}
      <div className="flex items-center mb-3">
        <div className="rounded-full bg-[#CF662D] w-10 h-10 flex items-center justify-center text-white font-bold">
          {poster.substring(2, 4).toUpperCase()}
        </div>
        <div className="ml-3">
          <div className="font-medium">{shortenAddress(poster)}</div>
          <div className="text-xs text-gray-400">{formattedTime}</div>
        </div>
      </div>
      
      {/* Contenu du post - Version simplifiée */}
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="block bg-[#1A1927] p-4 rounded-md hover:bg-[#1A1927]/80 transition-colors mb-2"
      >
        <div className="flex items-start gap-3">
          <div className="bg-[#CF662D]/20 p-2 rounded-md">
            <Globe className="h-8 w-8 text-[#CF662D]" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold mb-1 text-white">{domain}</h3>
            <p className="text-sm text-gray-300 break-all">{url}</p>
            <div className="flex items-center text-xs text-[#CF662D] mt-2">
              <ExternalLink size={12} className="mr-1" />
              Ouvrir le lien
            </div>
          </div>
        </div>
      </a>
      
      {/* Boutons d'action */}
      <div className="flex justify-between mt-4 pt-2 border-t border-[#333243]">
        <Button variant="outline" className="text-xs flex-1 mr-2 bg-transparent border-[#333243] hover:bg-[#1A1927] hover:text-white">
          Voter Vrai
        </Button>
        <Button variant="outline" className="text-xs flex-1 bg-transparent border-[#333243] hover:bg-[#1A1927] hover:text-white">
          Voter Faux
        </Button>
      </div>
    </div>
  );
}
