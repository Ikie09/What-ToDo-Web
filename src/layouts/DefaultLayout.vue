<template>
    <div class="layout" :class="{ collapsed }">
        <a class="skip-link" href="#main">Skip to content</a>

        <Sidebar />
        <div v-if="mobileOpen" class="scrim" @click="closeMobile"></div>

        <div class="content">
            <Navbar />
            <main id="main" class="main" tabindex="-1">
                <router-view />
            </main>
        </div>

        <CalculatorPanel />
    </div>
</template>

<script setup>
import Sidebar from '../components/Sidebar.vue'
import Navbar from '../components/Navbar.vue'
import CalculatorPanel from '../components/CalculatorPanel.vue'
import { useShell } from '../composables/useShell'

const { collapsed, mobileOpen, closeMobile } = useShell()
</script>

<style scoped>
.layout {
    display: flex;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    background: var(--bg);
}

.content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
}

.main {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
}

.main:focus { outline: none; }

.scrim {
    display: none;
}

@media (max-width: 900px) {
    .main { padding: 1rem; }

    .scrim {
        display: block;
        position: fixed;
        inset: 0;
        z-index: 40;
        background: rgba(5, 14, 11, 0.55);
    }
}
</style>
