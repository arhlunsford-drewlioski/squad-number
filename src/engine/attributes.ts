// The attribute suite. Values live on a 1-20 scale (floats in the engine, integers in the UI).

export type AttrGroup = 'technical' | 'mental' | 'physical' | 'goalkeeping';

export const GROUPS: { id: AttrGroup; label: string }[] = [
  { id: 'technical', label: 'Technical' },
  { id: 'mental', label: 'Mental' },
  { id: 'physical', label: 'Physical' },
  { id: 'goalkeeping', label: 'Goalkeeping' },
];

const defs = [
  ['finishing', 'Finishing', 'technical'],
  ['longShots', 'Long Shots', 'technical'],
  ['passing', 'Passing', 'technical'],
  ['firstTouch', 'First Touch', 'technical'],
  ['dribbling', 'Dribbling', 'technical'],
  ['crossing', 'Crossing', 'technical'],
  ['heading', 'Heading', 'technical'],
  ['tackling', 'Tackling', 'technical'],
  ['marking', 'Marking', 'technical'],
  ['technique', 'Technique', 'technical'],
  ['composure', 'Composure', 'mental'],
  ['vision', 'Vision', 'mental'],
  ['decisions', 'Decisions', 'mental'],
  ['positioning', 'Positioning', 'mental'],
  ['offTheBall', 'Off the Ball', 'mental'],
  ['anticipation', 'Anticipation', 'mental'],
  ['workRate', 'Work Rate', 'mental'],
  ['aggression', 'Aggression', 'mental'],
  ['concentration', 'Concentration', 'mental'],
  ['pace', 'Pace', 'physical'],
  ['acceleration', 'Acceleration', 'physical'],
  ['stamina', 'Stamina', 'physical'],
  ['strength', 'Strength', 'physical'],
  ['agility', 'Agility', 'physical'],
  ['balance', 'Balance', 'physical'],
  ['jumping', 'Jumping', 'physical'],
  ['handling', 'Handling', 'goalkeeping'],
  ['reflexes', 'Reflexes', 'goalkeeping'],
  ['aerialReach', 'Aerial Reach', 'goalkeeping'],
  ['commandOfArea', 'Command of Area', 'goalkeeping'],
  ['kicking', 'Kicking', 'goalkeeping'],
  ['oneOnOnes', 'One on Ones', 'goalkeeping'],
] as const;

export type AttrId = (typeof defs)[number][0];
export type Attrs = Record<AttrId, number>;

export interface AttrDef {
  id: AttrId;
  label: string;
  group: AttrGroup;
}

export const ATTR_DEFS: AttrDef[] = defs.map(([id, label, group]) => ({ id, label, group }));
export const ATTR_IDS: AttrId[] = ATTR_DEFS.map(d => d.id);
export const ATTR_BY_ID = Object.fromEntries(ATTR_DEFS.map(d => [d.id, d])) as Record<AttrId, AttrDef>;
export const attrsIn = (g: AttrGroup): AttrDef[] => ATTR_DEFS.filter(d => d.group === g);

// Hidden attributes: never shown as numbers. They drive training rate, injuries and form swings.
export const HIDDEN_DEFS = [
  ['professionalism', 'Professionalism'],
  ['determination', 'Determination'],
  ['naturalFitness', 'Natural Fitness'],
  ['injuryProneness', 'Injury Proneness'],
  ['consistency', 'Consistency'],
  ['bigMatches', 'Big Matches'],
] as const;
export type HiddenId = (typeof HIDDEN_DEFS)[number][0];
export type Hidden = Record<HiddenId, number>;

export function emptyAttrs(fill = 1): Attrs {
  return Object.fromEntries(ATTR_IDS.map(id => [id, fill])) as Attrs;
}
