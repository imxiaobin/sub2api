import { describe, expect, it } from 'vitest'

import { canDuplicateAccount, sharesRotatingCredential } from '../accountDuplicate'
import type { Account } from '@/types'

const account = (overrides: Partial<Account>) => ({ id: 1, ...overrides }) as Account

describe('canDuplicateAccount', () => {
  // Must stay in step with canDuplicateAccountType in backend/internal/service/admin_account.go.
  it.each(['apikey', 'upstream', 'bedrock', 'service_account', 'oauth', 'setup-token'])(
    'allows %s',
    type => {
      expect(canDuplicateAccount(account({ type: type as Account['type'] }))).toBe(true)
    }
  )

  it('rejects unknown types', () => {
    expect(canDuplicateAccount(account({ type: 'legacy-cookie' as Account['type'] }))).toBe(false)
  })

  it('rejects credential shadows, which own no credentials to copy', () => {
    expect(canDuplicateAccount(account({ type: 'oauth', parent_account_id: 7 }))).toBe(false)
  })

  it('rejects a missing account', () => {
    expect(canDuplicateAccount(null)).toBe(false)
    expect(canDuplicateAccount(undefined)).toBe(false)
  })
})

describe('sharesRotatingCredential', () => {
  it.each(['oauth', 'setup-token'])('flags %s', type => {
    expect(sharesRotatingCredential(account({ type: type as Account['type'] }))).toBe(true)
  })

  it.each(['apikey', 'upstream', 'bedrock', 'service_account'])('does not flag %s', type => {
    expect(sharesRotatingCredential(account({ type: type as Account['type'] }))).toBe(false)
  })

  it('does not flag a missing account', () => {
    expect(sharesRotatingCredential(null)).toBe(false)
  })
})
