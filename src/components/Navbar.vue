<template>
    <header class="topbar">
        <button type="button" class="icon-btn menu-btn" aria-label="Open navigation" @click="openMobile">
            <Menu :size="20" aria-hidden="true" />
        </button>

        <h1 class="title">{{ pageTitle }}</h1>

        <div class="actions">
            <span class="sync-chip" :class="{ offline: !sync.isOnline }" role="status">
                <component :is="sync.isOnline ? Cloud : CloudOff" :size="16" aria-hidden="true" />
                <span class="sync-text">
                    {{ sync.isOnline ? (sync.pendingCount ? `${sync.pendingCount} to sync` : 'Synced') : 'Offline' }}
                </span>
            </span>

            <button
                type="button"
                class="icon-btn"
                :aria-label="resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
                @click="toggle"
            >
                <component :is="resolved === 'dark' ? Sun : Moon" :size="20" aria-hidden="true" />
            </button>

            <div ref="menuRoot" class="user">
                <button
                    type="button"
                    class="user-btn"
                    aria-haspopup="menu"
                    :aria-expanded="menuOpen"
                    @click="menuOpen = !menuOpen"
                >
                    <span class="avatar" aria-hidden="true">{{ initial }}</span>
                    <span class="user-email">{{ auth.user?.email || 'Account' }}</span>
                    <ChevronDown :size="16" aria-hidden="true" />
                </button>

                <div v-if="menuOpen" class="menu" role="menu">
                    <RouterLink to="/settings" role="menuitem" @click="menuOpen = false">
                        <Settings :size="16" aria-hidden="true" /> Settings
                    </RouterLink>
                    <RouterLink to="/auth/logout" role="menuitem" @click="menuOpen = false">
                        <LogOut :size="16" aria-hidden="true" /> Log out
                    </RouterLink>
                </div>
            </div>
        </div>
    </header>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { Menu, Sun, Moon, Cloud, CloudOff, ChevronDown, Settings, LogOut } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useSyncStore } from '../stores/sync'
import { useTheme } from '../composables/useTheme'
import { useShell } from '../composables/useShell'

const route = useRoute()
const auth = useAuthStore()
const sync = useSyncStore()
const { resolved, toggle } = useTheme()
const { openMobile } = useShell()

const pageTitle = computed(() => route.meta.title || 'What To Do')
const initial = computed(() => (auth.user?.email || '?').charAt(0).toUpperCase())

const menuOpen = ref(false)
const menuRoot = ref(null)

function onDocumentClick(e) {
    if (menuRoot.value && !menuRoot.value.contains(e.target)) menuOpen.value = false
}

function onKeydown(e) {
    if (e.key === 'Escape') menuOpen.value = false
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
.topbar {
    flex: 0 0 var(--topbar-h);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0 1.5rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
}

.menu-btn { display: none; }

.title {
    font-size: 1.1rem;
    font-weight: 700;
}

.actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
}

.sync-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.65rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--primary-text);
    background: var(--primary-soft);
    border-radius: 999px;
}

.sync-chip.offline {
    color: var(--warning);
    background: var(--warning-soft);
}

.user { position: relative; }

.user-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem 0.25rem 0.25rem;
    color: var(--text);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 999px;
    cursor: pointer;
}

.user-btn:hover { background: var(--surface-2); }

.avatar {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--on-primary);
    background: var(--primary);
    border-radius: 50%;
}

.user-email {
    max-width: 180px;
    overflow: hidden;
    font-size: 0.85rem;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.menu {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    z-index: 30;
    min-width: 180px;
    padding: 0.35rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
}

.menu a {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.7rem;
    color: var(--text);
    font-size: 0.9rem;
    border-radius: var(--radius-sm);
}

.menu a:hover {
    background: var(--surface-2);
    text-decoration: none;
}

@media (max-width: 900px) {
    .topbar { padding: 0 0.75rem; }
    .menu-btn { display: inline-flex; }
    .user-email, .sync-text { display: none; }
}
</style>
