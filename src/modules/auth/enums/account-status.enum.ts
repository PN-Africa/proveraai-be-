// PENDING: signed up, waiting for an admin to approve. Cannot log in.
// ACTIVE: approved (or seeded). Can log in.
// DEACTIVATED: switched off by an admin. Cannot log in; sessions are ended.
export enum AccountStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  DEACTIVATED = 'DEACTIVATED',
}

// Approved accounts, shown as workspace members
export const MEMBER_STATUSES = [AccountStatus.ACTIVE, AccountStatus.DEACTIVATED] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
