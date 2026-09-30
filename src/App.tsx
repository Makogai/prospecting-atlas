import { Route, Routes } from 'react-router-dom';

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
import { CodesPage } from './routes/Codes';
import { ModifiersPage } from './routes/Modifiers';
import { EnchantingPage } from './routes/Enchanting';
import { ExcavationsPage } from './routes/Excavations';
import { RelicsPage } from './routes/Relics';
import { ProgressionPage } from './routes/Progression';
import { ItemsPage } from './routes/Items';
import { Compare } from './routes/Compare';
import { NotFound } from './routes/NotFound';

/**
 * The route tree, shared by the browser entry and the prerenderer so the two
 * can't drift — a route that exists only on one side would either 404 for
 * crawlers or ship an unreachable page.
 */
export function App() {
  return (
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
        <Route path="codes" element={<CodesPage />} />
        <Route path="modifiers" element={<ModifiersPage />} />
        <Route path="enchanting" element={<EnchantingPage />} />
        <Route path="excavations" element={<ExcavationsPage />} />
        <Route path="relics" element={<RelicsPage />} />
        <Route path="progression" element={<ProgressionPage />} />
        <Route path="items" element={<ItemsPage />} />
        <Route path="compare" element={<Compare />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
