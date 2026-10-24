export type DealKind = 'transfer' | 'loan' | 'free' | 'release' | 'retired';

export interface Deal {
  season: number;
  week: number;
  kind: DealKind;
  playerId: string;
  name: string;
  /** Overall at the time, so the list can show who is a big name. */
  ovr: number;
  from: string | null;
  to: string | null;
  fee: number;
}
