// The questions of the profile check. The settings page reuses them to edit the profile.
import type { ReactNode } from 'react'
import { BigNumber, MultiOptionList, OptionList, Segmented, WeekdayPicker } from './fields'
import { ACTIVITY, CARDIO_LEVEL, CARDIO_TYPES, EXPERIENCE, GOALS, HOME_EQUIPMENT } from '../lib/labels'
import { DIET_STYLES, recommendedDiet } from '../lib/nutrition'
import type { Activity, CardioLevel, CardioType, DietStyle, Equipment, Experience, Goal, Profile } from '../lib/types'

export interface Question {
  id: string
  title: string
  hint?: string
  // hide the question for some answers (e.g. equipment only for home training)
  show?: (p: Profile) => boolean
  valid?: (p: Profile) => boolean
  render: (p: Profile, update: (changes: Partial<Profile>) => void) => ReactNode
}

function entries<K extends string, V>(record: Record<K, V>): [K, V][] {
  return Object.entries(record) as [K, V][]
}

const between = (n: number, min: number, max: number) => Number.isFinite(n) && n >= min && n <= max

export const QUESTIONS: Question[] = [
  {
    id: 'sex',
    title: 'Dein Geschlecht',
    hint: 'Brauchen wir für die Berechnung deines Kalorienbedarfs.',
    render: (p, update) => (
      <OptionList
        value={p.sex}
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
    title: 'Wie alt bist du?',
    valid: (p) => between(p.age, 14, 100),
    render: (p, update) => <BigNumber value={p.age} onChange={(age) => update({ age })} unit="Jahre" min={14} max={100} />,
  },
  {
    id: 'height',
    title: 'Wie groß bist du?',
    valid: (p) => between(p.heightCm, 120, 230),
    render: (p, update) => <BigNumber value={p.heightCm} onChange={(heightCm) => update({ heightCm })} unit="cm" min={120} max={230} />,
  },
  {
    id: 'weight',
    title: 'Wie viel wiegst du?',
    hint: 'Am besten morgens nach dem Aufstehen gewogen.',
    valid: (p) => between(p.weightKg, 30, 300),
    render: (p, update) => <BigNumber value={p.weightKg} onChange={(weightKg) => update({ weightKg })} unit="kg" min={30} max={300} step={0.1} />,
  },
  {
    id: 'activity',
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
    title: 'Was ist dein Ziel?',
    render: (p, update) => (
      <OptionList<Goal>
        value={p.goal}
        // the matching diet style comes with the goal, it can be changed later
        onChange={(goal) => update({ goal, dietStyle: recommendedDiet(goal) })}
        options={entries(GOALS).map(([value, o]) => ({ value, ...o }))}
      />
    ),
  },
  {
    id: 'experience',
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
    title: 'Wie lange hast du pro Training Zeit?',
    hint: 'Nur das Krafttraining. Cardio planen wir extra ein.',
    render: (p, update) => (
      <OptionList
        value={String(p.sessionMinutes)}
        onChange={(v) => update({ sessionMinutes: Number(v) })}
        options={[
          { value: '30', label: '30 Minuten', text: '4 Übungen' },
          { value: '45', label: '45 Minuten', text: '5 Übungen' },
          { value: '60', label: '60 Minuten', text: '6 Übungen' },
          { value: '75', label: '75 Minuten', text: '7 Übungen' },
          { value: '90', label: '90 Minuten', text: '8 Übungen' },
        ]}
      />
    ),
  },
  {
    id: 'cardio',
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

// used in settings where there is less space than in the questionnaire
export function SexSwitch({ value, onChange }: { value: Profile['sex']; onChange: (v: Profile['sex']) => void }) {
  return (
    <Segmented
      value={value}
      onChange={onChange}
      options={[
        { value: 'female', label: 'Frau' },
        { value: 'male', label: 'Mann' },
      ]}
    />
  )
}
