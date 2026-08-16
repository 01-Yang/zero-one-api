import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  status: vi.fn(),
}))

vi.mock('@/api/channelMonitor', () => api)

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    cachedPublicSettings: { channel_monitor_enabled: true },
    showError: vi.fn(),
  }),
}))

vi.mock('@/composables/useAutoRefresh', async () => {
  const { ref } = await import('vue')
  return {
    useAutoRefresh: () => ({
      enabled: ref(false),
      intervalSeconds: ref(30),
      countdown: ref(30),
      intervals: [30, 60, 120],
      setEnabled: vi.fn(),
      setInterval: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
  }
})

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

import ChannelStatusV1View from '../ChannelStatusV1View.vue'

const AppLayoutStub = defineComponent({ template: '<main><slot /></main>' })
const MonitorHeroStub = defineComponent({
  props: { overallStatus: { type: String, required: true } },
  template: '<div data-testid="overall-status" :data-status="overallStatus" />',
})

function monitor(id: number, primaryStatus: string) {
  return {
    id,
    name: `monitor-${id}`,
    primary_status: primaryStatus,
  }
}

async function renderStatus(primaryStatuses: string[]) {
  api.list.mockResolvedValueOnce({
    items: primaryStatuses.map((status, index) => monitor(index + 1, status)),
  })

  const wrapper = mount(ChannelStatusV1View, {
    global: {
      stubs: {
        AppLayout: AppLayoutStub,
        MonitorHero: MonitorHeroStub,
        MonitorCardGrid: true,
        MonitorDetailDialog: true,
      },
    },
  })
  await flushPromises()
  return wrapper.get('[data-testid="overall-status"]').attributes('data-status')
}

describe('ChannelStatusV1View overall status', () => {
  beforeEach(() => {
    api.list.mockReset()
    api.status.mockReset()
  })

  it.each([
    { statuses: [], expected: 'unavailable' },
    { statuses: [''], expected: 'unavailable' },
    { statuses: ['success'], expected: 'unavailable' },
    { statuses: ['operational', 'operational'], expected: 'operational' },
    { statuses: ['operational', 'degraded'], expected: 'degraded' },
    { statuses: ['failed'], expected: 'degraded' },
    { statuses: ['error'], expected: 'degraded' },
  ])('maps $statuses to $expected', async ({ statuses, expected }) => {
    await expect(renderStatus(statuses)).resolves.toBe(expected)
  })
})
