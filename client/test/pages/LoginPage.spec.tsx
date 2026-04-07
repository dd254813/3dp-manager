import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import LoginPage from '../../src/pages/LoginPage'
import { ThemeProvider } from '../../src/ThemeContext'
import { AuthProvider } from '../../src/auth/AuthContext'

const mockNavigate = vi.fn()
const mockLogin = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...(actual as object),
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../src/auth/AuthContext', async () => {
  const actual = await vi.importActual('../../src/auth/AuthContext')
  return {
    ...(actual as object),
    useAuth: () => ({ login: mockLogin }),
  }
})

vi.mock('../../src/api', () => ({
  default: {
    post: vi.fn(),
  },
}))

const renderLoginPage = () => {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockLogin.mockClear()
    vi.clearAllMocks()
  })

  it('должен отображать заголовок с версией', () => {
    renderLoginPage()
    expect(screen.getByText(/Вход в 3DP-MANAGER/)).toBeInTheDocument()
  })

  it('должен отображать поля ввода логина и пароля', () => {
    renderLoginPage()
    expect(screen.getByLabelText('Логин')).toBeInTheDocument()
    expect(screen.getByLabelText('Пароль')).toBeInTheDocument()
  })

  it('должен отображать кнопку "Войти"', () => {
    renderLoginPage()
    expect(screen.getByText('Войти')).toBeInTheDocument()
  })

  it('должен позволять вводить текст в поля', () => {
    renderLoginPage()
    const loginField = screen.getByLabelText('Логин')
    const passwordField = screen.getByLabelText('Пароль')

    fireEvent.change(loginField, { target: { value: 'admin' } })
    fireEvent.change(passwordField, { target: { value: 'password123' } })

    expect(loginField).toHaveValue('admin')
    expect(passwordField).toHaveValue('password123')
  })

  it('должен показывать ошибку при неверных учетных данных', async () => {
    const api = await import('../../src/api')
    vi.mocked(api.default.post).mockRejectedValue({ response: { status: 401 } })

    renderLoginPage()
    
    fireEvent.change(screen.getByLabelText('Логин'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByText('Войти'))

    await waitFor(() => {
      expect(screen.getByText('Неверный логин или пароль')).toBeInTheDocument()
    })
  })

  it('должен выполнять навигацию на главную при успешном входе', async () => {
    const api = await import('../../src/api')
    vi.mocked(api.default.post).mockResolvedValue({ data: { access_token: 'fake-token' } })

    renderLoginPage()
    
    fireEvent.change(screen.getByLabelText('Логин'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'password' } })
    fireEvent.click(screen.getByText('Войти'))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('fake-token')
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })
})
