// ACTIVE: can log in. New sign-ups are active straight away.
// DEACTIVATED: cannot log in. Set only directly in the database.
export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  DEACTIVATED = 'DEACTIVATED',
}
