// The questions of the profile check. The settings page reuses them to edit the profile.
import type { ReactNode } from 'react'
import { BigNumber, MultiOptionList, OptionList, WeekdayPicker } from './fields'
import { ACTIVITY, CARDIO_LEVEL, CARDIO_TYPES, EQUIPMENT_LABEL, EXPERIENCE, GOALS, HOME_EQUIPMENT, SEX, WEEKDAYS_SHORT } from '../lib/labels'
import { formatNumber } from '../lib/format'
import { DIET_STYLES, recommendedDiet } from '../lib/nutrition'
import type { Activity, CardioLevel, CardioType, DietStyle, Equipment, Experience, Goal, Profile } from '../lib/types'

export interface Question {
  id: string
  title: string
  label: string // short name for the settings list
  summary: (p: Profile) => string // current answer, shown in the settings list
  hint?: string
  // hide the question for some answers (e.g. equipment only for home training)
  show?: (p: Profile) => boolean
  valid?: (p: Profile) => boolean
  // must be picked actively in the questionnaire (no preselected answer)
  required?: boolean
  render: (p: Profile, update: (changes: Partial<Profile>) => void, unanswered?: boolean) => ReactNode
}

function entries<K extends string, V>(record: Record<K, V>): [K, V][] {
  return Object.entries(record) as [K, V][]
}

const between = (n: number, min: number, max: number) => Number.isFinite(n) && n >= min && n <= max

