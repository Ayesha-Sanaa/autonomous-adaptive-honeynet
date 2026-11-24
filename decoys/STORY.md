# The fake company (one story for every decoy)

Everything here is invented. No real company, person, password or key.

## Company
Alder Freight Ltd, a small logistics firm (about 40 staff). Two offices, one small server room.

## Network plan (10.20.0.0/24)
| Name    | Address    | Job                          |
|---------|------------|------------------------------|
| jump01  | 10.20.0.5  | SSH jump host                |
| web01   | 10.20.0.10 | Inventory web portal         |
| db01    | 10.20.0.15 | Inventory database (MySQL)   |
| ftp01   | 10.20.0.20 | Partner file exchange (FTP)  |
| nas01   | 10.20.0.30 | File server and backups      |

## People and accounts
| Username | Person / role              | Machines          |
|----------|----------------------------|-------------------|
| admin    | IT administrator           | jump01, web01     |
| backup   | database backup account    | db01              |
| backupsvc| backup service on the NAS  | nas01             |
| priya    | finance                    | web01, nas01      |
| omar     | warehouse manager          | web01             |
| lena     | dispatcher                 | web01, ftp01      |
| sam      | developer                  | web01, db01       |
| ubuntu, pi, user, test | old default or lab accounts | jump01 |

## Projects and files
- inventory-app (web, port 8081), database `inventory`
- nightly backup script, dumps in /var/backups (the 2024-10-28 dump is the newest "old" one)
- staging site, partner files in ftp01 `/outgoing`
- finance sheets on nas01 `Finance` share (invoices, exports)

## Timeline
- Servers built January 2024. Last patch round in October 2024.
- Logs go back a few weeks. Notes and history mention dates after July 2024.

## Rules for every decoy
1. Hostnames, usernames, addresses and project names must match this file.
2. If one decoy mentions another host (db01, nas01), that host must answer with the same story.
3. Only fake credentials, and each credential that sits in a file gets a unique fake value (honeytoken).
4. Nothing here may point to a real system.

## Which decoy uses what
| Decoy                  | Uses from this story                                          |
|------------------------|---------------------------------------------------------------|
| Cowrie (jump01)        | hostname, users, notes, backup.sh, ssh config, cron, app config |
| Web portal (web01)     | company name, inventory pages, users, backup link              |
| FTP (ftp01)            | /outgoing files, partner names, dates                          |
| SMB/NAS (nas01)        | Finance, Shared, Backups shares                                |
| MySQL (db01)           | database `inventory`, user `backup`                            |