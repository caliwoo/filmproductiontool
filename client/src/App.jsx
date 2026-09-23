import { Routes, Route, Navigate } from 'react-router-dom';
import ProjectsPage from './pages/ProjectsPage.jsx';
import ProjectLayout from './components/ProjectLayout.jsx';
import BreakdownPage from './pages/BreakdownPage.jsx';
import SchedulePage from './pages/SchedulePage.jsx';
import CallSheetPage from './pages/CallSheetPage.jsx';
import ContactsPage from './pages/ContactsPage.jsx';
import LocationsPage from './pages/LocationsPage.jsx';
import ShotListPage from './pages/ShotListPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProjectsPage />} />
      <Route path="/projects/:projectId" element={<ProjectLayout />}>
        <Route index element={<Navigate to="breakdown" replace />} />
        <Route path="breakdown" element={<BreakdownPage />} />
        <Route path="shot-list" element={<ShotListPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="schedule/:dayId/call-sheet" element={<CallSheetPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="locations" element={<LocationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
