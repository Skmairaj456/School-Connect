"use client";

import { useState } from "react";
import { Bus, Check, CircleAlert, CircleCheck, ClipboardCheck, DoorOpen, KeyRound, PhoneCall, School, ScanLine, ShieldAlert, ShieldCheck, UserCheck } from "lucide-react";
import type { AttendanceRecord, DemoRole } from "@/lib/demo-data";
import { checkpointStates, handoverCode, onBoard, safetyAlerts, verifyHandover, type Checkpoint, type SafetyAlert, type SafetyRider, type SafetyState } from "@/lib/safety";

type SafetyChainProps = {
  role: DemoRole;
  safety: SafetyState;
  attendance: AttendanceRecord[];
  isLive: boolean;
  onChange: (next: SafetyState) => void;
  onMarkPresent: (studentId: string) => void;
};

const checkpoints: { key: Checkpoint; label: string; icon: typeof Bus }[] = [
  { key: "pickup", label: "Bus pickup", icon: Bus },
  { key: "gate", label: "School gate", icon: School },
  { key: "classroom", label: "Classroom", icon: ClipboardCheck },
  { key: "handover", label: "Home handover", icon: UserCheck },
];
const sweepSteps = ["Walked to the last row", "Checked under every seat", "Checked the back door and luggage area"];
const parentChildId = "st-01";

function time(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "—";
}

function logged(state: SafetyState, text: string, tone: "ok" | "alert" = "ok"): SafetyState {
  return { ...state, log: [{ id: crypto.randomUUID(), at: new Date().toISOString(), text, tone }, ...state.log] };
}

function Heading({ title, subtitle, tag, live }: { title: string; subtitle: string; tag?: string; live?: boolean }) {
  return <div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{tag && <span className={`status-tag ${live ? "live" : ""}`}><i />{tag}</span>}</div>;
}

export default function SafetyChain({ role, safety, attendance, isLive, onChange, onMarkPresent }: SafetyChainProps) {
  const alerts = safetyAlerts(safety, attendance);
  return <>
    {isLive && <p className="safety-preview"><ShieldAlert size={14} />Preview with sample riders. Live boarding scans will be written to <code>transport_events</code>.</p>}
    {role === "parent" ? <ParentView safety={safety} attendance={attendance} alerts={alerts} />
      : role === "driver" ? <DriverView safety={safety} onChange={onChange} isLive={isLive} />
      : <CommandView safety={safety} attendance={attendance} alerts={alerts} onChange={onChange} onMarkPresent={onMarkPresent} />}
  </>;
}

