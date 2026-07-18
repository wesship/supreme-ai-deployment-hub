import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Columns3,
  ContactRound,
  FileBarChart,
  GraduationCap,
  LayoutDashboard,
  ListFilter,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import {
  ArchiveCustomListDialog,
  CustomListEditorDialog,
} from "@/features/crm/lists/CustomListDialogs";
import type { CrmCustomList } from "@/features/crm/lists/model";

const WORKSPACE_ID = "d3vonn-main";
const ACTOR_ID = "development-user";

const SEEDED_LISTS: CrmCustomList[] = [
  ["future-transactions", "Future Transactions", "Contacts with a planned future transaction.", 18],
  ["hot-list", "Hot List", "High-priority people requiring immediate follow-up.", 12],
  ["landing-page-leads", "Landing Page Leads", "Leads submitted through public landing pages.", 47],
  ["licensing-client-leads", "Licensing Client Landing Page Leads", "Training and licensing-related client inquiries.", 9],
  ["opportunity-leads", "Opportunity Landing Page Leads", "Business-opportunity interest submissions.", 21],
  ["managed-not-logged-in", "Managed Clients Not Logged In", "Managed clients who have not activated portal access.", 31],
  ["pending-business", "Pending Business", "Open items awaiting underwriting, documents, or follow-up.", 16],
  ["retention-pilot", "Proactive Retention Pilot", "Clients included in the proactive service pilot.", 24],
  ["social-media-leads", "Social Media Lead Generation", "Leads attributed to approved social campaigns.", 53],
  ["uploads", "Uploads", "Contacts imported through approved file uploads.", 84],
  ["wall-of-wealth", "Wall of Wealth Landing Page Leads", "Leads from the Wall of Wealth campaign.", 11],
  ["challenge-call", "90 Day Challenge Call Script", "Contacts assigned to the 90-day calling workflow.", 26],
  ["challenge-omar", "90 Day Challenge Omar Script", "Contacts assigned to the Omar script variation.", 19],
].map(([id, displayName, description, recordCount], index) => ({
  id: String(id),
  workspaceId: WORKSPACE_ID,
  displayName: String(displayName),
  description: String(description),
  recordCount: Number(recordCount),
  updatedAt: new Date(Date.now() - index * 86_400_000).toISOString(),
  archivedAt: null,
  createdBy: ACTOR_ID,
  updatedBy: ACTOR_ID,
}));

const navItems = [
  ["Dashboard", "/crm", LayoutDashboard],
  ["Contacts", "/crm/contacts", ContactRound],
  ["Custom Lists", "/crm/lists", ListFilter],
  ["Leads", "/crm/leads", UsersRound],
  ["Pipeline", "/crm/pipeline", SlidersHorizontal],
  ["Calendar", "/crm/calendar", CalendarDays],
  ["Calls", "/crm/calls", Phone],
  ["Messages", "/crm/messages", MessageSquare],
  ["Tasks", "/crm/tasks", CheckSquare],
  ["Reports", "/crm/reports", FileBarChart],
  ["Recruiting", "/crm/recruiting", UserPlus],
  ["Training", "/crm/training", GraduationCap],
  ["Administration", "/crm/admin", ShieldCheck],
] as const;

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));

