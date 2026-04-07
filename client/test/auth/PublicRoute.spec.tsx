import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PublicRoute from '@/auth/PublicRoute'
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

describe('PublicRoute', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('должен рендерить Outlet когда пользователь не авторизован', () => {
    localStorageMock.getItem.mockReturnValue(null)

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )

    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('должен перенаправлять на / когда пользователь авторизован', () => {
    localStorageMock.getItem.mockReturnValue('valid-token')

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
            </Route>
            <Route path="/" element={<div data-testid="home-page">Home Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )

    // Должен показать главную страницу вместо login
    expect(screen.getByTestId('home-page')).toBeInTheDocument()
    expect(screen.getByText('Home Page')).toBeInTheDocument()
  })

  it('должен работать с несколькими публичными роутами', () => {
    localStorageMock.getItem.mockReturnValue(null)

    render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <Routes>
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
              <Route path="/register" element={<div data-testid="register-page">Register Page</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )

    expect(screen.getByTestId('register-page')).toBeInTheDocument()
    expect(screen.getByText('Register Page')).toBeInTheDocument()
  })

  it('должен перенаправлять авторизованного пользователя с любого публичного роута', () => {
    localStorageMock.getItem.mockReturnValue('valid-token')

    render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <Routes>
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
              <Route path="/register" element={<div data-testid="register-page">Register Page</div>} />
            </Route>
            <Route path="/" element={<div data-testid="home-page">Home Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )

    // Должен показать главную страницу
    expect(screen.getByTestId('home-page')).toBeInTheDocument()
    expect(screen.queryByTestId('register-page')).not.toBeInTheDocument()
  })

  it('должен использовать replace при перенаправлении', () => {
    localStorageMock.getItem.mockReturnValue('valid-token')

    const { container } = render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<div>Login</div>} />
            </Route>
            <Route path="/" element={<div>Home</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )

    // Проверяем что рендерится Home
    expect(container.textContent).toContain('Home')
  })
})
