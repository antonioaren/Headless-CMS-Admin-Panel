import EntryFormPage from '@/pages/EntryFormPage'
import EntryListPage from '@/pages/EntryListPage'
import SchemaFormPage from '@/pages/SchemaFormPage'
import SchemaListPage from '@/pages/SchemaListPage'
import { Navigate, Route, Routes } from 'react-router-dom'

// BrowserRouter is mounted in main.tsx — only Routes live here.
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/schemas" replace />} />
      <Route path="/schemas" element={<SchemaListPage />} />
      <Route path="/schemas/new" element={<SchemaFormPage />} />
      <Route path="/schemas/:id/edit" element={<SchemaFormPage />} />
      <Route path="/schemas/:schemaId/entries" element={<EntryListPage />} />
      <Route path="/schemas/:schemaId/entries/new" element={<EntryFormPage />} />
      <Route path="/schemas/:schemaId/entries/:entryId/edit" element={<EntryFormPage />} />
    </Routes>
  )
}
