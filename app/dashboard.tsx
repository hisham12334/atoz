"use client";

import { AlertCircle, ArrowRight, Boxes, CalendarDays, Check, ChevronRight, Clock3, FileText, PackageCheck, Plus, TrendingUp, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { State, Rental } from "./ledger";

type Props = {
  state: State;
  name: string;
  availableNow: number;
  dueToday: Rental[];
  overdue: Rental[];
  upcoming: Rental[];
  riskCount: number;
  atRisk: (rental: Rental) => boolean;
  onNewRental: () => void;
  onNewProduct: () => void;
  onNewParty: () => void;
  onReturn: (id: string) => void;
  onInvoice: (id: string) => void;
  onRentals: () => void;
};

const addDays = (date: string, amount: number) => new Date(Date.parse(`${date}T00:00:00Z`) + amount * 86400000).toISOString().slice(0, 10);
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const outstanding = (item: State["items"][number]) => item.quantity - item.usable_returned - item.damaged_returned;
const nice = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const money = (cents: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(cents / 100);

export default function Dashboard({ state, name, availableNow, dueToday, overdue, upcoming, riskCount, atRisk, onNewRental, onNewProduct, onNewParty, onReturn, onInvoice, onRentals }: Props) {
  const outNow = state.items.reduce((count, item) => {
    const rental = state.rentals.find(r => r.id === item.rental_id);
    return count + (rental && rental.start_date <= state.today ? outstanding(item) : 0);
  }, 0);
  const damaged = state.variants.reduce((count, variant) => count + variant.damaged_stock, 0);
  const focus = [...overdue, ...dueToday];
  const recent = state.rentals.slice(0, 4);
  const chart = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(state.today, index - 6);
    const invoiceCount = state.rentals.filter(r => new Date(r.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === date).length;
    return { label: new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" }), invoices: invoiceCount };
  });

  return <div className="dashboard fade-in">
    <section className="accent-hero">
      <div className="hero-copy">
        <span className="hero-eyebrow"><span className="live-dot"/> LIVE OPERATIONS</span>
        <h2>Keep every rental<br/>moving smoothly.</h2>
        <p>Welcome back, {name.split(" ")[0]}. Your stock, returns and upcoming events are all here.</p>
        <div className="hero-actions">
          <button className="hero-primary" onClick={onNewRental}><Plus size={17}/> Create rental <ArrowRight size={16}/></button>
          <button className="hero-secondary" onClick={onRentals}>View invoices <ArrowRight size={15}/></button>
        </div>
      </div>
      <div className="hero-art" aria-hidden="true"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-floating-card"><div><PackageCheck size={20}/><span>Rental flow</span></div><strong>{outNow.toLocaleString("en-IN")}</strong><small>units currently out</small><div className="hero-floating-line"/></div></div>
      <div className="hero-hatch" aria-hidden="true"/>
    </section>

    {riskCount > 0 && <div className="risk-alert"><AlertCircle size={20}/><div><strong>{riskCount} upcoming {riskCount === 1 ? "booking needs" : "bookings need"} attention</strong><span>Late returns or damaged stock may affect reserved items.</span></div><button onClick={onRentals}>Review <ArrowRight size={15}/></button></div>}

    <div className="dashboard-kpis">
      <Metric icon={FileText} label="Invoices created" value={state.rentals.length.toLocaleString("en-IN")} foot="All time" kind="ink"/>
      <Metric icon={Boxes} label="Available today" value={availableNow.toLocaleString("en-IN")} foot="Rentable units" kind="good"/>
      <Metric icon={CalendarDays} label="Due today" value={dueToday.length.toLocaleString("en-IN")} foot="Returns to receive" kind="accent"/>
      <Metric icon={Clock3} label="Overdue" value={overdue.length.toLocaleString("en-IN")} foot="Need follow-up" kind="bad"/>
    </div>

    <div className="dashboard-columns">
      <section className="dash-card returns-card">
        <div className="dash-card-head"><div><span className="small-kicker">ACTION QUEUE</span><h3>Returns to collect</h3><p>Due today and waiting on a return.</p></div><button className="round-link" onClick={onRentals} aria-label="View all rentals"><ArrowRight size={18}/></button></div>
        {focus.length ? <div className="dash-rows">{focus.slice(0, 5).map(r => {
          const party = state.parties.find(p => p.id === r.party_id);
          const count = state.items.filter(i => i.rental_id === r.id).reduce((n, i) => n + outstanding(i), 0);
          const late = r.due_date < state.today;
          return <div className="dash-row" key={r.id}><div className={`dash-row-icon ${late ? "late" : "due"}`}><Clock3 size={17}/></div><div className="dash-row-text"><strong>{party?.name || "Party"}</strong><span>{r.invoice_no} · {count} units outstanding</span></div><span className={`status-pill ${late ? "bad" : "warn"}`}>{late ? `${days(r.due_date, state.today)}d late` : "Due today"}</span><button className="row-arrow" onClick={() => onReturn(r.id)} title="Record return"><ArrowRight size={17}/></button></div>;
        })}</div> : <div className="dash-empty"><div><Check size={22}/></div><strong>All caught up</strong><span>No returns due or overdue today.</span></div>}
        <button className="dash-card-footer" onClick={onRentals}>Open all rentals <ArrowRight size={15}/></button>
      </section>

      <section className="dash-card reservations-card">
        <div className="dash-card-head"><div><span className="small-kicker">COMING UP</span><h3>Future reservations</h3><p>Stock already committed to bookings.</p></div><span className="count-chip">{upcoming.length} booked</span></div>
        {upcoming.length ? <div className="dash-rows">{upcoming.slice(0, 5).map(r => {
          const party = state.parties.find(p => p.id === r.party_id);
          return <button className="reservation-row" key={r.id} onClick={() => onInvoice(r.id)}><span className="reservation-date"><strong>{new Date(`${r.start_date}T00:00:00`).getDate()}</strong><small>{new Date(`${r.start_date}T00:00:00`).toLocaleDateString("en-IN", { month: "short" })}</small></span><span className="dash-row-text"><strong>{party?.name || "Party"}</strong><span>{r.days} rental days · {state.items.filter(i => i.rental_id === r.id).length} product lines</span></span>{atRisk(r) ? <span className="status-pill bad">At risk</span> : <ChevronRight size={17} className="reservation-chevron"/>}</button>;
        })}</div> : <div className="dash-empty"><div><CalendarDays size={22}/></div><strong>No future bookings yet</strong><span>Reservations will appear here when created.</span></div>}
        <div className="reservation-footer"><span><b>{outNow}</b> units out</span><span><b>{damaged}</b> damaged</span><span><b>{availableNow}</b> ready</span></div>
      </section>
    </div>

    <div className="dashboard-columns dashboard-lower">
      <section className="dash-card activity-card"><div className="dash-card-head"><div><span className="small-kicker">INVOICE TREND</span><h3>Rental activity</h3><p>Invoices created over the last seven days.</p></div><span className="range-chip"><TrendingUp size={15}/> 7 days</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} margin={{ top: 10, right: 4, left: 4, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5"/><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }}/><Tooltip cursor={{ fill: "var(--inset)" }} contentStyle={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 10px 28px #00000018" }} formatter={(value) => [`${value} invoices`, "Created"]}/><Bar dataKey="invoices" fill="var(--accent)" radius={[6, 6, 0, 0]} maxBarSize={36}/></BarChart></ResponsiveContainer></div></section>
      <section className="dash-card recent-card"><div className="dash-card-head"><div><span className="small-kicker">LATEST WORK</span><h3>Recent invoices</h3><p>Quick access to new rentals.</p></div><button className="round-link" onClick={onRentals} aria-label="View invoices"><ArrowRight size={18}/></button></div>{recent.length ? <div className="dash-rows">{recent.map(r => {
        const party = state.parties.find(p => p.id === r.party_id);
        const total = state.items.filter(i => i.rental_id === r.id).reduce((sum, item) => sum + item.quantity * item.price_cents * r.days, 0);
        return <button className="recent-row" key={r.id} onClick={() => onInvoice(r.id)}><span className="recent-icon"><FileText size={17}/></span><span className="dash-row-text"><strong>{party?.name || "Party"}</strong><span>{r.invoice_no} · {nice(r.start_date)}</span></span><b>{money(total)}</b></button>;
      })}</div> : <div className="dash-empty"><div><FileText size={22}/></div><strong>No invoices yet</strong><span>Your first rental will appear here.</span></div>}</section>
    </div>

    <div className="dashboard-shortcuts"><div><span className="small-kicker">QUICK START</span><strong>Need to update your workspace?</strong></div><div><button onClick={onNewProduct}><Boxes size={17}/> Add product</button><button onClick={onNewParty}><Users size={17}/> Add party</button></div></div>
  </div>;
}

function Metric({ icon: Icon, label, value, foot, kind }: { icon: typeof FileText; label: string; value: string; foot: string; kind: string }) {
  return <div className={`metric-card ${kind}`}><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={19}/></span></div><strong>{value}</strong><small>{foot}</small></div>;
}
