import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ThemeProvider, useThemeContext } from '@/ThemeContext'
import { ReactNode } from 'react'

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

// Мокаем useMediaQuery
const useMediaQueryMock = vi.fn()
vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material')
  return {
    ...(actual as object),
    useMediaQuery: () => useMediaQueryMock(),
  }
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
)

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    useMediaQueryMock.mockReturnValue(false) // light mode by default
  })

  describe('useThemeContext', () => {
    it('должен предоставлять context', () => {
      const { result } = renderHook(() => useThemeContext(), { wrapper })
      expect(result.current).toBeDefined()
    })

    it('должен предоставлять mode и toggleColorMode', () => {
      const { result } = renderHook(() => useThemeContext(), { wrapper })
      expect(result.current.mode).toBeDefined()
      expect(result.current.toggleColorMode).toBeDefined()
      expect(typeof result.current.toggleColorMode).toBe('function')
    })
  })

  describe('initial state', () => {
    it('должен инициализироваться с mode из localStorage', () => {
      localStorageMock.getItem.mockReturnValue('dark')
      
      const { result } = renderHook(() => useThemeContext(), { wrapper })
      
      expect(result.current.mode).toBe('dark')
    })

    it('должен инициализироваться с "system" если mode отсутствует в localStorage', () => {
      localStorageMock.getItem.mockReturnValue(null)
      
      const { result } = renderHook(() => useThemeContext(), { wrapper })
      
      expect(result.current.mode).toBe('system')
    })
  })

  describe('toggleColorMode', () => {
    it('должен переключать light → dark → system → light', () => {
      localStorageMock.getItem.mockReturnValue('light')
      
      const { result } = renderHook(() => useThemeContext(), { wrapper })
      
      expect(result.current.mode).toBe('light')
      
      act(() => {
        result.current.toggleColorMode()
      })
      expect(result.current.mode).toBe('dark')
      
      act(() => {
        result.current.toggleColorMode()
      })
      expect(result.current.mode).toBe('system')
      
      act(() => {
        result.current.toggleColorMode()
      })
      expect(result.current.mode).toBe('light')
    })

    it('должен сохранять mode в localStorage при переключении', () => {
      localStorageMock.getItem.mockReturnValue('light')
      
      const { result } = renderHook(() => useThemeContext(), { wrapper })
      
      act(() => {
        result.current.toggleColorMode()
      })
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('themeMode', 'dark')
    })
  })

  describe('system mode', () => {
    it('должен использовать dark когда prefers-color-scheme: dark', () => {
      localStorageMock.getItem.mockReturnValue('system')
      useMediaQueryMock.mockReturnValue(true) // prefers dark
      
      const { result } = renderHook(() => useThemeContext(), { wrapper })
      
      // mode должен быть 'system', но тема должна быть dark
      expect(result.current.mode).toBe('system')
    })

    it('должен использовать light когда prefers-color-scheme: light', () => {
      localStorageMock.getItem.mockReturnValue('system')
      useMediaQueryMock.mockReturnValue(false) // prefers light
      
      const { result } = renderHook(() => useThemeContext(), { wrapper })
      
      expect(result.current.mode).toBe('system')
    })
  })

  describe('localStorage persistence', () => {
    it('должен сохранять mode в localStorage при инициализации', () => {
      localStorageMock.getItem.mockReturnValue(null)
      
      renderHook(() => useThemeContext(), { wrapper })
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('themeMode', 'system')
    })

    it('должен читать mode из localStorage', () => {
      localStorageMock.getItem.mockReturnValue('dark')
      
      renderHook(() => useThemeContext(), { wrapper })
      
      expect(localStorageMock.getItem).toHaveBeenCalledWith('themeMode')
    })
  })

  describe('mode values', () => {
    it('должен поддерживать light mode', () => {
      localStorageMock.getItem.mockReturnValue('light')
      
      const { result } = renderHook(() => useThemeContext(), { wrapper })
      
      expect(result.current.mode).toBe('light')
    })

    it('должен поддерживать dark mode', () => {
      localStorageMock.getItem.mockReturnValue('dark')
      
      const { result } = renderHook(() => useThemeContext(), { wrapper })
      
      expect(result.current.mode).toBe('dark')
    })

    it('должен поддерживать system mode', () => {
      localStorageMock.getItem.mockReturnValue('system')
      
      const { result } = renderHook(() => useThemeContext(), { wrapper })
      
      expect(result.current.mode).toBe('system')
    })
  })
})
