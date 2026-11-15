import Image from "next/image"

/**
 * Mascotte EAZY. N'affiche RIEN tant qu'un fichier OFFICIEL n'est pas fourni : aucune mascotte de remplacement, aucune génération, aucune retouche.
 * Utilisation future : <Easy2BookMascot src="/eazy/pose-valise.png" alt="EAZY, la mascotte d'Easy2Book" width={…} height={…} />
 */
export function Easy2BookMascot({ src, alt, width, height, className = "" }: { src?: string; alt: string; width?: number; height?: number; className?: string }) {
  if (!src || !width || !height) return null
  return <Image src={src} alt={alt} width={width} height={height} className={className} />
}
