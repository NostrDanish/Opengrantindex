import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";

import About from "./pages/About";
import ApiDocs from "./pages/ApiDocs";
import Architecture from "./pages/Architecture";
import Awards from "./pages/Awards";
import Funder from "./pages/Funder";
import Funders from "./pages/Funders";
import Graph from "./pages/Graph";
import Home from "./pages/Home";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";
import Opportunity from "./pages/Opportunity";
import Protocol from "./pages/Protocol";
import Roadmap from "./pages/Roadmap";
import Saved from "./pages/Saved";
import Search from "./pages/Search";
import Sources from "./pages/Sources";
import Submit from "./pages/Submit";
import Trust from "./pages/Trust";

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        {/* Opportunities are keyed on canonical URL, not naddr — see lib/ogi/routes.ts */}
        <Route path="/o/*" element={<Opportunity />} />
        <Route path="/f/:pubkey/:identifier" element={<Funder />} />
        <Route path="/funders" element={<Funders />} />
        <Route path="/awards" element={<Awards />} />
        <Route path="/graph" element={<Graph />} />
        <Route path="/sources" element={<Sources />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/submit" element={<Submit />} />
        <Route path="/api" element={<ApiDocs />} />
        <Route path="/architecture" element={<Architecture />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/protocol" element={<Protocol />} />
        <Route path="/trust" element={<Trust />} />
        <Route path="/about" element={<About />} />
        {/* NIP-19 route for npub1, note1, naddr1, nevent1, nprofile1 */}
        <Route path="/:nip19" element={<NIP19Page />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;
