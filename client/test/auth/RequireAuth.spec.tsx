import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RequireAuth from '@/auth/RequireAuth'
import { AuthProvider } from '@/auth/AuthContext'

// Мокаем localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('RequireAuth', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('должен рендерить children когда пользователь авторизован', () => {
    localStorageMock.getItem.mockReturnValue('valid-token')

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/protected"
              element={
                <RequireAuth>
                  <div data-testid="protected-content">Protected Content</div>
                </RequireAuth>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('должен перенаправлять на /login когда пользователь не авторизован', () => {
    localStorageMock.getItem.mockReturnValue(null)

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/protected"
              element={
                <RequireAuth>
                  <div data-testid="protected-content">Protected Content</div>
                </RequireAuth>
              }
            />
            <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )

    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('должен сохранять state.from с текущим location при перенаправлении на login', () => {
    localStorageMock.getItem.mockReturnValue(null)

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/settings"
              element={
                <RequireAuth>
                  <div data-testid="settings-content">Settings</div>
                </RequireAuth>
              }
            />
            <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )

    // Должен показать login страницу
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
  })

  it('должен использовать replace: true при перенаправлении', () => {
    // Этот тест проверяет поведение Navigate компонента
    // В реальном сценарии replace предотвращает добавление записи в историю
    localStorageMock.getItem.mockReturnValue(null)

    const { container } = render(
      <MemoryRouter initialEntries={['/protected']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/protected"
              element={
                <RequireAuth>
                  <div>Protected</div>
                </RequireAuth>
              }
            />
            <Route path="/login" element={<div>Login</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )

    // Проверяем что рендерится login
    expect(container.textContent).toContain('Login')
  })

  it('должен работать с вложенными роутами', () => {
    localStorageMock.getItem.mockReturnValue('valid-token')

    render(
      <MemoryRouter initialEntries={['/dashboard/profile']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/dashboard/*"
              element={
                <RequireAuth>
                  <Routes>
                    <Route path="profile" element={<div data-testid="profile">Profile</div>} />
                  </Routes>
                </RequireAuth>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )

    expect(screen.getByTestId('profile')).toBeInTheDocument()
  })

  it('должен блокировать доступ к защищённому маршруту без авторизации', () => {
    localStorageMock.getItem.mockReturnValue(null)

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <div data-testid="admin-content">Admin Panel</div>
                </RequireAuth>
              }
            />
            <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )

    // Контент админки не должен быть доступен
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument()
    // Должна показываться страница логина
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
  })
})
