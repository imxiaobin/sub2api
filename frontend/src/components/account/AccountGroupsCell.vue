<template>
  <!-- Editable mode: the badges themselves are the trigger for an inline multi-select dropdown. -->
  <div v-if="editable" class="relative max-w-56">
    <button
      ref="triggerRef"
      type="button"
      data-testid="account-groups-trigger"
      :disabled="saving"
      :title="t('admin.accounts.editGroups')"
      @click.stop="toggleEditor"
      class="w-full rounded-lg border border-transparent p-1 text-left transition-colors hover:border-gray-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-dark-600 dark:hover:bg-dark-700"
    >
      <div v-if="groups && groups.length > 0" class="flex max-h-14 flex-wrap gap-1 overflow-hidden">
        <GroupBadge
          v-for="group in displayGroups"
          :key="group.id"
          :name="group.name"
          :platform="group.platform"
          :subscription-type="group.subscription_type"
          :rate-multiplier="group.rate_multiplier"
          :show-rate="false"
          class="max-w-24"
        />
        <span
          v-if="hiddenCount > 0"
          class="inline-flex items-center gap-0.5 whitespace-nowrap rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-dark-600 dark:text-gray-300"
        >
          +{{ hiddenCount }}
        </span>
      </div>
      <span v-else class="text-sm text-gray-400 dark:text-dark-500">
        {{ t('admin.accounts.noGroupsAssigned') }}
      </span>
    </button>

    <Teleport to="body">
      <div v-if="showEditor" class="fixed inset-0 z-40" @click="closeEditor" />
      <div
        v-if="showEditor"
        ref="editorRef"
        data-testid="account-groups-editor"
        class="fixed z-50 flex flex-col overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-dark-600 dark:bg-dark-800"
        :style="editorStyle"
        @click.stop
      >
        <GroupSelector
          v-model="draftGroupIDs"
          :groups="availableGroups"
          :platform="account?.platform"
          :mixed-scheduling="mixedScheduling"
          searchable
        />
        <div class="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            @click="closeEditor"
            class="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-700"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            data-testid="account-groups-save"
            :disabled="saving || !isDirty"
            @click="handleSave"
            class="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ saving ? t('common.submitting') : t('common.save') }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>

  <div v-else-if="groups && groups.length > 0" class="relative max-w-56">
    <!-- 分组容器：固定最大宽度，最多显示2行 -->
    <div class="flex flex-wrap gap-1 max-h-14 overflow-hidden">
      <GroupBadge
        v-for="group in displayGroups"
        :key="group.id"
        :name="group.name"
        :platform="group.platform"
        :subscription-type="group.subscription_type"
        :rate-multiplier="group.rate_multiplier"
        :show-rate="false"
        class="max-w-24"
      />
      <!-- 更多数量徽章 -->
      <button
        v-if="hiddenCount > 0"
        ref="moreButtonRef"
        @click.stop="showPopover = !showPopover"
        class="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-600 dark:text-gray-300 dark:hover:bg-dark-500 transition-colors cursor-pointer whitespace-nowrap"
      >
        <span>+{{ hiddenCount }}</span>
      </button>
    </div>

    <!-- Popover 显示完整列表 -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="showPopover"
          ref="popoverRef"
          class="fixed z-50 min-w-48 max-w-96 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-dark-600 dark:bg-dark-800"
          :style="popoverStyle"
        >
          <div class="mb-2 flex items-center justify-between">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.groupCountTotal', { count: groups.length }) }}
            </span>
            <button
              @click="showPopover = false"
              class="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-dark-700 dark:hover:text-gray-300"
            >
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto">
            <GroupBadge
              v-for="group in groups"
              :key="group.id"
              :name="group.name"
              :platform="group.platform"
              :subscription-type="group.subscription_type"
              :rate-multiplier="group.rate_multiplier"
              :show-rate="false"
            />
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 点击外部关闭 popover -->
    <div
      v-if="showPopover"
      class="fixed inset-0 z-40"
      @click="showPopover = false"
    />
  </div>
  <span v-else class="text-sm text-gray-400 dark:text-dark-500">-</span>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import GroupBadge from '@/components/common/GroupBadge.vue'
import GroupSelector from '@/components/common/GroupSelector.vue'
import { getFloatingPanelPosition } from '@/utils/floatingPanel'
import type { Account, AccountListItem, AdminGroup, Group } from '@/types'

