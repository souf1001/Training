// Short nutrition and training tips that show up throughout the app.
import type { Goal } from './types'

type Context = 'today' | 'workout' | 'food'

interface Tip {
  text: string
  goals?: Goal[] // empty = fits every goal
  contexts: Context[]
}

const TIPS: Tip[] = [
  // food, any goal
  { text: 'Iss zu jeder Mahlzeit eine Handvoll Eiweiß: Quark, Eier, Fleisch, Fisch, Tofu oder Linsen.', contexts: ['today', 'food'] },
  { text: 'Trink über den Tag verteilt etwa 35 ml Wasser pro kg Körpergewicht, an Trainingstagen etwas mehr.', contexts: ['today', 'food'] },
  { text: 'Gemüse bringt viel Volumen für wenig Kalorien. Mach die halbe Portion auf dem Teller zu Gemüse.', contexts: ['food'] },
  { text: 'Tracke auch Öl, Soßen und Getränke. Da verstecken sich oft 300–500 kcal am Tag.', contexts: ['food'] },
  { text: 'Schlaf 7–9 Stunden. Zu wenig Schlaf macht hungriger und bremst die Regeneration.', contexts: ['today'] },
  // workout
  { text: 'Nach dem Training: 30–40 g Eiweiß in den nächsten Stunden, z. B. Skyr mit Haferflocken.', contexts: ['workout'] },
  { text: '1–2 Stunden vor dem Training eine Mahlzeit mit Kohlenhydraten gibt dir mehr Power.', contexts: ['workout', 'today'] },
  { text: 'Schreib jedes Training auf. Nur so siehst du, ob du dich steigerst.', contexts: ['workout'] },
  { text: 'Atme beim Drücken oder Ziehen aus und beim Zurückgehen ein.', contexts: ['workout'] },
  { text: 'Kreatin (3–5 g täglich) ist das am besten erforschte Supplement für Kraft und Muskeln.', goals: ['build', 'bulk', 'recomp'], contexts: ['workout', 'food'] },
  // losing fat
  { text: 'Hunger am Abend? Plane dir einen Teil deiner Kalorien bewusst für abends ein.', goals: ['lose', 'recomp'], contexts: ['food', 'today'] },
  { text: 'Getränke mit Zucker einfach durch Zero-Varianten oder Wasser ersetzen spart schnell 200+ kcal.', goals: ['lose', 'recomp'], contexts: ['food'] },
  { text: 'Dein Gewicht schwankt täglich um 1–2 kg durch Wasser. Schau auf den Wochenschnitt, nicht auf einen Tag.', goals: ['lose', 'recomp'], contexts: ['today'] },
  { text: 'Viel Eiweiß und Ballaststoffe halten am längsten satt: Magerquark, Hähnchen, Hülsenfrüchte, Gemüse.', goals: ['lose', 'recomp'], contexts: ['food'] },
  { text: 'Schritte zählen: Alltagsbewegung verbrennt oft mehr als eine Cardio-Einheit.', goals: ['lose', 'recomp', 'fit'], contexts: ['today'] },
  // building muscle
  { text: 'Du schaffst deine Kalorien nicht? Nüsse, Erdnussbutter, Haferflocken und Öl sind kleine Kalorienbomben.', goals: ['bulk', 'build'], contexts: ['food', 'today'] },
  { text: 'Ziel beim Aufbau: 0,25–0,5 % Körpergewicht pro Woche zunehmen. Mehr wird meist Fett.', goals: ['bulk', 'build'], contexts: ['today'] },
  { text: 'Flüssige Kalorien helfen beim Bulken: ein Shake aus Milch, Banane, Haferflocken und Erdnussbutter hat ca. 700 kcal.', goals: ['bulk'], contexts: ['food'] },
  // fit
  { text: 'Iss möglichst bunt. Verschiedene Farben bei Obst und Gemüse bedeuten verschiedene Vitamine.', goals: ['fit'], contexts: ['food', 'today'] },
]

// Same tip for the whole day, a new one tomorrow.
export function tipFor(goal: Goal, context: Context, date = new Date()): string {
  const matching = TIPS.filter((t) => t.contexts.includes(context) && (!t.goals || t.goals.includes(goal)))
  const day = Math.floor(date.getTime() / 86_400_000)
  return matching[day % matching.length].text
}
