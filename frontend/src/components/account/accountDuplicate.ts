import type { Account } from '@/types'

// Account types whose credentials can be copied verbatim into a new account.
// oauth / setup-token rotate their refresh token, so a copy and its source share one credential:
// whichever refreshes first wins if the provider rotates it, and the other needs re-authorization.
// The backend still creates every duplicate unschedulable so that stays a reviewed choice.
const DUPLICABLE_ACCOUNT_TYPES = [
  'apikey',
  'upstream',
  'bedrock',
  'service_account',
  'oauth',
  'setup-token'
]

// Mirrors canDuplicateAccountType in backend/internal/service/admin_account.go.
// Linked credential shadows are excluded because they own no credentials of their own.
export function canDuplicateAccount(account: Account | null | undefined): boolean {
  if (!account || account.parent_account_id != null) return false
  return DUPLICABLE_ACCOUNT_TYPES.includes(account.type)
}

// Types whose credential rotates upstream, so a duplicate and its source share one live token.
const ROTATING_CREDENTIAL_TYPES = ['oauth', 'setup-token']

export function sharesRotatingCredential(account: Account | null | undefined): boolean {
  if (!account) return false
  return ROTATING_CREDENTIAL_TYPES.includes(account.type)
}