function CommandView({ safety, attendance, alerts, onChange, onMarkPresent }: { safety: SafetyState; attendance: AttendanceRecord[]; alerts: SafetyAlert[]; onChange: (next: SafetyState) => void; onMarkPresent: (studentId: string) => void }) {
  const flagged = new Set(alerts.map((alert) => alert.studentId));
  const accounted = safety.riders.filter((rider) => !flagged.has(rider.studentId)).length;
  const stats = [
    ["Riders today", String(safety.riders.length), "Route 02 · Bus 12", Bus, "blue"],
    ["Accounted for", `${accounted} / ${safety.riders.length}`, "Every checkpoint confirmed", CircleCheck, "mint"],
    ["Open alerts", String(alerts.length), alerts.length ? "Needs action now" : "Nothing to follow up", ShieldAlert, alerts.length ? "rose" : "mint"],
    ["Empty-bus check", safety.sweepConfirmedAt ? "Done" : "Pending", safety.sweepConfirmedAt ? `Confirmed ${time(safety.sweepConfirmedAt)}` : "Driver has not confirmed", DoorOpen, safety.sweepConfirmedAt ? "mint" : "amber"],
  ] as const;
  function resolve(alert: SafetyAlert, note: string) {
    onChange(logged({ ...safety, resolutions: { ...safety.resolutions, [alert.studentId]: { note, by: "School office", at: new Date().toISOString() } } }, `${alert.name}: ${note}`));
  }
  return <>
    <div className="stats-grid">{stats.map(([label, value, detail, Icon, tone]) => <article className="stat" key={label}><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}><Icon size={17} /></span></div><b className="stat-value">{value}</b><span className="stat-detail">{detail}</span></article>)}</div>
    <div className="safety-grid">
      <section className="panel">
        <Heading title="Alerts" subtitle="Breaks in the chain, raised the moment they happen" tag={alerts.length ? `${alerts.length} OPEN` : "ALL CLEAR"} live={!alerts.length} />
        {alerts.length === 0 && <div className="safety-clear"><ShieldCheck size={20} /><b>Every child is accounted for<small>All riders passed each checkpoint so far today.</small></b></div>}
        {alerts.map((alert) => {
          const guardian = safety.riders.find((rider) => rider.studentId === alert.studentId)?.guardians[0];
          return <article className={`safety-alert ${alert.severity}`} key={alert.id}>
            <span><CircleAlert size={16} /></span>
            <div><b>{alert.title}</b><small>{alert.detail}</small>
              <div className="safety-actions">
                {guardian && <a className="secondary-button" href={`tel:${guardian.phone.replace(/\s/g, "")}`}><PhoneCall size={13} />Call {guardian.relationship.toLowerCase()}</a>}
                {alert.kind === "boarded-not-in-class" && <button className="secondary-button" onClick={() => onMarkPresent(alert.studentId)}><Check size={13} />Found in class · fix register</button>}
                {alert.kind === "still-on-bus" && <button className="secondary-button" onClick={() => onChange(logged(safety, `Driver told to check Bus 12 for ${alert.name}`, "alert"))}><Bus size={13} />Alert driver</button>}
                <button className="primary-button" onClick={() => resolve(alert, alert.kind === "still-on-bus" ? "located safely, off the bus" : alert.kind === "handover-blocked" ? "guardian confirmed by phone" : "located safely on campus")}><ShieldCheck size={13} />Mark located</button>
              </div>
            </div>
          </article>;
        })}
      </section>
      <section className="panel">
        <Heading title="Activity" subtitle="Every scan and action, timestamped" />
        <div className="safety-log">{safety.log.slice(0, 7).map((entry) => <div key={entry.id} className={entry.tone}><i /><span>{entry.text}</span><time>{time(entry.at)}</time></div>)}</div>
      </section>
    </div>
    <section className="panel table-panel safety-board">
      <div className="table-tools"><div><b>Chain board</b></div><span>Bus pickup → school gate → classroom → home handover</span></div>
      <div className="table-scroll"><table><thead><tr><th>STUDENT</th><th>STOP</th>{checkpoints.map((point) => <th key={point.key}>{point.label.toUpperCase()}</th>)}</tr></thead>
        <tbody>{safety.riders.map((rider) => <BoardRow key={rider.studentId} rider={rider} attendance={attendance} resolved={Boolean(safety.resolutions[rider.studentId])} />)}</tbody></table></div>
    </section>
  </>;
}

function BoardRow({ rider, attendance, resolved }: { rider: SafetyRider; attendance: AttendanceRecord[]; resolved: boolean }) {
  const states = checkpointStates(rider, attendance);
  const classRow = attendance.find((row) => row.id === rider.studentId);
  const detail: Record<Checkpoint, string> = { pickup: time(rider.boardedAt), gate: rider.arrivedAt ? time(rider.arrivedAt) : rider.boardedAt ? "Not scanned off" : "—", classroom: classRow?.status ?? "Not taken", handover: rider.handedOverTo ?? "Afternoon" };
  return <tr><td><span className="student"><i>{rider.initials}</i><b>{rider.name}</b></span></td><td>{rider.stop}</td>{checkpoints.map((point) => {
    const state = resolved && states[point.key] === "broken" ? "resolved" : states[point.key];
    return <td key={point.key}><span className={`chain-pill ${state}`}>{state === "done" ? <Check size={11} /> : state === "broken" ? <CircleAlert size={11} /> : <i />}{state === "resolved" ? "Located" : detail[point.key]}</span></td>;
  })}</tr>;
}

