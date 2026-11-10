// Shapes returned by the backend API (backend/src/api.js).
export type User = { username: string; role: "admin" | "analyst" };

export type Technique = { id: string; name: string; tactics: string[]; confidence?: string };
export type CountedTechnique = Technique & { events: number };

export type Counted = { value: string; count: number };

export type Stats = {
  total: number;
  by_decoy: Counted[];
  by_event_type: Counted[];
  top_src_ip: Counted[];
  top_usernames: Counted[];
  top_passwords: Counted[];
  top_commands: Counted[];
  by_day: { day: string; count: number }[];
};

export type Attacker = {
  src_ip: string;
  events: number;
  first_seen: string;
  last_seen: string;
  decoys: string[];
  techniques: CountedTechnique[];
  behaviours: (Technique & { reason?: string })[];
};

export type Session = {
  session: string;
  decoy: string;
  src_ip: string;
  start: string;
  end: string;
  duration_s: number;
  events: number;
  logins: { username: string | null; success: boolean | null }[];
  login_success: boolean;
  commands: string[];
  techniques: CountedTechnique[];
};

export type EventRow = {
  _id: string;
  decoy: string;
  event_type: string;
  src_ip: string | null;
  protocol: string | null;
  username: string | null;
  password: string | null;
  command: string | null;
  success: boolean | null;
  timestamp: string;
  attack: Technique[];
};
