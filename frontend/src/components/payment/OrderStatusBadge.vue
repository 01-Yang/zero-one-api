<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
    :class="statusClass"
  >
    {{ statusLabel }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { OrderStatus } from '@/types/payment'

const props = defineProps<{
  status: OrderStatus
}>()

const { t } = useI18n()

const statusMap: Record<OrderStatus, { key: string; class: string }> = {
  PENDING: { key: 'payment.status.pending', class: 'bg-zo-alert-100 text-zo-alert-800 dark:bg-zo-alert-900/30 dark:text-zo-alert-400' },
  PAID: { key: 'payment.status.paid', class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  RECHARGING: { key: 'payment.status.recharging', class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  COMPLETED: { key: 'payment.status.completed', class: 'bg-zo-signal-100 text-zo-signal-800 dark:bg-zo-signal-900/30 dark:text-zo-signal-400' },
  EXPIRED: { key: 'payment.status.expired', class: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
  CANCELLED: { key: 'payment.status.cancelled', class: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
  FAILED: { key: 'payment.status.failed', class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  REFUND_REQUESTED: { key: 'payment.status.refund_requested', class: 'bg-zo-alert-100 text-zo-alert-800 dark:bg-zo-alert-900/30 dark:text-zo-alert-400' },
  REFUNDING: { key: 'payment.status.refunding', class: 'bg-zo-alert-100 text-zo-alert-800 dark:bg-zo-alert-900/30 dark:text-zo-alert-400' },
  REFUND_PENDING: { key: 'payment.status.refund_pending', class: 'bg-zo-alert-100 text-zo-alert-800 dark:bg-zo-alert-900/30 dark:text-zo-alert-400' },
  REFUNDED: { key: 'payment.status.refunded', class: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  PARTIALLY_REFUNDED: { key: 'payment.status.partially_refunded', class: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  REFUND_FAILED: { key: 'payment.status.refund_failed', class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
}

const statusLabel = computed(() => {
  const entry = statusMap[props.status]
  return entry ? t(entry.key) : props.status
})

const statusClass = computed(() => {
  const entry = statusMap[props.status]
  return entry?.class ?? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
})
</script>
