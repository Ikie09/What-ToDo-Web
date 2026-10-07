<template>
    <div ref="root" class="export-menu">
        <button
            type="button"
            class="icon-btn"
            :aria-label="label"
            aria-haspopup="menu"
            :aria-expanded="open"
            :title="label"
            @click.stop="open = !open"
        >
            <Download :size="16" aria-hidden="true" />
        </button>

        <div v-if="open" class="menu" role="menu">
            <button v-for="item in items" :key="item.label" type="button" role="menuitem" @click="choose(item)">
                <component :is="item.icon" :size="15" aria-hidden="true" /> {{ item.label }}
            </button>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Download } from 'lucide-vue-next'

defineProps({
    label: { type: String, default: 'Export' },
    items: { type: Array, required: true } // [{ label, icon, run }]
})
const emit = defineEmits(['error'])

const open = ref(false)
const root = ref(null)

async function choose(item) {
    open.value = false
    try {
        await item.run()
    } catch (err) {
        emit('error', err.message || 'Export failed.')
    }
}

function onDocumentClick(e) {
    if (root.value && !root.value.contains(e.target)) open.value = false
}
function onKeydown(e) {
    if (e.key === 'Escape') open.value = false
}

onMounted(() => {
    document.addEventListener('click', onDocumentClick)
    document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
    document.removeEventListener('click', onDocumentClick)
    document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.export-menu { position: relative; display: inline-flex; }

.menu {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 20;
    min-width: 190px;
    padding: 0.3rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
}

.menu button {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    width: 100%;
    padding: 0.5rem 0.65rem;
    font-size: 0.85rem;
    color: var(--text);
    text-align: left;
    background: transparent;
    border: 0;
    border-radius: var(--radius-sm);
    cursor: pointer;
}
.menu button:hover { background: var(--surface-2); }
</style>
