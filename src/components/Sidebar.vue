<template>
    <aside class="sidebar" :class="{ collapsed, open: mobileOpen }" aria-label="Primary">
        <div class="brand">
            <BrandLogo :size="34" />
            <span v-if="!collapsed || mobileOpen" class="brand-name">What To Do</span>
        </div>

        <nav class="nav">
            <RouterLink
                v-for="item in items"
                :key="item.to"
                :to="item.to"
                class="nav-item"
                :title="collapsed && !mobileOpen ? item.label : undefined"
                @click="closeMobile"
            >
                <component :is="item.icon" :size="20" aria-hidden="true" />
                <span v-if="!collapsed || mobileOpen">{{ item.label }}</span>
                <span v-else class="sr-only">{{ item.label }}</span>
            </RouterLink>
        </nav>

        <button type="button" class="collapse-btn" :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'" @click="toggleCollapsed">
            <component :is="collapsed ? PanelLeftOpen : PanelLeftClose" :size="20" aria-hidden="true" />
            <span v-if="!collapsed">Collapse</span>
        </button>
    </aside>
</template>

<script setup>
import { RouterLink } from 'vue-router'
import {
    LayoutDashboard, ListChecks, CalendarDays, StickyNote, Wallet, ChartNoAxesCombined, Settings, PanelLeftClose, PanelLeftOpen
} from 'lucide-vue-next'
import BrandLogo from './BrandLogo.vue'
import { useShell } from '../composables/useShell'

const { collapsed, mobileOpen, toggleCollapsed, closeMobile } = useShell()

const items = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/todos', label: 'Todos', icon: ListChecks },
    { to: '/meetings', label: 'Meetings', icon: CalendarDays },
    { to: '/notes', label: 'Notes', icon: StickyNote },
    { to: '/budget', label: 'Budget', icon: Wallet },
    { to: '/insights', label: 'Insights', icon: ChartNoAxesCombined },
    { to: '/settings', label: 'Settings', icon: Settings }
]
</script>

<style scoped>
.sidebar {
    flex: 0 0 var(--sidebar-w);
    width: var(--sidebar-w);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem 0.75rem;
    background: var(--sidebar-bg);
    color: var(--sidebar-text);
    border-right: 1px solid var(--sidebar-border);
    transition: width 0.2s ease, flex-basis 0.2s ease;
    overflow-y: auto;
}

.sidebar.collapsed {
    flex-basis: var(--sidebar-w-collapsed);
    width: var(--sidebar-w-collapsed);
}

.brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.25rem 0.5rem 0.75rem;
    color: var(--sidebar-text-strong);
}

.brand-name {
    font-weight: 800;
    font-size: 1.1rem;
    letter-spacing: -0.02em;
    white-space: nowrap;
}

.nav {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.nav-item,
.collapse-btn {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 42px;
    padding: 0 0.75rem;
    color: var(--sidebar-text);
    font-weight: 600;
    font-size: 0.92rem;
    text-decoration: none;
    background: transparent;
    border: 0;
    border-radius: var(--radius-sm);
    cursor: pointer;
    white-space: nowrap;
}

.nav-item:hover,
.collapse-btn:hover {
    background: var(--sidebar-hover);
    color: var(--sidebar-text-strong);
    text-decoration: none;
}

.nav-item.router-link-exact-active {
    background: var(--sidebar-active);
    color: var(--sidebar-text-strong);
    box-shadow: inset 3px 0 0 var(--accent);
}

.sidebar.collapsed .nav-item,
.sidebar.collapsed .collapse-btn { justify-content: center; padding: 0; }
.sidebar.collapsed .brand { justify-content: center; padding-inline: 0; }

@media (max-width: 900px) {
    .sidebar,
    .sidebar.collapsed {
        position: fixed;
        inset: 0 auto 0 0;
        z-index: 50;
        width: min(280px, 85vw);
        transform: translateX(-100%);
        transition: transform 0.2s ease;
    }

    .sidebar.open { transform: none; }
    .collapse-btn { display: none; }
}
</style>
