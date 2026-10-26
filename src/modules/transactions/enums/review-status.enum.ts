// OPEN is never stored: a flagged transaction with no review row is open
export enum ReviewStatus {
  OPEN = 'OPEN',
  IN_REVIEW = 'IN_REVIEW',
  CLOSED = 'CLOSED',
}
