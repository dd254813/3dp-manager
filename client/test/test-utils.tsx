/* eslint-disable react-refresh/only-export-components */
import { RenderOptions, render } from '@testing-library/react'
import { ReactElement, ReactNode } from 'react'
import { ThemeProvider } from '../src/ThemeContext'
import { AuthProvider } from '../src/auth/AuthContext'
import { BrowserRouter } from 'react-router-dom'

interface AllProvidersProps {
  children: ReactNode
}

function AllProviders({ children }: AllProvidersProps) {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  wrapper?: ReactElement
}

export function customRender(
  ui: ReactElement,
  options?: CustomRenderOptions
) {
  return render(ui, {
    wrapper: AllProviders,
    ...options,
  })
}

// Переэкспортируем всё из @testing-library/react
export * from '@testing-library/react'

// Переопределяем render с нашими провайдерами
export { customRender as render }
