import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

import AccountsView from '../AccountsView.vue'
import type { Account, Proxy } from '@/types'

const {
  listAccounts,
  listWithEtag,
  getBatchTodayStats,
  getAllProxies,
  getAllGroups,
  updateAccount,
  showSuccess,
  showError
} = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  listWithEtag: vi.fn(),
  getBatchTodayStats: vi.fn(),
  getAllProxies: vi.fn(),
  getAllGroups: vi.fn(),
  updateAccount: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn()
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    accounts: {
      list: listAccounts,
      listWithEtag,
      getBatchTodayStats,
      update: updateAccount,
      checkMixedChannelRisk: vi.fn(),
      duplicate: vi.fn(),
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
  useAuthStore: () => ({ token: 'test-token', isSimpleMode: false })
}))

vi.mock('@/stores', async importOriginal => {
  const actual = await importOriginal<typeof import('@/stores')>()
  return {
    ...actual,
    useAuthStore: () => ({ token: 'test-token', isSimpleMode: false }),
    useAppStore: () => ({ showError, showSuccess, showInfo: vi.fn() })
  }
})

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  }
})

const proxy = (id: number, name: string, host: string): Proxy =>
  ({
    id,
    name,
    protocol: 'http',
    host,
    port: 8080,
    username: null,
    status: 'active'
  }) as Proxy

const allProxies = [proxy(1, '日本', 'jp.example.com'), proxy(2, 'default', 'us.example.com')]

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 42,
    name: 'acc',
    platform: 'openai',
    type: 'oauth',
    proxy_id: 1,
    proxy: allProxies[0],
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
    group_ids: [],
    ...overrides
  } as Account
}

const DataTableStub = defineComponent({
  props: { data: { type: Array, default: () => [] } },
  template: '<div><div v-for="row in data" :key="row.id"><slot name="cell-proxy" :row="row" /></div></div>'
})

const mountView = () =>
  mount(AccountsView, {
    attachTo: document.body,
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        TablePageLayout: {
          template: '<div><slot name="filters" /><slot name="table" /><slot name="pagination" /></div>'
        },
        DataTable: DataTableStub,
        Pagination: true,
        ConfirmDialog: true,
        AccountTableActions: { template: '<div></div>' },
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
        UpstreamBillingRateCell: true,
        HelpTooltip: true,
        Icon: true
      }
    }
  })

const openDropdown = async (wrapper: ReturnType<typeof mountView>) => {
  await wrapper.get('[data-testid="account-proxy-trigger"]').trigger('click')
  await flushPromises()
}

const option = (testid: string) =>
  document.querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`)!

describe('admin AccountsView — 代理列内联下拉', () => {
  beforeEach(() => {
    localStorage.clear()
    for (const fn of [
      listAccounts,
      listWithEtag,
      getBatchTodayStats,
      getAllProxies,
      getAllGroups,
      updateAccount,
      showSuccess,
      showError
    ]) {
      fn.mockReset()
    }
    listAccounts.mockResolvedValue({ items: [makeAccount()], total: 1, page: 1, page_size: 20, pages: 1 })
    listWithEtag.mockResolvedValue({ notModified: true, etag: null, data: null })
    getBatchTodayStats.mockResolvedValue({ stats: {} })
    getAllProxies.mockResolvedValue(allProxies)
    getAllGroups.mockResolvedValue([])
    updateAccount.mockImplementation(async (_id: number, updates: { proxy_id?: number }) =>
      makeAccount({
        proxy_id: updates.proxy_id === 0 ? null : (updates.proxy_id ?? 1),
        proxy: updates.proxy_id ? allProxies.find(p => p.id === updates.proxy_id) : undefined
      })
    )
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('选择另一个代理会立即提交', async () => {
    const wrapper = mountView()
    await flushPromises()

    await openDropdown(wrapper)
    expect(document.querySelector('[data-testid="account-proxy-dropdown"]')).toBeTruthy()

    option('account-proxy-option-2').click()
    await flushPromises()

    expect(updateAccount).toHaveBeenCalledTimes(1)
    expect(updateAccount).toHaveBeenCalledWith(42, { proxy_id: 2 })
    expect(showSuccess).toHaveBeenCalledWith('admin.accounts.proxyUpdated')
    wrapper.unmount()
  })

  it('选择「不使用代理」时发送 0 表示清除', async () => {
    const wrapper = mountView()
    await flushPromises()

    await openDropdown(wrapper)
    option('account-proxy-option-none').click()
    await flushPromises()

    expect(updateAccount).toHaveBeenCalledWith(42, { proxy_id: 0 })
    wrapper.unmount()
  })

  it('重复选中当前代理不发请求', async () => {
    const wrapper = mountView()
    await flushPromises()

    await openDropdown(wrapper)
    option('account-proxy-option-1').click()
    await flushPromises()

    expect(updateAccount).not.toHaveBeenCalled()
    expect(document.querySelector('[data-testid="account-proxy-dropdown"]')).toBeFalsy()
    wrapper.unmount()
  })

  it('影子账号的代理列只读（继承母账号）', async () => {
    listAccounts.mockResolvedValue({
      items: [makeAccount({ parent_account_id: 7 })],
      total: 1,
      page: 1,
      page_size: 20,
      pages: 1
    })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="account-proxy-trigger"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('日本')
    wrapper.unmount()
  })

  it('保存失败时显示后端错误', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    updateAccount.mockRejectedValueOnce(new Error('proxy update failed'))
    const wrapper = mountView()
    await flushPromises()

    await openDropdown(wrapper)
    option('account-proxy-option-2').click()
    await flushPromises()

    expect(showError).toHaveBeenCalledWith('proxy update failed')
    consoleError.mockRestore()
    wrapper.unmount()
  })
})
