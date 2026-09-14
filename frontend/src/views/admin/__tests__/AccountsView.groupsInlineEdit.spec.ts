import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

import AccountsView from '../AccountsView.vue'
import type { Account, AdminGroup } from '@/types'

const {
  listAccounts,
  listWithEtag,
  getBatchTodayStats,
  getAllProxies,
  getAllGroups,
  updateAccount,
  checkMixedChannelRisk,
  showSuccess,
  showError
} = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  listWithEtag: vi.fn(),
  getBatchTodayStats: vi.fn(),
  getAllProxies: vi.fn(),
  getAllGroups: vi.fn(),
  updateAccount: vi.fn(),
  checkMixedChannelRisk: vi.fn(),
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
      checkMixedChannelRisk,
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

// GroupSelector pulls useAuthStore from the barrel, and other stubs reach for useAppStore there.
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

const group = (id: number, name: string, platform = 'openai'): AdminGroup =>
  ({ id, name, platform, account_count: 1, rate_multiplier: 1 }) as AdminGroup

const allGroups = [group(1, 'codex'), group(2, 'codex-pro'), group(3, '真pro')]

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 42,
    name: 'acc',
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
    group_ids: [1],
    ...overrides
  } as Account
}

const DataTableStub = defineComponent({
  props: { data: { type: Array, default: () => [] } },
  template: '<div><div v-for="row in data" :key="row.id"><slot name="cell-groups" :row="row" /></div></div>'
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
        AccountUsageCell: true,
        UpstreamBillingRateCell: true,
        HelpTooltip: true,
        Icon: true
      }
    }
  })

const openEditor = async (wrapper: ReturnType<typeof mountView>) => {
  await wrapper.get('[data-testid="account-groups-trigger"]').trigger('click')
  await flushPromises()
}

const checkboxes = () =>
  Array.from(
    document.querySelectorAll<HTMLInputElement>('[data-testid="account-groups-editor"] input[type="checkbox"]')
  )

const saveButton = () =>
  document.querySelector<HTMLButtonElement>('[data-testid="account-groups-save"]')!

describe('admin AccountsView — 分组列内联多选', () => {
  beforeEach(() => {
    localStorage.clear()
    for (const fn of [
      listAccounts,
      listWithEtag,
      getBatchTodayStats,
      getAllProxies,
      getAllGroups,
      updateAccount,
      checkMixedChannelRisk,
      showSuccess,
      showError
    ]) {
      fn.mockReset()
    }
    listAccounts.mockResolvedValue({ items: [makeAccount()], total: 1, page: 1, page_size: 20, pages: 1 })
    listWithEtag.mockResolvedValue({ notModified: true, etag: null, data: null })
    getBatchTodayStats.mockResolvedValue({ stats: {} })
    getAllProxies.mockResolvedValue([])
    getAllGroups.mockResolvedValue(allGroups)
    updateAccount.mockImplementation(async (_id: number, updates: { group_ids?: number[] }) =>
      makeAccount({ group_ids: updates.group_ids ?? [1] })
    )
    checkMixedChannelRisk.mockResolvedValue({ has_risk: false })
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('打开下拉、勾选后保存，提交完整 group_ids', async () => {
    const wrapper = mountView()
    await flushPromises()

    await openEditor(wrapper)
    expect(document.querySelector('[data-testid="account-groups-editor"]')).toBeTruthy()

    const boxes = checkboxes()
    expect(boxes).toHaveLength(allGroups.length)
    expect(boxes[0].checked).toBe(true)

    boxes[1].click()
    await flushPromises()

    saveButton().click()
    await flushPromises()

    expect(updateAccount).toHaveBeenCalledTimes(1)
    expect(updateAccount).toHaveBeenCalledWith(42, { group_ids: [1, 2] })
    expect(showSuccess).toHaveBeenCalledWith('admin.accounts.groupsUpdated')
    wrapper.unmount()
  })

  it('取消勾选可以清空分组', async () => {
    const wrapper = mountView()
    await flushPromises()

    await openEditor(wrapper)
    checkboxes()[0].click()
    await flushPromises()

    saveButton().click()
    await flushPromises()

    expect(updateAccount).toHaveBeenCalledWith(42, { group_ids: [] })
    wrapper.unmount()
  })

  it('未改动时保存按钮禁用', async () => {
    const wrapper = mountView()
    await flushPromises()

    await openEditor(wrapper)
    expect(saveButton().disabled).toBe(true)
    wrapper.unmount()
  })

  it('openai 账号不触发混合渠道检查', async () => {
    const wrapper = mountView()
    await flushPromises()

    await openEditor(wrapper)
    checkboxes()[1].click()
    await flushPromises()
    saveButton().click()
    await flushPromises()

    expect(checkMixedChannelRisk).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('anthropic 账号有混合渠道风险时先确认再提交', async () => {
    listAccounts.mockResolvedValue({
      items: [makeAccount({ platform: 'anthropic' })],
      total: 1,
      page: 1,
      page_size: 20,
      pages: 1
    })
    getAllGroups.mockResolvedValue([
      group(1, 'a-group', 'anthropic'),
      group(2, 'b-group', 'anthropic')
    ])
    checkMixedChannelRisk.mockResolvedValue({
      has_risk: true,
      message: 'risky',
      details: { group_id: 2, group_name: 'b-group', current_platform: 'anthropic', other_platform: 'openai' }
    })

    const wrapper = mountView()
    await flushPromises()

    await openEditor(wrapper)
    checkboxes()[1].click()
    await flushPromises()
    saveButton().click()
    await flushPromises()

    expect(checkMixedChannelRisk).toHaveBeenCalledWith({
      platform: 'anthropic',
      group_ids: [1, 2],
      account_id: 42
    })
    // Held at the confirmation step: nothing written yet.
    expect(updateAccount).not.toHaveBeenCalled()

    // The view renders several ConfirmDialogs; the shown one is the mixed-channel warning.
    const dialog = wrapper
      .findAllComponents({ name: 'ConfirmDialog' })
      .find(component => component.props('show') === true)
    expect(dialog).toBeDefined()
    expect(dialog!.props('message')).toBe('admin.accounts.mixedChannelWarning')

    dialog!.vm.$emit('confirm')
    await flushPromises()

    expect(updateAccount).toHaveBeenCalledWith(42, { group_ids: [1, 2], confirm_mixed_channel_risk: true })
    wrapper.unmount()
  })

  it('保存失败时显示错误并保持面板打开', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    updateAccount.mockRejectedValueOnce(new Error('update failed'))
    const wrapper = mountView()
    await flushPromises()

    await openEditor(wrapper)
    checkboxes()[1].click()
    await flushPromises()
    saveButton().click()
    await flushPromises()

    expect(showError).toHaveBeenCalledWith('update failed')
    expect(document.querySelector('[data-testid="account-groups-editor"]')).toBeTruthy()
    consoleError.mockRestore()
    wrapper.unmount()
  })
})
