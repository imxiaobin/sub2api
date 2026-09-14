<template>
  <div class="flex flex-col gap-1">
    <!-- Spark shadows always inherit the parent's proxy, so they stay read-only here. -->
    <div v-if="!editable" class="flex items-center gap-2">
      <template v-if="account.proxy">
        <span class="text-sm text-gray-700 dark:text-gray-300">{{ account.proxy.name }}</span>
        <span v-if="account.proxy.country_code" class="text-xs text-gray-500 dark:text-gray-400">
          ({{ account.proxy.country_code }})
        </span>
      </template>
      <span v-else class="text-sm text-gray-400 dark:text-dark-500">-</span>
    </div>

    <button
      v-else
      ref="triggerRef"
      type="button"
      data-testid="account-proxy-trigger"
      :disabled="saving"
      :title="t('admin.accounts.proxy')"
      @click.stop="toggle"
      class="flex w-full items-center gap-2 rounded-lg border border-transparent px-1 py-0.5 text-left transition-colors hover:border-gray-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-dark-600 dark:hover:bg-dark-700"
    >
      <template v-if="account.proxy">
        <span class="truncate text-sm text-gray-700 dark:text-gray-300">{{ account.proxy.name }}</span>
        <span v-if="account.proxy.country_code" class="text-xs text-gray-500 dark:text-gray-400">
          ({{ account.proxy.country_code }})
        </span>
      </template>
      <span v-else class="text-sm text-gray-400 dark:text-dark-500">-</span>
      <Icon name="chevronDown" size="xs" class="ml-auto shrink-0 text-gray-400" />
    </button>

    <div v-if="account.proxy && account.proxy.expires_at" class="flex items-center gap-2 text-xs">
      <span class="text-gray-600 dark:text-gray-300">{{ formatDateTime(account.proxy.expires_at) }}</span>
      <span :class="proxyExpiryBadgeClass(account.proxy.expires_at, account.proxy.status)">
        {{ expiryText }}
      </span>
    </div>

    <div v-if="account.proxy_fallback_origin_id" class="flex items-center gap-1">
      <span
        class="inline-flex items-center rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
        :title="t('admin.accounts.fallbackActiveTip', { origin: account.proxy_fallback_origin_name })"
      >
        {{ t('admin.accounts.fallbackActive') }}
      </span>
      <button
        class="rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100 dark:border-dark-600 dark:text-gray-300 dark:hover:bg-dark-700"
        @click.stop="emit('revert-fallback')"
      >
        {{ t('admin.accounts.revertProxy') }}
      </button>
    </div>

    <Teleport to="body">
      <div v-if="showDropdown" class="fixed inset-0 z-40" @click="close" />
      <div
        v-if="showDropdown"
        ref="dropdownRef"
        data-testid="account-proxy-dropdown"
        class="fixed z-50 flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-dark-600 dark:bg-dark-800"
        :style="dropdownStyle"
        @click.stop
      >
        <div class="flex items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-dark-700">
          <Icon name="search" size="sm" class="shrink-0 text-gray-400" />
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            :placeholder="t('admin.proxies.searchProxies')"
            class="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-gray-100 dark:placeholder:text-dark-400"
          />
        </div>
        <div class="overflow-y-auto py-1">
          <button
            type="button"
            data-testid="account-proxy-option-none"
            @click="select(null)"
            :class="[
              'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-dark-700',
              account.proxy_id === null
                ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                : 'text-gray-700 dark:text-gray-300'
            ]"
          >
            <span class="truncate">{{ t('admin.accounts.noProxy') }}</span>
            <Icon v-if="account.proxy_id === null" name="check" size="sm" class="shrink-0 text-primary-500" />
          </button>
          <button
            v-for="proxy in filteredProxies"
            :key="proxy.id"
            type="button"
            :data-testid="`account-proxy-option-${proxy.id}`"
            @click="select(proxy.id)"
            :class="[
              'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-dark-700',
              account.proxy_id === proxy.id
                ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                : 'text-gray-700 dark:text-gray-300'
            ]"
          >
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2">
                <span class="truncate font-medium">{{ proxy.name }}</span>
                <span
                  v-if="proxy.country_code"
                  class="shrink-0 text-xs text-gray-500 dark:text-gray-400"
                >
                  ({{ proxy.country_code }})
                </span>
              </span>
              <span class="block truncate text-xs text-gray-500 dark:text-gray-400">
                {{ proxy.protocol }}://{{ proxy.host }}:{{ proxy.port }}
              </span>
            </span>
            <Icon v-if="account.proxy_id === proxy.id" name="check" size="sm" class="shrink-0 text-primary-500" />
          </button>
          <div
            v-if="filteredProxies.length === 0 && searchQuery"
            class="px-3 py-6 text-center text-sm text-gray-500 dark:text-dark-400"
          >
            {{ t('common.noOptionsFound') }}
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { formatDateTime } from '@/utils/format'
import { getFloatingPanelPosition } from '@/utils/floatingPanel'
import { proxyExpiryBadgeClass, proxyExpiryLabelKey } from '@/utils/proxyExpiry'
import type { Account, AccountListItem, Proxy } from '@/types'

interface Props {
  account: Account | AccountListItem
  proxies: Proxy[]
  // Spark shadows inherit the parent's proxy; the backend ignores proxy updates on them.
  editable?: boolean
  saving?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  editable: true,
  saving: false
})

const emit = defineEmits<{
  save: [proxyID: number | null]
  'revert-fallback': []
}>()

const { t } = useI18n()

const triggerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const showDropdown = ref(false)
const searchQuery = ref('')
const position = ref({ top: null as number | null, bottom: null as number | null, left: 0, width: 288, maxHeight: 320 })

const expiryText = computed(() => {
  const proxy = props.account.proxy
  if (!proxy) return ''
  const { key, params } = proxyExpiryLabelKey(proxy.expires_at, proxy.status)
  return params ? t(key, params) : t(key)
})

const dropdownStyle = computed(() => ({
  top: position.value.top === null ? 'auto' : `${position.value.top}px`,
  bottom: position.value.bottom === null ? 'auto' : `${position.value.bottom}px`,
  left: `${position.value.left}px`,
  width: `${position.value.width}px`,
  maxHeight: `${position.value.maxHeight}px`
}))

const filteredProxies = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return props.proxies
  return props.proxies.filter(
    proxy => proxy.name.toLowerCase().includes(query) || proxy.host.toLowerCase().includes(query)
  )
})

const updatePosition = () => {
  const trigger = triggerRef.value
  if (!trigger) return
  position.value = getFloatingPanelPosition(
    trigger.getBoundingClientRect(),
    window.innerWidth,
    window.innerHeight,
    { maxWidth: 288, viewportPadding: 8 }
  )
}

const close = () => {
  showDropdown.value = false
  searchQuery.value = ''
}

const toggle = async () => {
  if (showDropdown.value) {
    close()
    return
  }
  showDropdown.value = true
  await nextTick()
  updatePosition()
  searchInputRef.value?.focus()
}

const select = (proxyID: number | null) => {
  close()
  if (proxyID === (props.account.proxy_id ?? null)) return
  emit('save', proxyID)
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition, true)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition, true)
})
</script>
