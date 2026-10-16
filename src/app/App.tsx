import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { AssistantPage } from '../pages/AssistantPage'
import { DocumentsPage } from '../pages/DocumentsPage'
import { AuthCallbackPage } from '../pages/AuthCallbackPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'

export function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="auth/callback" element={<AuthCallbackPage />} />
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/assistant" replace />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