export default function CustomLists() {
  const [lists, setLists] = useState(SEEDED_LISTS);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dense, setDense] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingList, setEditingList] = useState<CrmCustomList | null>(null);
  const [archiveCandidate, setArchiveCandidate] = useState<CrmCustomList | null>(null);

  const activeLists = useMemo(() => lists.filter((item) => !item.archivedAt), [lists]);
  const visibleLists = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return activeLists
      .filter((item) => !normalized || `${item.displayName} ${item.description}`.toLowerCase().includes(normalized))
      .sort((a, b) => sortAsc ? a.displayName.localeCompare(b.displayName) : b.displayName.localeCompare(a.displayName));
  }, [activeLists, query, sortAsc]);

  const toggleAll = () => {
    if (selected.size === visibleLists.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(visibleLists.map((item) => item.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const openCreateDialog = () => {
    setEditingList(null);
    setEditorOpen(true);
  };

  const openEditDialog = (item: CrmCustomList) => {
    setEditingList(item);
    setEditorOpen(true);
  };

  const saveList = (values: { displayName: string; description: string }) => {
    const updatedAt = new Date().toISOString();
    if (editingList) {
      setLists((current) => current.map((item) => item.id === editingList.id ? {
        ...item,
        ...values,
        updatedAt,
        updatedBy: ACTOR_ID,
      } : item));
      return;
    }

    setLists((current) => [{
      id: crypto.randomUUID(),
      workspaceId: WORKSPACE_ID,
      displayName: values.displayName,
      description: values.description,
      recordCount: 0,
      updatedAt,
      archivedAt: null,
      createdBy: ACTOR_ID,
      updatedBy: ACTOR_ID,
    }, ...current]);
  };

  const confirmArchive = () => {
    if (!archiveCandidate) return;
    const archivedAt = new Date().toISOString();
    setLists((current) => current.map((item) => item.id === archiveCandidate.id ? {
      ...item,
      archivedAt,
      updatedAt: archivedAt,
      updatedBy: ACTOR_ID,
    } : item));
    setSelected((current) => {
      const next = new Set(current);
      next.delete(archiveCandidate.id);
      return next;
    });
    setArchiveCandidate(null);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100 text-slate-950">
      <header className="sticky top-16 z-30 flex h-14 items-center gap-3 bg-blue-800 px-3 text-white shadow-md lg:px-5">
        <button className="rounded-md p-2 hover:bg-white/10 lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open CRM navigation"><Menu className="h-5 w-5" /></button>
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-white font-black text-blue-800">D3</div>
          <div className="hidden sm:block"><p className="text-sm font-bold leading-none">DEVONN CRM</p><p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-blue-100">PRIMETIME on d3vonn.io</p></div>
        </div>
        <button className="ml-2 hidden min-w-40 items-center justify-between rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium md:flex">D3VONN Main Workspace <ChevronRight className="h-3.5 w-3.5" /></button>
        <label className="ml-auto hidden w-full max-w-md items-center gap-2 rounded-md bg-white/10 px-3 py-2 md:flex"><Search className="h-4 w-4 text-blue-100" /><input className="w-full bg-transparent text-sm text-white placeholder:text-blue-100/70 focus:outline-none" placeholder="Search contacts, leads, tasks..." /></label>
        <button className="rounded-md p-2 hover:bg-white/10" aria-label="Notifications"><Bell className="h-5 w-5" /></button>
        <button className="rounded-md p-2 hover:bg-white/10" aria-label="Settings"><Settings className="h-5 w-5" /></button>
        <button className="grid h-9 w-9 place-items-center rounded-full bg-blue-950 text-xs font-bold" aria-label="User profile">WL</button>
      </header>

      <div className="flex min-h-[calc(100vh-7.5rem)]">
        <aside className="hidden w-20 shrink-0 border-r border-slate-200 bg-white lg:block">
          <nav className="sticky top-30 flex flex-col items-center gap-1 py-3" aria-label="CRM navigation">
            {navItems.map(([label, to, Icon]) => <NavLink key={label} to={to} end={to === "/crm"} className={({ isActive }) => `group flex w-16 flex-col items-center rounded-lg px-1 py-2 text-[10px] font-medium transition ${isActive ? "bg-blue-50 text-blue-800" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><Icon className="mb-1 h-5 w-5" /><span className="max-w-full truncate">{label}</span></NavLink>)}
          </nav>
        </aside>

        {mobileNav && <div className="fixed inset-0 z-50 bg-slate-950/50 lg:hidden" onClick={() => setMobileNav(false)}><aside className="h-full w-72 bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><strong>DEVONN CRM</strong><button onClick={() => setMobileNav(false)} aria-label="Close CRM navigation"><X /></button></div><nav className="space-y-1">{navItems.map(([label, to, Icon]) => <NavLink key={label} to={to} onClick={() => setMobileNav(false)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-800"><Icon className="h-4 w-4" />{label}</NavLink>)}</nav></aside></div>}

        <section className="min-w-0 flex-1 p-3 sm:p-5 lg:p-7">
          <div className="mx-auto max-w-[1500px]">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Contacts</p><h1 className="text-2xl font-bold tracking-tight">Custom Lists</h1><p className="mt-1 text-sm text-slate-500">Create focused groups for follow-up, campaigns, service, and training workflows.</p></div>
              <button onClick={openCreateDialog} className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"><Plus className="h-4 w-4" />Create New Custom List</button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
                <label className="flex min-w-52 flex-1 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full text-sm outline-none" placeholder="Search custom lists" /></label>
                <button onClick={() => setQuery("")} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-slate-50"><RefreshCw className="h-4 w-4" />Refresh</button>
                <button className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-slate-50"><ListFilter className="h-4 w-4" />Default view</button>
                <button className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-slate-50"><UsersRound className="h-4 w-4" />Group</button>
                <button className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-slate-50"><Columns3 className="h-4 w-4" />Fields</button>
                <button onClick={() => setDense((value) => !value)} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-slate-50"><SlidersHorizontal className="h-4 w-4" />{dense ? "Compact" : "Comfortable"}</button>
              </div>

              {selected.size > 0 && <div className="flex items-center gap-3 border-b bg-blue-50 px-4 py-2 text-sm text-blue-900"><strong>{selected.size} selected</strong><button className="ml-auto rounded px-2 py-1 hover:bg-blue-100" onClick={() => setSelected(new Set())}>Clear</button></div>}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-12 px-4 py-3"><input type="checkbox" checked={visibleLists.length > 0 && selected.size === visibleLists.length} onChange={toggleAll} aria-label="Select all lists" /></th><th className="px-4 py-3"><button onClick={() => setSortAsc((value) => !value)} className="font-semibold hover:text-blue-700">Display Name {sortAsc ? "↑" : "↓"}</button></th><th className="px-4 py-3 font-semibold">Description</th><th className="px-4 py-3 text-right font-semibold">Record Count</th><th className="px-4 py-3 font-semibold">Last Updated</th><th className="w-28 px-4 py-3 text-right font-semibold">Actions</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleLists.map((item) => <tr key={item.id} className="hover:bg-blue-50/40"><td className={`px-4 ${dense ? "py-2.5" : "py-4"}`}><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleOne(item.id)} aria-label={`Select ${item.displayName}`} /></td><td className={`px-4 font-semibold text-slate-900 ${dense ? "py-2.5" : "py-4"}`}>{item.displayName}</td><td className={`max-w-xl px-4 text-slate-600 ${dense ? "py-2.5" : "py-4"}`}>{item.description}</td><td className={`px-4 text-right tabular-nums ${dense ? "py-2.5" : "py-4"}`}>{item.recordCount.toLocaleString()}</td><td className={`px-4 whitespace-nowrap text-slate-500 ${dense ? "py-2.5" : "py-4"}`}>{formatDate(item.updatedAt)}</td><td className={`px-4 ${dense ? "py-2.5" : "py-4"}`}><div className="flex justify-end gap-1"><button onClick={() => openEditDialog(item)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-700" aria-label={`Edit ${item.displayName}`}><MoreHorizontal className="h-4 w-4" /></button><button onClick={() => setArchiveCandidate(item)} className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label={`Archive ${item.displayName}`}><Trash2 className="h-4 w-4" /></button></div></td></tr>)}
                    {visibleLists.length === 0 && <tr><td colSpan={6} className="px-6 py-16 text-center"><p className="font-semibold text-slate-800">No custom lists found</p><p className="mt-1 text-sm text-slate-500">Adjust your search or create a new list.</p></td></tr>}
                  </tbody>
                </table>
              </div>

              <footer className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>Showing {visibleLists.length} of {activeLists.length} lists</span><div className="flex items-center gap-2"><button disabled className="rounded-md border p-2 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button><span className="px-2 font-medium text-slate-700">Page 1 of 1</span><button disabled className="rounded-md border p-2 disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button></div></footer>
            </div>

            <p className="mt-4 text-center text-xs text-slate-400">DEVONN CRM is independently operated and is not an official Primerica product.</p>
          </div>
        </section>
      </div>

      <CustomListEditorDialog open={editorOpen} list={editingList} onOpenChange={setEditorOpen} onSubmit={saveList} />
      <ArchiveCustomListDialog list={archiveCandidate} onOpenChange={(open) => { if (!open) setArchiveCandidate(null); }} onConfirm={confirmArchive} />
    </div>
  );
}