export const QUESTIONS: Question[] = [
  {
    id: 'sex',
    label: 'Geschlecht',
    summary: (p) => SEX[p.sex],
    title: 'Dein Geschlecht',
    hint: 'Brauchen wir für die Berechnung deines Kalorienbedarfs.',
    required: true,
    render: (p, update, unanswered) => (
      <OptionList
        label="Geschlecht"
        value={unanswered ? null : p.sex}
        onChange={(sex) => update({ sex })}
        options={[
          { value: 'female', label: 'Frau' },
          { value: 'male', label: 'Mann' },
        ]}
      />
    ),
  },
  {
    id: 'age',
    label: 'Alter',
    summary: (p) => `${p.age} Jahre`,
    title: 'Wie alt bist du?',
    valid: (p) => between(p.age, 14, 100),
    render: (p, update) => <BigNumber label="Alter" value={p.age} onChange={(age) => update({ age })} unit="Jahre" min={14} max={100} />,
  },
  {
    id: 'height',
    label: 'Größe',
    summary: (p) => `${p.heightCm} cm`,
    title: 'Wie groß bist du?',
    valid: (p) => between(p.heightCm, 120, 230),
    render: (p, update) => <BigNumber label="Größe" value={p.heightCm} onChange={(heightCm) => update({ heightCm })} unit="cm" min={120} max={230} />,
  },
  {
    id: 'weight',
    label: 'Gewicht',
    summary: (p) => `${formatNumber(p.weightKg, 1)} kg`,
    title: 'Wie viel wiegst du?',
    hint: 'Am besten morgens nach dem Aufstehen gewogen.',
    valid: (p) => between(p.weightKg, 30, 300),
    render: (p, update) => <BigNumber label="Gewicht" value={p.weightKg} onChange={(weightKg) => update({ weightKg })} unit="kg" min={30} max={300} decimals />,
  },
  {
    id: 'activity',
    label: 'Alltag',
    summary: (p) => ACTIVITY[p.activity].label,
    title: 'Wie aktiv ist dein Alltag?',
    hint: 'Ohne Sport. Das Training rechnen wir extra dazu.',
    render: (p, update) => (
      <OptionList<Activity>
        value={p.activity}
        onChange={(activity) => update({ activity })}
        options={entries(ACTIVITY).map(([value, o]) => ({ value, ...o }))}
      />
    ),
  },
  {
    id: 'goal',
    label: 'Ziel',
    summary: (p) => GOALS[p.goal].label,
    title: 'Was ist dein Ziel?',
    required: true,
    render: (p, update, unanswered) => (
      <OptionList<Goal>
        label="Ziel"
        value={unanswered ? null : p.goal}
        // Switch to the diet style that fits the new goal, but only if the user
        // still had the recommended one (a chosen vegan or keto diet stays).
        onChange={(goal) => update({ goal, dietStyle: p.dietStyle === recommendedDiet(p.goal) ? recommendedDiet(goal) : p.dietStyle })}
        options={entries(GOALS).map(([value, o]) => ({ value, ...o }))}
      />
    ),
  },
  {
    id: 'experience',
    label: 'Erfahrung',
    summary: (p) => EXPERIENCE[p.experience].label,
    title: 'Wie viel Erfahrung hast du mit Krafttraining?',
    render: (p, update) => (
      <OptionList<Experience>
        value={p.experience}
        onChange={(experience) => update({ experience })}
        options={entries(EXPERIENCE).map(([value, o]) => ({ value, ...o }))}
      />
    ),
  },
  {
    id: 'location',
    label: 'Trainingsort',
    summary: (p) => (p.location === 'gym' ? 'Fitnessstudio' : 'Zuhause'),
    title: 'Wo trainierst du?',
    render: (p, update) => (
      <OptionList
        value={p.location}
        onChange={(location) => update({ location })}
        options={[
          { value: 'gym', label: 'Im Fitnessstudio', text: 'Hanteln, Maschinen und Kabelzug' },
          { value: 'home', label: 'Zuhause', text: 'Mit dem, was du da hast, oder ganz ohne Geräte' },
        ]}
      />
    ),
  },
  {
    id: 'equipment',
    label: 'Geräte',
    summary: (p) => (p.equipment.length ? p.equipment.map((e) => EQUIPMENT_LABEL[e]).join(', ') : 'Keine'),
    title: 'Was hast du zuhause?',
    hint: 'Nichts davon? Kein Problem, dann trainierst du mit deinem Körpergewicht.',
    show: (p) => p.location === 'home',
    render: (p, update) => (
      <MultiOptionList<Equipment>
        value={p.equipment}
        onChange={(equipment) => update({ equipment })}
        options={HOME_EQUIPMENT.map((e) => ({ value: e.id, label: e.label, text: e.text }))}
      />
    ),
  },
  {
    id: 'days',
    label: 'Trainingstage',
    summary: (p) => p.trainingDays.map((d) => WEEKDAYS_SHORT[d]).join(', '),
    title: 'An welchen Tagen willst du trainieren?',
    hint: 'Für die meisten sind 3–4 Tage ideal. Zwischen zwei Tagen darf ruhig ein Ruhetag liegen.',
    valid: (p) => p.trainingDays.length > 0,
    render: (p, update) => (
      <div className="stack">
        <WeekdayPicker value={p.trainingDays} onChange={(trainingDays) => update({ trainingDays })} />
        <p className="muted small" style={{ textAlign: 'center' }}>
          {p.trainingDays.length === 0 ? 'Wähl mindestens einen Tag.' : `${p.trainingDays.length} Tage pro Woche`}
        </p>
      </div>
    ),
  },
  {
    id: 'duration',
    label: 'Dauer',
    summary: (p) => `${p.sessionMinutes} Min.`,
    title: 'Wie lange hast du pro Training Zeit?',
    hint: 'Nur das Krafttraining. Cardio planen wir extra ein.',
    render: (p, update) => (
      <OptionList
        value={String(p.sessionMinutes)}
        onChange={(v) => update({ sessionMinutes: Number(v) })}
        options={[
          { value: '30', label: '30 Minuten', text: 'etwa 4 Übungen' },
          { value: '45', label: '45 Minuten', text: 'etwa 5 Übungen' },
          { value: '60', label: '60 Minuten', text: 'etwa 6 Übungen' },
          { value: '75', label: '75 Minuten', text: 'etwa 7 Übungen' },
          { value: '90', label: '90 Minuten', text: 'bis zu 8 Übungen' },
        ]}
      />
    ),
  },
  {
    id: 'cardio',
    label: 'Cardio',
    summary: (p) => CARDIO_LEVEL[p.cardioLevel].label,
    title: 'Wie viel Cardio möchtest du?',
    render: (p, update) => (
      <div className="stack" style={{ gap: 20 }}>
        <OptionList<CardioLevel>
          value={p.cardioLevel}
          onChange={(cardioLevel) => update({ cardioLevel })}
          options={entries(CARDIO_LEVEL).map(([value, o]) => ({ value, ...o }))}
        />
        {p.cardioLevel !== 'none' && (
          <div className="stack">
            <div className="card-label">Was machst du gern?</div>
            <MultiOptionList<CardioType>
              value={p.cardioTypes}
              onChange={(cardioTypes) => update({ cardioTypes })}
              options={entries(CARDIO_TYPES).map(([value, label]) => ({ value, label }))}
            />
          </div>
        )}
      </div>
    ),
  },
  {
    id: 'diet',
    label: 'Ernährungsstil',
    summary: (p) => DIET_STYLES[p.dietStyle].label,
    title: 'Wie möchtest du dich ernähren?',
    hint: 'Das ändert die Verteilung von Eiweiß, Kohlenhydraten und Fett.',
    render: (p, update) => (
      <OptionList<DietStyle>
        value={p.dietStyle}
        onChange={(dietStyle) => update({ dietStyle })}
        options={entries(DIET_STYLES).map(([value, o]) => ({
          value,
          label: o.label,
          text: o.text,
          badge: value === recommendedDiet(p.goal) ? 'Empfohlen' : undefined,
        }))}
      />
    ),
  },
]

export function questionById(id: string): Question {
  return QUESTIONS.find((q) => q.id === id)!
}
