<template>
    <dialog ref="dialog" class="modal" :aria-labelledby="titleId" @close="emit('update:open', false)" @click="onBackdropClick">
        <div class="modal-body" @click.stop>
            <header class="modal-header">
                <h2 :id="titleId">{{ title }}</h2>
                <button type="button" class="icon-btn" aria-label="Close dialog" @click="close">
                    <X :size="18" aria-hidden="true" />
                </button>
            </header>
            <slot />
        </div>
    </dialog>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps({
    open: { type: Boolean, default: false },
    title: { type: String, required: true }
})
const emit = defineEmits(['update:open'])

const dialog = ref(null)
const titleId = `modal-title-${Math.random().toString(36).slice(2, 8)}`

function sync() {
    if (!dialog.value) return
    if (props.open && !dialog.value.open) dialog.value.showModal()
    if (!props.open && dialog.value.open) dialog.value.close()
}

function close() {
    emit('update:open', false)
}

// A click on the <dialog> element itself (not its body) means the backdrop was hit.
function onBackdropClick() {
    close()
}

onMounted(sync)
watch(() => props.open, sync)
</script>

<style scoped>
.modal {
    width: min(560px, calc(100vw - 2rem));
    max-height: calc(100vh - 2rem);
    padding: 0;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
}

.modal::backdrop {
    background: rgba(5, 14, 11, 0.55);
    backdrop-filter: blur(2px);
}

.modal-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
    max-height: calc(100vh - 2rem);
    overflow-y: auto;
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.modal-header h2 {
    font-size: 1.15rem;
}
</style>
