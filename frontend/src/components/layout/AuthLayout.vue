<template>
  <div class="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
    <div class="absolute inset-0 bg-gray-50 dark:bg-dark-950"></div>

    <!-- Content Container -->
    <div class="relative z-10 w-full max-w-md">
      <!-- Logo/Brand -->
      <div class="mb-8 text-center">
        <template v-if="settingsLoaded">
          <div
            v-if="siteLogo"
            class="mb-4 inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-dark-700 dark:bg-dark-800"
          >
            <img :src="siteLogo" :alt="siteName" class="h-full w-full object-contain" />
          </div>
          <h1 class="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
            {{ siteName }}
          </h1>
          <p class="text-sm text-gray-500 dark:text-dark-400">
            {{ siteSubtitle }}
          </p>
        </template>
      </div>

      <!-- Card Container -->
      <div class="card p-6 sm:p-8">
        <slot />
      </div>

      <!-- Footer Links -->
      <div class="mt-6 text-center text-sm [&_a]:inline-flex [&_a]:min-h-11 [&_a]:min-w-11 [&_a]:items-center [&_a]:justify-center">
        <slot name="footer" />
      </div>

      <!-- Copyright -->
      <div class="mt-8 text-center text-xs text-gray-400 dark:text-dark-500">
        &copy; {{ currentYear }} {{ siteName }}. All rights reserved.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAppStore } from '@/stores'
import { sanitizeUrl } from '@/utils/url'
import { DEFAULT_SITE_NAME, DEFAULT_SITE_SUBTITLE } from '@/utils/branding'

const appStore = useAppStore()

const siteName = computed(() => appStore.siteName || DEFAULT_SITE_NAME)
const siteLogo = computed(() => sanitizeUrl(appStore.siteLogo || '', { allowRelative: true, allowDataUrl: true }))
const siteSubtitle = computed(() => appStore.cachedPublicSettings?.site_subtitle || DEFAULT_SITE_SUBTITLE)
const settingsLoaded = computed(() => appStore.publicSettingsLoaded)

const currentYear = computed(() => new Date().getFullYear())

onMounted(() => {
  appStore.fetchPublicSettings()
})
</script>
