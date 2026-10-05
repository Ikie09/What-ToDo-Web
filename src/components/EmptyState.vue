<template>
    <div class="empty">
        <div class="empty-icon" aria-hidden="true">
            <component :is="icon" :size="28" />
        </div>
        <h3>{{ title }}</h3>
        <p v-if="text">{{ text }}</p>
        <slot />
    </div>
</template>

<script setup>
defineProps({
    icon: { type: [Object, Function], required: true },
    title: { type: String, required: true },
    text: { type: String, default: '' }
})
</script>

<style scoped>
.empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2.5rem 1rem;
    text-align: center;
}

.empty-icon {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    color: var(--primary-text);
    background: var(--primary-soft);
    border-radius: 50%;
}

.empty h3 { font-size: 1rem; }
.empty p { max-width: 36ch; color: var(--text-muted); font-size: 0.9rem; }
</style>
