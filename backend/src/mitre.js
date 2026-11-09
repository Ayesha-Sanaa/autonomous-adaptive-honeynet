// ATT&CK Enterprise v20.1, checked against MITRE's official STIX data (modified 2026-11-05)
const ATTACK_VERSION = "20.1";

const TACTICS = {
  "reconnaissance":       { id: "TA0043", name: "Reconnaissance" },
  "resource-development": { id: "TA0042", name: "Resource Development" },
  "initial-access":       { id: "TA0001", name: "Initial Access" },
  "execution":            { id: "TA0002", name: "Execution" },
  "persistence":          { id: "TA0003", name: "Persistence" },
  "privilege-escalation": { id: "TA0004", name: "Privilege Escalation" },
  "stealth":              { id: "TA0005", name: "Stealth" },
  "defense-impairment":   { id: "TA0112", name: "Defense Impairment" },
  "credential-access":    { id: "TA0006", name: "Credential Access" },
  "discovery":            { id: "TA0007", name: "Discovery" },
  "lateral-movement":     { id: "TA0008", name: "Lateral Movement" },
  "collection":           { id: "TA0009", name: "Collection" },
  "command-and-control":  { id: "TA0011", name: "Command and Control" },
  "exfiltration":         { id: "TA0010", name: "Exfiltration" },
  "impact":               { id: "TA0040", name: "Impact" },
};

const TECHNIQUES = {
  "T1078": { name: "Valid Accounts", tactics: ["stealth", "persistence", "privilege-escalation", "initial-access"] },
  "T1110.001": { name: "Brute Force: Password Guessing", tactics: ["credential-access"] },
  "T1595": { name: "Active Scanning", tactics: ["reconnaissance"] },
  "T1595.003": { name: "Active Scanning: Wordlist Scanning", tactics: ["reconnaissance"] },
  "T1033": { name: "System Owner/User Discovery", tactics: ["discovery"] },
  "T1082": { name: "System Information Discovery", tactics: ["discovery"] },
  "T1083": { name: "File and Directory Discovery", tactics: ["discovery"] },
  "T1087.001": { name: "Account Discovery: Local Account", tactics: ["discovery"] },
  "T1003.008": { name: "OS Credential Dumping: /etc/passwd and /etc/shadow", tactics: ["credential-access"] },
  "T1057": { name: "Process Discovery", tactics: ["discovery"] },
  "T1016": { name: "System Network Configuration Discovery", tactics: ["discovery"] },
  "T1049": { name: "System Network Connections Discovery", tactics: ["discovery"] },
  "T1105": { name: "Ingress Tool Transfer", tactics: ["command-and-control"] },
  "T1222.002": { name: "File and Directory Permissions Modification: Linux and Mac Permissions", tactics: ["defense-impairment"] },
  "T1053.003": { name: "Scheduled Task/Job: Cron", tactics: ["execution", "persistence", "privilege-escalation"] },
  "T1548.003": { name: "Abuse Elevation Control Mechanism: Sudo and Sudo Caching", tactics: ["privilege-escalation"] },
  "T1070.003": { name: "Indicator Removal: Clear Command History", tactics: ["stealth"] },
  "T1070.004": { name: "Indicator Removal: File Deletion", tactics: ["stealth"] },
  "T1136.001": { name: "Create Account: Local Account", tactics: ["persistence"] },
  "T1098.004": { name: "Account Manipulation: SSH Authorized Keys", tactics: ["persistence", "privilege-escalation"] },
  "T1059.004": { name: "Command and Scripting Interpreter: Unix Shell", tactics: ["execution"] },
};

// [pattern, technique, confidence]. One command can match several rules.
const COMMAND_RULES = [
  [/^(whoami|id|w|who|users|last)\b/, "T1033", "medium"],
  [/\b(uname|hostname|lscpu|free|df|dmesg)\b|\/proc\/(cpuinfo|meminfo|version)|\/etc\/(os-release|issue)\b/, "T1082", "medium"],
  [/^(ls|find|dir|tree|stat)\b/, "T1083", "medium"],
  [/\/etc\/passwd\b/, "T1087.001", "medium"],
  [/\/etc\/shadow\b/, "T1003.008", "high"],
  [/^(ps|top|pgrep)\b/, "T1057", "medium"],
  [/^(ifconfig|route)\b|^ip\s+(a|addr|link|route)\b/, "T1016", "medium"],
  [/^(netstat|ss)\b/, "T1049", "medium"],
  [/\b(wget|curl|tftp|ftpget|scp)\b/, "T1105", "medium"],
  [/\bchmod\s+(\+x|[0-7]{3,4})\b/, "T1222.002", "medium"],
  [/\bcrontab\b|\/etc\/cron/, "T1053.003", "medium"],
  [/^sudo\b/, "T1548.003", "medium"],
  [/history\s+-c|unset\s+HISTFILE|HISTSIZE=0/, "T1070.003", "medium"],
  [/^rm\s/, "T1070.004", "low"],
  [/\b(useradd|adduser)\b/, "T1136.001", "medium"],
  [/authorized_keys/, "T1098.004", "medium"],
  [/^(sh|bash|dash)\s/, "T1059.004", "low"],
];

function mapAttack(ev) {
  const found = new Map();
  const add = (id, confidence) => {
    if (!found.has(id)) found.set(id, { id, name: TECHNIQUES[id].name, tactics: TECHNIQUES[id].tactics, confidence });
  };
  if (ev.event_type === "login_attempt") {
    if (ev.success === true) add("T1078", "medium");
    else add("T1110.001", "low");
  }
  if (ev.event_type === "command" && ev.command) {
    const cmd = ev.command.trim();
    for (const [re, id, confidence] of COMMAND_RULES) if (re.test(cmd)) add(id, confidence);
  }
  if (ev.decoy === "web-portal" && ev.event_type === "request" && ev.raw && !["/", "/login"].includes(ev.raw.path)) {
    add("T1595.003", "low");
  }
  if (ev.decoy === "dionaea" && ev.event_type === "connect") add("T1595", "low");
  return [...found.values()];
}

module.exports = { ATTACK_VERSION, TACTICS, TECHNIQUES, mapAttack };