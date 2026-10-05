<template>
    <svg :width="size" :height="size" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <rect width="64" height="64" rx="16" fill="#1A6F58" />
        <path d="M14 38c0-13 9-21 28-22 1 19-6 28-20 28-3 0-6-2-8-6z" fill="#46B88F" />
        <path d="M22 36l7 7 14-16" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
</template>

<script setup>
defineProps({ size: { type: Number, default: 32 } })
</script>
