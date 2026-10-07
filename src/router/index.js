import { createRouter, createWebHistory } from 'vue-router'
import DefaultLayout from '../layouts/DefaultLayout.vue'

// Views are lazy-loaded so the first paint only downloads what the current page needs
// (the dashboard's chart library, for instance, stays out of the other routes).
const routes = [
    {
        path: '/',
        component: DefaultLayout,
        children: [
            { path: '', name: 'dashboard', component: () => import('../views/Dashboard.vue'), meta: { title: 'Dashboard' } },
            { path: 'todos', name: 'todos', component: () => import('../views/Todos.vue'), meta: { title: 'Todos' } },
            { path: 'meetings', name: 'meetings', component: () => import('../views/Meetings.vue'), meta: { title: 'Meetings' } },
            { path: 'notes', name: 'notes', component: () => import('../views/Notes.vue'), meta: { title: 'Notes' } },
            { path: 'budget', name: 'budget', component: () => import('../views/Budget.vue'), meta: { title: 'Budget' } },
            { path: 'insights', name: 'insights', component: () => import('../views/Insights.vue'), meta: { title: 'Insights' } },
            { path: 'settings', name: 'settings', component: () => import('../views/Settings.vue'), meta: { title: 'Settings' } }
        ]
    },
    { path: '/auth/login', name: 'login', component: () => import('../views/auth/Login.vue'), meta: { title: 'Sign in', public: true } },
    { path: '/auth/register', name: 'register', component: () => import('../views/auth/Register.vue'), meta: { title: 'Create account', public: true } },
    { path: '/auth/logout', name: 'logout', component: () => import('../views/auth/Logout.vue'), meta: { title: 'Signing out', public: true } },
    { path: '/:pathMatch(.*)*', redirect: { name: 'dashboard' } }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

// Layout routes need a token; signed-in users are kept off the sign-in/register pages.
router.beforeEach((to) => {
    const isAuthenticated = !!localStorage.getItem('auth_token')

    if (!isAuthenticated && !to.meta.public) return { name: 'login' }
    if (isAuthenticated && (to.name === 'login' || to.name === 'register')) return { name: 'dashboard' }
})

router.afterEach((to) => {
    document.title = to.meta.title ? `${to.meta.title} · What To Do` : 'What To Do'
})

export default router
