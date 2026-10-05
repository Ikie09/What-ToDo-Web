<template>
    <button
        type="button"
        class="icon-btn corner"
        :aria-label="resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
        @click="toggle"
    >
        <component :is="resolved === 'dark' ? Sun : Moon" :size="20" aria-hidden="true" />
    </button>
</template>

<script setup>
import { Sun, Moon } from 'lucide-vue-next'
import { useTheme } from '../composables/useTheme'

const { resolved, toggle } = useTheme()
</script>

<style scoped>
.corner {
    position: absolute;
    top: 1rem;
    right: 1rem;
}
</style>
