import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/auth/AuthContext'
import { ReactNode } from 'react'
import api from '@/api'

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

// Мокаем api.post для logout
vi.mock('@/api', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
  },
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
)

describe('AuthContext', () => {
  const originalLocation = window.location

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()

    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost/',
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    })
  })

  describe('useAuth', () => {
    it('должен выбрасывать ошибку при использовании вне AuthProvider', () => {
      // Отключаем console.error для этого теста
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useAuth())
      }).toThrow('useAuth must be used within an AuthProvider')

      consoleSpy.mockRestore()
    })
  })

  describe('initial state', () => {
    it('должен инициализироваться с token из localStorage', () => {
      localStorageMock.getItem.mockReturnValue('test-token-123')

      const { result } = renderHook(() => useAuth(), { wrapper })

      expect(result.current.token).toBe('test-token-123')
      expect(result.current.isAuthenticated).toBe(true)
      expect(localStorageMock.getItem).toHaveBeenCalledWith('token')
    })

    it('должен инициализироваться с null если token отсутствует в localStorage', () => {
      localStorageMock.getItem.mockReturnValue(null)

      const { result } = renderHook(() => useAuth(), { wrapper })

      expect(result.current.token).toBe(null)
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('login', () => {
    it('должен сохранять токен в localStorage и state', () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      act(() => {
        result.current.login('new-token-456')
      })

      expect(result.current.token).toBe('new-token-456')
      expect(result.current.isAuthenticated).toBe(true)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'new-token-456')
    })

    it('должен обновлять isAuthenticated после login', () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      expect(result.current.isAuthenticated).toBe(false)

      act(() => {
        result.current.login('another-token')
      })

      expect(result.current.isAuthenticated).toBe(true)
    })
  })

  describe('logout', () => {
    it('должен удалять токен из localStorage и state', async () => {
      localStorageMock.getItem.mockReturnValue('existing-token')

      const { result } = renderHook(() => useAuth(), { wrapper })

      expect(result.current.token).toBe('existing-token')

      await act(async () => {
        await result.current.logout()
      })

      expect(result.current.token).toBe(null)
      expect(result.current.isAuthenticated).toBe(false)
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token')
      expect(api.post).toHaveBeenCalledWith('/auth/logout')
    })

    it('должен корректно работать logout когда token уже null', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      await act(async () => {
        await result.current.logout()
      })

      expect(result.current.token).toBe(null)
      expect(result.current.isAuthenticated).toBe(false)
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token')
    })
  })

  describe('isAuthenticated', () => {
    it('должен возвращать true когда token существует', () => {
      localStorageMock.getItem.mockReturnValue('valid-token')

      const { result } = renderHook(() => useAuth(), { wrapper })

      expect(result.current.isAuthenticated).toBe(true)
    })

    it('должен возвращать false когда token null', () => {
      localStorageMock.getItem.mockReturnValue(null)

      const { result } = renderHook(() => useAuth(), { wrapper })

      expect(result.current.isAuthenticated).toBe(false)
    })

    it('должен возвращать false когда token пустая строка', () => {
      localStorageMock.getItem.mockReturnValue('')

      const { result } = renderHook(() => useAuth(), { wrapper })

      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('context methods', () => {
    it('должен предоставлять метод login', () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      expect(result.current.login).toBeDefined()
      expect(typeof result.current.login).toBe('function')
    })

    it('должен предоставлять метод logout', () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      expect(result.current.logout).toBeDefined()
      expect(typeof result.current.logout).toBe('function')
    })
  })

  describe('multiple login/logout cycles', () => {
    it('должен корректно обрабатывать несколько циклов login/logout', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      // Первый цикл
      act(() => {
        result.current.login('token-1')
      })
      expect(result.current.token).toBe('token-1')

      await act(async () => {
        await result.current.logout()
      })
      expect(result.current.token).toBe(null)

      // Второй цикл
      act(() => {
        result.current.login('token-2')
      })
      expect(result.current.token).toBe('token-2')

      await act(async () => {
        await result.current.logout()
      })
      expect(result.current.token).toBe(null)

      // Третий цикл
      act(() => {
        result.current.login('token-3')
      })
      expect(result.current.token).toBe('token-3')
    })
  })
})
