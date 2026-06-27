import RepairPage from '@/features/migration/RepairPage'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import EntryFormPage from '@/pages/EntryFormPage/EntryFormPage'
import EntryListPage from '@/pages/EntryListPage/EntryListPage'
import SchemaFormPage from '@/pages/SchemaFormPage/SchemaFormPage'
import SchemaListPage from '@/pages/SchemaListPage/SchemaListPage'
import { Navigate, Route, Routes } from 'react-router-dom'

// BrowserRouter is mounted in main.tsx — only Routes live here.
export function App() {
  useRealtimeSync()

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/schemas" replace />} />
      <Route path="/schemas" element={<SchemaListPage />} />
      <Route path="/schemas/new" element={<SchemaFormPage />} />
      <Route path="/schemas/:id/edit" element={<SchemaFormPage />} />
      <Route path="/schemas/:id/repair" element={<RepairPage />} />
      <Route path="/schemas/:schemaId/entries" element={<EntryListPage />} />
      <Route path="/schemas/:schemaId/entries/new" element={<EntryFormPage />} />
      <Route path="/schemas/:schemaId/entries/:entryId/edit" element={<EntryFormPage />} />
    </Routes>
  )
}