function ParentView({ safety, attendance, alerts }: { safety: SafetyState; attendance: AttendanceRecord[]; alerts: SafetyAlert[] }) {
  const child = safety.riders.find((rider) => rider.studentId === parentChildId);
  if (!child) return <section className="panel"><Heading title="Safety Chain" subtitle="Your child does not use school transport today." /></section>;
  const states = checkpointStates(child, attendance);
  const status = attendance.find((row) => row.id === child.studentId)?.status;
  const times: Record<Checkpoint, string> = { pickup: `Boarded Bus 12 at ${child.stop} · ${time(child.boardedAt)}`, gate: child.arrivedAt ? `Scanned in at the school gate · ${time(child.arrivedAt)}` : "Waiting for gate scan", classroom: status ? `Class 5A register: ${status}` : "Register not taken yet", handover: child.handedOverTo ? `Handed to ${child.handedOverTo} · ${time(child.handedOverAt)}` : "After school · only to a verified guardian" };
  const childAlerts = alerts.filter((alert) => alert.studentId === child.studentId);
  return <div className="safety-grid">
    <section className="panel">
      <Heading title={`${child.name.split(" ")[0]}’s day, checkpoint by checkpoint`} subtitle="You are told the moment any step is missed" tag={childAlerts.length ? "ATTENTION" : "ON TRACK"} live={!childAlerts.length} />
      {childAlerts.map((alert) => <article className={`safety-alert ${alert.severity}`} key={alert.id}><span><CircleAlert size={16} /></span><div><b>{alert.title}</b><small>The school office is on it and will call you.</small></div></article>)}
      <ol className="journey">{checkpoints.map((point) => { const Icon = point.icon; return <li key={point.key} className={states[point.key]}><span><Icon size={15} /></span><b>{point.label}<small>{times[point.key]}</small></b>{states[point.key] === "done" && <Check size={15} />}</li>; })}</ol>
    </section>
    <aside className="safety-aside">
      <section className="panel handover-card">
        <Heading title="Today’s handover code" subtitle="Share it only with the adult collecting your child" />
        <div className="handover-code" aria-label="Handover code">{handoverCode(child.studentId).split("").map((digit, index) => <b key={index}>{digit}</b>)}</div>
        <p className="fine-print"><KeyRound size={11} /> The attendant releases {child.name.split(" ")[0]} only after this code is entered. It changes every day, and a wrong code alerts the school.</p>
      </section>
      <section className="panel">
        <Heading title="Authorized guardians" subtitle="Managed by the school office" />
        {child.guardians.map((guardian) => <div className="stop-row" key={guardian.name}><i className="passed" /><b>{guardian.name}<small>{guardian.relationship} · {guardian.phone}</small></b></div>)}
      </section>
    </aside>
  </div>;
}

