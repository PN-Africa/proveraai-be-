// Derived, never stored: a flagged transaction is OPEN until it has a
// review (a decision), then CLOSED
export enum ReviewStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}
