import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { AssistantPage } from '../pages/AssistantPage'
import { DocumentsPage } from '../pages/DocumentsPage'
import { NotFoundPage } from '../pages/NotFoundPage'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/assistant" replace />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