function DriverView({ safety, onChange, isLive }: { safety: SafetyState; onChange: (next: SafetyState) => void; isLive: boolean }) {
  const [checked, setChecked] = useState<string[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const riding = onBoard(safety);
  const atSchool = safety.riders.filter((rider) => rider.arrivedAt && !rider.handedOverAt);
  const sweepReady = riding.length === 0 && checked.length === sweepSteps.length;
  function scanOff(rider: SafetyRider) {
    onChange(logged({ ...safety, riders: safety.riders.map((item) => item.studentId === rider.studentId ? { ...item, arrivedAt: new Date().toISOString() } : item) }, `${rider.name} scanned off at the school gate`));
  }
  function release(rider: SafetyRider) {
    const code = codes[rider.studentId] ?? "";
    if (!verifyHandover(rider.studentId, code)) {
      onChange(logged({ ...safety, blockedHandovers: { ...safety.blockedHandovers, [rider.studentId]: new Date().toISOString() } }, `Wrong handover code for ${rider.name}. Child kept with attendant.`, "alert"));
      setMessage(`Code did not match. Do not release ${rider.name.split(" ")[0]}. The school office and parent have been alerted.`);
      return;
    }
    const guardian = rider.guardians[0]?.name ?? "Guardian";
    const blockedHandovers = { ...safety.blockedHandovers };
    delete blockedHandovers[rider.studentId];
    onChange(logged({ ...safety, blockedHandovers, riders: safety.riders.map((item) => item.studentId === rider.studentId ? { ...item, handedOverAt: new Date().toISOString(), handedOverTo: guardian } : item) }, `${rider.name} handed to ${guardian} · code verified`));
    setMessage(`${rider.name.split(" ")[0]} released to ${guardian}. Parent notified.`);
  }
  return <div className="safety-grid">
    <section className="panel">
      <Heading title="Still on the bus" subtitle="Scan each child off at the school gate" tag={riding.length ? `${riding.length} ON BOARD` : "BUS EMPTY"} live={!riding.length} />
      {riding.length === 0 && <div className="safety-clear"><ShieldCheck size={20} /><b>No children on board<small>Every rider has been scanned off.</small></b></div>}
      {riding.map((rider) => <div className="assignment-row" key={rider.studentId}><span><ScanLine size={16} /></span><b><small>{rider.stop}</small>{rider.name}<em>Boarded {time(rider.boardedAt)}</em></b><button className="primary-button" onClick={() => scanOff(rider)}><Check size={13} />Scan off</button></div>)}
      <div className="sweep">
        <Heading title="Empty-bus check" subtitle="Required before the bus is parked or the trip ends" tag={safety.sweepConfirmedAt ? `DONE ${time(safety.sweepConfirmedAt)}` : "REQUIRED"} live={Boolean(safety.sweepConfirmedAt)} />
        {sweepSteps.map((step) => <label key={step} className="sweep-step"><input type="checkbox" checked={checked.includes(step) || Boolean(safety.sweepConfirmedAt)} disabled={Boolean(safety.sweepConfirmedAt)} onChange={(event) => setChecked((current) => event.target.checked ? [...current, step] : current.filter((item) => item !== step))} />{step}</label>)}
        {!safety.sweepConfirmedAt && <button className="primary-button" disabled={!sweepReady} onClick={() => onChange(logged({ ...safety, sweepConfirmedAt: new Date().toISOString() }, "Driver confirmed Bus 12 is empty"))}><DoorOpen size={14} />Confirm bus is empty</button>}
        {!safety.sweepConfirmedAt && riding.length > 0 && <p className="fine-print">Locked until every child is scanned off. A child left on a parked bus is the risk this check prevents.</p>}
      </div>
    </section>
    <section className="panel">
      <Heading title="Afternoon handover" subtitle="Release a child only after the guardian’s code matches" />
      {message && <p className="inline-message">{message}</p>}
      {atSchool.map((rider) => <div className="handover-row" key={rider.studentId}><b>{rider.name}<small>{rider.stop} · {rider.guardians.map((guardian) => guardian.name).join(", ")}</small></b><input inputMode="numeric" maxLength={4} aria-label={`Handover code for ${rider.name}`} placeholder="Code" value={codes[rider.studentId] ?? ""} onChange={(event) => setCodes((current) => ({ ...current, [rider.studentId]: event.target.value.replace(/\D/g, "") }))} /><button className="secondary-button" onClick={() => release(rider)}><KeyRound size={13} />Release</button></div>)}
      {!isLive && <p className="fine-print">Demo tip: switch to the Parent view to see today’s code for Meera.</p>}
    </section>
  </div>;
}
