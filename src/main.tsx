import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './styles.css';

import { Layout } from './components/Layout';
import { Home } from './routes/Home';
import { Minerals } from './routes/Minerals';
import { MineralDetail } from './routes/MineralDetail';
import { DigSites } from './routes/DigSites';
import { DigSiteDetail } from './routes/DigSiteDetail';
import { Locations } from './routes/Locations';
import { LocationDetail } from './routes/LocationDetail';
import { GearPage } from './routes/Gear';
import { EquipmentPage } from './routes/Equipment';
import { BuildsPage } from './routes/Builds';
import { QuestsPage } from './routes/Quests';
import { MuseumPage } from './routes/Museum';
import { ChangelogPage } from './routes/Changelog';
import { Compare } from './routes/Compare';
import { NotFound } from './routes/NotFound';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="minerals" element={<Minerals />} />
          <Route path="minerals/:id" element={<MineralDetail />} />
          <Route path="sites" element={<DigSites />} />
          <Route path="sites/:id" element={<DigSiteDetail />} />
          <Route path="locations" element={<Locations />} />
          <Route path="locations/:id" element={<LocationDetail />} />
          <Route path="gear/:kind" element={<GearPage />} />
          <Route path="equipment" element={<EquipmentPage />} />
          <Route path="builds" element={<BuildsPage />} />
          <Route path="quests" element={<QuestsPage />} />
          <Route path="museum" element={<MuseumPage />} />
          <Route path="changelog" element={<ChangelogPage />} />
          <Route path="compare" element={<Compare />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
