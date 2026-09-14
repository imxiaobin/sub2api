import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

import AccountsView from '../AccountsView.vue'
import type { Account } from '@/types'

const {
  listAccounts,
  listWithEtag,
  getBatchTodayStats,
  getAllProxies,
  getAllGroups,
  duplicateAccount,
  showSuccess,
  showError
} = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  listWithEtag: vi.fn(),
  getBatchTodayStats: vi.fn(),
  getAllProxies: vi.fn(),
  getAllGroups: vi.fn(),
  duplicateAccount: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn()
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    accounts: {
      list: listAccounts,
      listWithEtag,
      getBatchTodayStats,
      duplicate: duplicateAccount,
      getUpstreamBillingProbeSettings: vi.fn().mockResolvedValue({ enabled: true, interval_minutes: 30 }),
      createSparkShadow: vi.fn(),
      delete: vi.fn(),
      batchClearError: vi.fn(),
      batchRefresh: vi.fn(),
      toggleSchedulable: vi.fn()
    },
    proxies: { getAll: getAllProxies },
    groups: { getAll: getAllGroups }
  }
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError, showSuccess, showInfo: vi.fn() })
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ token: 'test-token' })
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  }
})

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 42,
    name: 'parent-acc',
    platform: 'openai',
    type: 'oauth',
    proxy_id: null,
    concurrency: 3,
    priority: 50,
    status: 'active',
    error_message: null,
    last_used_at: null,
    expires_at: null,
    auto_pause_on_expired: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    schedulable: true,
    rate_limited_at: null,
    rate_limit_reset_at: null,
    overload_until: null,
    temp_unschedulable_until: null,
    temp_unschedulable_reason: null,
    session_window_start: null,
    session_window_end: null,
    session_window_status: null,
    ...overrides
  } as Account
}

// Renders only the actions cell for each row, which is what this spec drives.
const DataTableStub = defineComponent({
  props: {
    data: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false }
  },
  template: '<div><div v-for="row in data" :key="row.id"><slot name="cell-actions" :row="row" /></div></div>'
})

const mountView = () =>
  mount(AccountsView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        TablePageLayout: {
          template: '<div><slot name="filters" /><slot name="table" /><slot name="pagination" /></div>'
        },
        DataTable: DataTableStub,
        Pagination: true,
        ConfirmDialog: true,
        AccountTableActions: { template: '<div><slot name="beforeCreate" /><slot name="after" /></div>' },
        AccountTableFilters: { template: '<div></div>' },
        AccountBulkActionsBar: true,
        AccountActionMenu: true,
        ImportDataModal: true,
        ReAuthAccountModal: true,
        AccountTestModal: true,
        AccountStatsModal: true,
        ScheduledTestsPanel: true,
        SyncFromCrsModal: true,
        TempUnschedStatusModal: true,
        ErrorPassthroughRulesModal: true,
        TLSFingerprintProfilesModal: true,
        CreateAccountModal: true,
        EditAccountModal: true,
        BulkEditAccountModal: true,
        PlatformTypeBadge: true,
        AccountCapacityCell: true,
        AccountStatusIndicator: true,
        AccountTodayStatsCell: true,
        AccountGroupsCell: true,
        AccountUsageCell: true,
        Icon: true
      }
    }
  })

function listReturns(accounts: Account[]) {
  listAccounts.mockResolvedValue({
    items: accounts,
    total: accounts.length,
    page: 1,
    page_size: 20,
    pages: 1
  })
}

describe('admin AccountsView — 操作列复制账号', () => {
  beforeEach(() => {
    localStorage.clear()
    for (const fn of [
      listAccounts,
      listWithEtag,
      getBatchTodayStats,
      getAllProxies,
      getAllGroups,
      duplicateAccount,
      showSuccess,
      showError
    ]) {
      fn.mockReset()
    }
    listReturns([makeAccount()])
    listWithEtag.mockResolvedValue({ notModified: true, etag: null, data: null })
    getBatchTodayStats.mockResolvedValue({ stats: {} })
    getAllProxies.mockResolvedValue([])
    getAllGroups.mockResolvedValue([])
    duplicateAccount.mockResolvedValue({ id: 998, name: 'parent-acc (Copy)' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('复制 OAuth 账号并刷新列表，提示共用凭据', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="account-duplicate"]').trigger('click')
    await flushPromises()

    expect(duplicateAccount).toHaveBeenCalledTimes(1)
    expect(duplicateAccount).toHaveBeenCalledWith(42)
    expect(showSuccess).toHaveBeenCalledWith('admin.accounts.duplicateSharedCredentialSuccess')
    expect(listAccounts.mock.calls.length).toBeGreaterThan(1)
    wrapper.unmount()
  })

  it('非轮换凭据账号使用普通成功提示', async () => {
    listReturns([makeAccount({ platform: 'anthropic', type: 'apikey' })])
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="account-duplicate"]').trigger('click')
    await flushPromises()

    expect(showSuccess).toHaveBeenCalledWith('admin.accounts.duplicateSuccess')
    wrapper.unmount()
  })

  it('影子账号不显示复制按钮', async () => {
    listReturns([makeAccount({ parent_account_id: 7 })])
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="account-duplicate"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('复制请求未完成时按钮禁用并忽略重复点击', async () => {
    let resolveDuplicate!: (account: { id: number; name: string }) => void
    duplicateAccount.mockImplementationOnce(
      () => new Promise(resolve => {
        resolveDuplicate = resolve
      })
    )
    const wrapper = mountView()
    await flushPromises()

    const button = wrapper.get('[data-testid="account-duplicate"]')
    await button.trigger('click')
    await flushPromises()
    expect(button.attributes('disabled')).toBeDefined()

    await button.trigger('click')
    await flushPromises()
    expect(duplicateAccount).toHaveBeenCalledTimes(1)

    resolveDuplicate({ id: 998, name: 'parent-acc (Copy)' })
    await flushPromises()
    wrapper.unmount()
  })

  it('复制失败时显示后端错误', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    duplicateAccount.mockRejectedValueOnce(new Error('duplicate failed'))
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="account-duplicate"]').trigger('click')
    await flushPromises()

    expect(showError).toHaveBeenCalledWith('duplicate failed')
    consoleError.mockRestore()
    wrapper.unmount()
  })
})
