import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import NotFoundPage from '../../src/pages/NotFoundPage'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...(actual as object),
    useNavigate: () => mockNavigate,
  }
})

const renderNotFoundPage = () => {
  return render(
    <BrowserRouter>
      <NotFoundPage />
    </BrowserRouter>
  )
}

describe('NotFoundPage', () => {
  it('должен отображать код ошибки 404', () => {
    renderNotFoundPage()
    expect(screen.getByText('404')).toBeInTheDocument()
  })

  it('должен отображать сообщение "Страница не найдена"', () => {
    renderNotFoundPage()
    expect(screen.getByText('Страница не найдена')).toBeInTheDocument()
  })

  it('должен иметь кнопку "На главную"', () => {
    renderNotFoundPage()
    expect(screen.getByText('На главную')).toBeInTheDocument()
  })

  it('должен выполнять навигацию на главную при клике на кнопку', () => {
    renderNotFoundPage()
    fireEvent.click(screen.getByText('На главную'))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})
