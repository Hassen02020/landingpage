// wa.me remplace TOUT emoji par « � » (U+FFFD) dans sa redirection vers api.whatsapp.com (constaté le 06/11/2026).
// Les textes préremplis ne doivent donc contenir aucun emoji : on les retire avant d'encoder le lien.
// Les accents, l'arabe et la ponctuation passent sans problème.
// construit par chaîne : le drapeau « u » dépasse la cible de compilation (tsconfig) mais fonctionne à l'exécution
const PATTERN = "[0-9#*]\\u{FE0F}?\\u{20E3}|[\\p{Extended_Pictographic}\\p{Regional_Indicator}\\u{FE0F}\\u{200D}\\u{20E3}]"

export function waText(text: string): string {
  return text
    .replace(new RegExp(PATTERN, "gu"), "")
    .replace(/�/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
}

export const hasEmoji = (text: string): boolean => new RegExp(PATTERN, "u").test(text)
