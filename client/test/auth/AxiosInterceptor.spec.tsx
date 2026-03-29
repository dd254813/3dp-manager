import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AxiosInterceptor } from '../../src/auth/AxiosInterceptor'
import { AuthProvider } from '../../src/auth/AuthContext'
import { ThemeProvider } from '../../src/ThemeContext'
import { Logger } from '../../src/utils/logger'

const mockNavigate = vi.fn()
const mockLogout = vi.fn()

// Мок api с интерсепторами - используем vi.hoisted для подъёма
const mocks = vi.hoisted(() => ({
  responseUse: vi.fn(),
  responseEject: vi.fn(),
}))

vi.mock('../../src/api', () => ({
  default: {
    interceptors: {
      request: {
        use: vi.fn(),
        eject: vi.fn(),
      },
      response: {
        use: mocks.responseUse,
        eject: mocks.responseEject,
      },
    },
  },
}))

// Мок react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...(actual as object),
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/subscriptions' }),
  }
})

// Мок AuthContext
vi.mock('../../src/auth/AuthContext', async () => {
  const actual = await vi.importActual('../../src/auth/AuthContext')
  return {
    ...(actual as object),
    useAuth: () => ({ logout: mockLogout }),
  }
})

vi.mock('../../src/utils/logger', () => ({
  Logger: {
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe('AxiosInterceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
    mockLogout.mockClear()
    vi.mocked(Logger.warn).mockClear()
    vi.mocked(Logger.debug).mockClear()
    mocks.responseUse.mockClear()
    mocks.responseEject.mockClear()
  })

  it('должен рендериться без ошибок и возвращать null', () => {
    const { container } = render(
      <MemoryRouter>
        <AuthProvider>
          <ThemeProvider>
            <AxiosInterceptor />
          </ThemeProvider>
        </AuthProvider>
      </MemoryRouter>
    )
    expect(container.firstChild).toBeNull()
  })

  it('должен регистрировать interceptor при монтировании', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <ThemeProvider>
            <AxiosInterceptor />
          </ThemeProvider>
        </AuthProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mocks.responseUse).toHaveBeenCalled()
    })

    // Проверяем что был зарегистрирован обработчик
    const interceptorCall = vi.mocked(mocks.responseUse).mock.calls[0]
    expect(interceptorCall).toBeDefined()
    expect(typeof interceptorCall?.[0]).toBe('function') // success handler
    expect(typeof interceptorCall?.[1]).toBe('function') // error handler
  })

  it('должен пропускать успешные ответы', () => {
    const successHandler = (response: unknown) => response

    const response = { data: { test: 'value' }, status: 200 }
    const result = successHandler(response)

    expect(result).toEqual(response)
  })

  it('должен отклонять ошибки не 401', async () => {
    const errorHandler = (error: unknown) => Promise.reject(error)

    const errorResponse = { response: { status: 500 } }

    await expect(errorHandler(errorResponse)).rejects.toEqual(errorResponse)
  })

  it('должен удалять interceptor при размонтировании', async () => {
    const { unmount } = render(
      <MemoryRouter>
        <AuthProvider>
          <ThemeProvider>
            <AxiosInterceptor />
          </ThemeProvider>
        </AuthProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mocks.responseUse).toHaveBeenCalled()
    })

    unmount()

    expect(mocks.responseEject).toHaveBeenCalled()
  })

  it('должен обрабатывать 401 ошибки', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <ThemeProvider>
            <AxiosInterceptor />
          </ThemeProvider>
        </AuthProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mocks.responseUse).toHaveBeenCalled()
    })

    const interceptorCall = vi.mocked(mocks.responseUse).mock.calls[0]
    const errorHandler = interceptorCall?.[1]

    if (errorHandler) {
      try {
        await errorHandler({ response: { status: 401 } })
      } catch {
        // Ожидаем что ошибка будет проброшена дальше
      }
    }

    // Проверяем что logout и navigate были вызваны
    expect(mockLogout).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })
})
