# NeighborHelp

A neighbourhood help-matching platform for Mechelen. Post what you need a hand
with, and the app ranks the neighbours best placed to help — showing you exactly
why each one was suggested.

**Stack:** Vue 3 + Vite + Vue Router + Pinia + Axios · Node.js + Express + JWT + CORS · MySQL

---

## Quick start

```bash
# 1. Database
mysql -u root -p < backend/schema.sql

# 2. Backend
cd backend
npm install
cp .env.example .env        # edit with your MySQL details
npm run seed                # demo data — dates generated relative to today
npm run dev                 # http://localhost:3000

# 3. Frontend (new terminal)
cd frontend
npm install
cp .env.example .env
npm run dev                 # http://localhost:5173
```

Open <http://localhost:5173>.

### Demo accounts

All use the password `password123`:

| Email | What it shows |
|---|---|
| `sarah@example.com` | Open requests and offers waiting for an answer |
| `mike@example.com` | Completed work and reviews received |
| `tom@example.com` | Someone who has offered help to others |
| `admin@neighborhelp.be` | The admin dashboard tab |

---

## What it does

**User side**

- Register, log in, log out (JWT)
- Post a help request — category, urgency, description, optional date
- Get **ranked helper matches with the reasoning shown**
- Browse open requests and offer to help
- Accept or decline offers on your own requests; mark them done
- Review someone after a completed request
- Report a problem with a neighbour
- Manage your profile, skills and password
- See your data, and download all of it as JSON

**Business side (admin)**

- Dashboard with platform-wide statistics
- Full CRUD on categories (the core resource)
- Activate/deactivate members
- Resolve or dismiss reports

---

## Project structure

```
neighborhelp/
├── backend/
│   ├── server.js              entry point — middleware + route mounting
│   ├── db.js                  MySQL connection pool
│   ├── schema.sql             7 tables with foreign keys
│   ├── seed.js                demo data with relative dates
│   ├── middleware/auth.js     JWT check + admin check
│   ├── utils/
│   │   ├── matching.js        the scoring engine
│   │   └── geo.js             distance, coordinate blurring, address masking
│   └── routes/                auth, requests, offers, users, reviews,
│                              reports, profile, admin, categories
├── frontend/src/
│   ├── router/index.js        routes + navigation guard
│   ├── stores/auth.js         Pinia store
│   ├── services/api.js        Axios instance + interceptors
│   ├── components/            NavBar, RequestForm, RequestCard, HelperMap,
│   │                          StatCard, StarRating
│   └── views/                 Login, Register, Dashboard, FindHelp,
│                              MyRequests, Community, Map, Reviews, Report,
│                              Privacy, Profile, Admin, NotFound
```

---

## How the matching works

It is a **weighted scoring function**, not machine learning — and the app says so.
Each candidate scores out of 100:

| Signal | Weight | How |
|---|---|---|
| Skill match | 40 | Does the helper list this category as a skill? |
| Distance | 25 | Linear falloff from 0 km to 5 km (haversine) |
| Reliability | 20 | Average review rating, mapped from 1–5 onto 0–1 |
| Availability | 15 | Fewer accepted-but-unfinished commitments scores higher |

Every match returns the score **and the reasons that produced it**, and the UI
prints them. Someone with no reviews gets a neutral 3.5 rather than 0, so new
members are not permanently buried.

Code: `backend/utils/matching.js`.

---

## Privacy decisions

These are deliberate and worth pointing at:

- **House numbers are never sent to other users.** `Brusselsesteenweg 45` is
  returned as `Brusselsesteenweg`. Only your own record shows your full address.
- **Map coordinates are blurred** by a deterministic ~150 m offset, so a marker
  shows the neighbourhood, not the front door. The offset is stable per user, so
  markers do not jitter between loads.
- **Email addresses of other users are never returned** by any endpoint.
- **Passwords** are bcrypt hashes; the `password` column is never selected into
  a response.
- The Privacy page says **"designed in line with GDPR principles"**, not "fully
  compliant" — an absolute legal claim a project cannot support.
- The "right to access" and "right to portability" are **implemented**, not just
  described: the Download-my-data button builds a real JSON export.

Code: `backend/utils/geo.js`, `backend/routes/users.js`.

---

## API reference

Protected routes need `Authorization: Bearer <token>`.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | public | Create account |
| POST | `/api/auth/login` | public | Log in |
| GET | `/api/categories` | user | Category list |
| GET | `/api/requests` | user | Browse open requests (`?mine=true` for yours) |
| GET | `/api/requests/stats` | user | Dashboard numbers |
| GET | `/api/requests/:id` | user | One request |
| GET | `/api/requests/:id/matches` | owner | **Ranked helpers with reasons** |
| POST | `/api/requests` | user | Create |
| PUT | `/api/requests/:id` | owner | Update |
| DELETE | `/api/requests/:id` | owner | Delete |
| GET | `/api/offers?role=helper\|owner` | user | Offers made / received |
| POST | `/api/offers` | user | Offer to help |
| PUT | `/api/offers/:id` | owner | Accept or decline |
| DELETE | `/api/offers/:id` | helper | Withdraw |
| GET | `/api/users` | user | Community list (masked) |
| GET | `/api/users/:id` | user | One public profile |
| GET | `/api/reviews` | user | Stats, top rated, recent |
| GET | `/api/reviews/reviewable` | user | What you can still review |
| POST | `/api/reviews` | participant | Leave a review |
| GET | `/api/reports/reasons` | user | Dropdown options |
| GET | `/api/reports` | user | Your reports |
| POST | `/api/reports` | user | Report someone |
| GET | `/api/profile` | user | Your profile + stats |
| PUT | `/api/profile` | user | Update details and skills |
| PUT | `/api/profile/password` | user | Change password |
| GET | `/api/admin/stats` | **admin** | Platform statistics |
| GET/POST/PUT/DELETE | `/api/admin/categories` | **admin** | Category CRUD |
| GET/PUT | `/api/admin/users` | **admin** | Member moderation |
| GET/PUT | `/api/admin/reports` | **admin** | Report handling |

**Status codes:** 200, 201, 400, 401, 403, 404, 409, 500.

---

## Verified working

Every one of these was run against the real app in a headless browser — 38 checks,
all passing:

**Auth** — logged-out redirect · empty-form validation · wrong password rejected ·
login · session survives refresh · logout blocks protected routes · 404 page

**Privacy** — no house numbers shown for other users · no email addresses leaked

**Matching** — posting a request returns scored matches with visible reasons

**CRUD** — list, create, form clears after create, edit pre-fills, update, delete

**Offers** — offer to help · duplicate offers prevented · offer appears in your list

**Security** — non-admin cannot open `/admin` · non-admin gets **403** from the admin API

**Admin** — category create/edit/delete · refuses to delete a category in use ·
resolve a report · cannot deactivate your own account

**Reviews** — statistics agree with the listed reviews · no dead-end call to action

**Other** — Report tab hosts a real form · Privacy export downloads real JSON ·
map renders markers · profile update syncs the navbar · wrong current password
rejected **without logging you out**

**Removal verified** — the automation endpoints return 404 and no notification
bell renders
