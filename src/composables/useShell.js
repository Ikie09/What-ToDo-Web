import { ref, watch } from 'vue'

const COLLAPSED_KEY = 'sidebar_collapsed'

// Shared between Sidebar and Navbar: desktop collapse (remembered) and the mobile drawer.
const collapsed = ref(localStorage.getItem(COLLAPSED_KEY) === 'true')
const mobileOpen = ref(false)

watch(collapsed, (value) => {
    try { localStorage.setItem(COLLAPSED_KEY, String(value)) } catch { /* ignore */ }
})

export function useShell() {
    return {
        collapsed,
        mobileOpen,
        toggleCollapsed: () => { collapsed.value = !collapsed.value },
        openMobile: () => { mobileOpen.value = true },
        closeMobile: () => { mobileOpen.value = false }
    }
}
