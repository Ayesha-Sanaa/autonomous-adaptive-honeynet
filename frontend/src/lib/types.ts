export type Counted = { value: string; count: number };

export type DayPoint = { day: string; count: number };
export type DayDecoyPoint = { day: string; decoy: string; count: number };

export type Stats = {
  total: number;
  by_decoy: Counted[];
  by_event_type: Counted[];
  top_src_ip: Counted[];
  top_usernames: Counted[];
  top_passwords: Counted[];
  top_commands: Counted[];
  by_day: DayPoint[];
  by_day_decoy?: DayDecoyPoint[];
};

export type EventRow = {
  _id: string;
  id: string;
  decoy: string;
  protocol: string;
  event_type: string;
  src_ip?: string;
  timestamp: string;
  username?: string;
  password?: string;
  command?: string;
  success?: boolean;
  session?: string;
  attack: { id: string; name: string; tactics: string[] }[];
};

export type Attacker = {
  src_ip: string;
  events: number;
  first_seen: string;
  last_seen: string;
  decoys: string[];
  behaviours: { id: string; name: string; tactics: string[] }[];
  techniques: { id: string; name: string; tactics: string[]; events: number }[];
};

export type SessionActor = {
  actor_type: "likely_bot" | "likely_human" | "unknown" | string;
  confidence: number;
  reasons: string[];
  skill_level: "low" | "medium" | "high" | string;
};

export type Session = {
  session: string;
  decoy: string;
  src_ip: string;
  start: string;
  end: string;
  duration_s?: number;
  events?: number;
  login_success: boolean;
  logins: { username: string; password?: string; success: boolean; time?: string }[];
  commands: (string | { command: string; time?: string })[];
  techniques?: { id: string; name: string; tactics: string[]; events?: number }[];
  actor?: SessionActor;
  arm?: string | null;
};

export type HoneytokenEntry = {
  id: string;
  kind: string;
  username?: string;
  planted_in: string;
  usable_on: string[];
  hit_count: number;
  hit: boolean;
  last_hit?: { src_ip?: string; decoy?: string; timestamp?: string; matched_field?: string } | null;
};

export type HoneytokensResponse = {
  tokens: HoneytokenEntry[];
  recent_hits: { token_id: string; planted_in: string; src_ip?: string; decoy: string; timestamp: string; matched_field: string }[];
};

export type OpsSummary = {
  decision_latency_ms: { count: number; median: number | null; p95: number | null };
  fallback_rate: number;
  total_decisions: number;
  fallback_count: number;
  collector_sources: { decoy: string; offset: number; last_poll_at: string; last_event_at: string | null; lag_s: number | null }[];
  sidecar: { status?: string; model_loaded?: boolean; fallback_mode?: boolean };
  crdt: { nodes_total: number; nodes_up: number; ips_total: number };
  last_backup_at: string | null;
  last_backup_age_s: number | null;
};

export type Role = "admin" | "analyst";

export type User = {
  username: string;
  role: Role;
  must_change_password?: boolean;
  created_at?: string;
  last_login?: string | null;
};

export type PendingRequest = { username: string; reason: string; created_at: string };

export type AuditRow = { time: string; actor: string; action: string; target: string; detail: string | null };