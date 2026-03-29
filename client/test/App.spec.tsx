import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../src/App'

// Мок для страниц и компонентов
vi.mock('../src/pages/LoginPage', () => ({
  default: () => <div data-testid="login-page">LoginPage</div>,
}))

vi.mock('../src/pages/SubscriptionsPage', () => ({
  default: () => <div data-testid="subscriptions-page">SubscriptionsPage</div>,
}))

vi.mock('../src/pages/SettingsPage', () => ({
  default: () => <div data-testid="settings-page">SettingsPage</div>,
}))

vi.mock('../src/pages/DomainsPage', () => ({
  default: () => <div data-testid="domains-page">DomainsPage</div>,
}))

vi.mock('../src/pages/TunnelsPage', () => ({
  default: () => <div data-testid="tunnels-page">TunnelsPage</div>,
}))

vi.mock('../src/pages/NotFoundPage', () => ({
  default: () => <div data-testid="not-found-page">NotFoundPage</div>,
}))

vi.mock('../src/components/Layout', () => ({
  default: () => <div data-testid="layout">Layout</div>,
}))

// Мок для AuthContext
vi.mock('../src/auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}))

// Мок для ThemeContext
vi.mock('../src/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useThemeContext: () => ({
    mode: 'light' as const,
    toggleColorMode: vi.fn(),
  }),
}))

// Мок для AxiosInterceptor
vi.mock('../src/auth/AxiosInterceptor', () => ({
  AxiosInterceptor: () => null,
}))

// Мок для RequireAuth - просто рендерит children
vi.mock('../src/auth/RequireAuth', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}))

// Мок для PublicRoute - просто рендерит children
vi.mock('../src/auth/PublicRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('должен рендериться без ошибок', () => {
    expect(() => {
      render(<App />)
    }).not.toThrow()
  })

  it('должен содержать Layout компонент', () => {
    render(<App />)
    expect(screen.getByTestId('layout')).toBeInTheDocument()
  })
})
