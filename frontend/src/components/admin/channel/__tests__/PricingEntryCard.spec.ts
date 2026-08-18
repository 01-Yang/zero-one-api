import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PricingEntryCard from '../PricingEntryCard.vue'
import ModelTagInput from '../ModelTagInput.vue'
import type { PricingFormEntry } from '../types'

const mocks = vi.hoisted(() => ({
  getModelDefaultPricing: vi.fn()
}))

vi.mock('@/api/admin/channels', () => ({
  default: {
    getModelDefaultPricing: mocks.getModelDefaultPricing
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

function blankEntry(): PricingFormEntry {
  return {
    models: [],
    billing_mode: 'token',
    input_price: null,
    output_price: null,
    cache_write_price: null,
    cache_read_price: null,
    image_input_price: null,
    image_output_price: null,
    per_request_price: null,
    intervals: []
  }
}

describe('PricingEntryCard', () => {
  beforeEach(() => {
    mocks.getModelDefaultPricing.mockReset()
  })

  it('keeps shared prices blank when model names are added so each model can use its own fallback price', async () => {
    mocks.getModelDefaultPricing.mockResolvedValue({
      found: true,
      input_price: 5e-6,
      output_price: 30e-6
    })
    const entry = blankEntry()
    const wrapper = mount(PricingEntryCard, {
      props: { entry, platform: 'openai' },
      global: {
        stubs: {
          Icon: true,
          Select: true,
          IntervalRow: true
        }
      }
    })
    const models = ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna']

    wrapper.findComponent(ModelTagInput).vm.$emit('update:models', models)
    await flushPromises()

    expect(mocks.getModelDefaultPricing).not.toHaveBeenCalled()
    expect(wrapper.emitted('update')).toEqual([[{ ...entry, models }]])
  })
})