interface Props {
  groups: Group[] | null | undefined
  maxDisplay?: number
  // Inline editing: the cell needs the owning account (platform filter, current binding)
  // and the full group catalog to offer as options.
  editable?: boolean
  account?: Account | AccountListItem | null
  availableGroups?: AdminGroup[]
  saving?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  maxDisplay: 4,
  editable: false,
  account: null,
  availableGroups: () => [],
  saving: false
})

const emit = defineEmits<{
  save: [groupIDs: number[]]
}>()

const { t } = useI18n()

const moreButtonRef = ref<HTMLElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const showPopover = ref(false)

const triggerRef = ref<HTMLElement | null>(null)
const editorRef = ref<HTMLElement | null>(null)
const showEditor = ref(false)
const draftGroupIDs = ref<number[]>([])
const editorPosition = ref({ top: 0 as number | null, bottom: null as number | null, left: 0, width: 352, maxHeight: 400 })

// 显示的分组（最多显示 maxDisplay 个）
const displayGroups = computed(() => {
  if (!props.groups) return []
  if (props.groups.length <= props.maxDisplay) {
    return props.groups
  }
  // 留一个位置给 +N 按钮
  return props.groups.slice(0, props.maxDisplay - 1)
})

// 隐藏的数量
const hiddenCount = computed(() => {
  if (!props.groups) return 0
  if (props.groups.length <= props.maxDisplay) return 0
  return props.groups.length - (props.maxDisplay - 1)
})

const assignedGroupIDs = computed(() => [...(props.account?.group_ids ?? [])].sort((a, b) => a - b))

// Antigravity accounts may opt into anthropic/gemini groups; GroupSelector needs the flag to widen
// its platform filter the same way the edit modal does.
const mixedScheduling = computed(
  () => (props.account?.extra as Record<string, unknown> | undefined)?.mixed_scheduling === true
)

const isDirty = computed(() => {
  const draft = [...draftGroupIDs.value].sort((a, b) => a - b)
  const assigned = assignedGroupIDs.value
  if (draft.length !== assigned.length) return true
  return draft.some((id, index) => id !== assigned[index])
})

// Popover 位置样式
const popoverStyle = computed(() => {
  if (!moreButtonRef.value) return {}
  const rect = moreButtonRef.value.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth

  let top = rect.bottom + 8
  let left = rect.left

  // 如果下方空间不足，显示在上方
  if (top + 280 > viewportHeight) {
    top = Math.max(8, rect.top - 280)
  }

  // 如果右侧空间不足，向左偏移
  if (left + 384 > viewportWidth) {
    left = Math.max(8, viewportWidth - 392)
  }

  return {
    top: `${top}px`,
    left: `${left}px`
  }
})

const editorStyle = computed(() => ({
  top: editorPosition.value.top === null ? 'auto' : `${editorPosition.value.top}px`,
  bottom: editorPosition.value.bottom === null ? 'auto' : `${editorPosition.value.bottom}px`,
  left: `${editorPosition.value.left}px`,
  width: `${editorPosition.value.width}px`,
  maxHeight: `${editorPosition.value.maxHeight}px`
}))

const updateEditorPosition = () => {
  const trigger = triggerRef.value
  if (!trigger) return
  editorPosition.value = getFloatingPanelPosition(
    trigger.getBoundingClientRect(),
    window.innerWidth,
    window.innerHeight,
    { maxWidth: 352, viewportPadding: 8 }
  )
}

const closeEditor = () => {
  showEditor.value = false
}

const openEditor = async () => {
  draftGroupIDs.value = [...(props.account?.group_ids ?? [])]
  showEditor.value = true
  await nextTick()
  updateEditorPosition()
}

const toggleEditor = () => {
  if (showEditor.value) {
    closeEditor()
    return
  }
  void openEditor()
}

const handleSave = () => {
  if (props.saving || !isDirty.value) return
  emit('save', [...draftGroupIDs.value])
}

// The parent closes the editor by clearing its saving flag once the update lands.
watch(
  () => props.saving,
  (saving, wasSaving) => {
    if (wasSaving && !saving && !isDirty.value) closeEditor()
  }
)

// 关闭 popover 的键盘事件
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    showPopover.value = false
    closeEditor()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', updateEditorPosition)
  window.addEventListener('scroll', updateEditorPosition, true)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', updateEditorPosition)
  window.removeEventListener('scroll', updateEditorPosition, true)
})
</script>
