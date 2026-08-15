# Interview & defence notes

Everything here maps to code you can open. If you can answer these, you can
defend the project.

---

## 1. Walk me through logging in

1. **`LoginView.vue`** — two inputs bound with `v-model`. `@submit.prevent` stops
   the browser reloading the page.
2. **Client validation** — `validate()` checks the fields. Failures land in
   `errors.value` and render via `v-if`. No request is sent.
3. **Pinia store** — `auth.login()` calls `POST /api/auth/login` through Axios.
4. **`routes/auth.js`** — finds the user by email, then
   `bcrypt.compare(password, storedHash)`. Either failure returns **401 with the
   same message**, so we never reveal which emails exist.
5. **Token** — `jwt.sign({ id, email, role }, SECRET, { expiresIn: '4h' })`.
6. **Session** — the store saves token + user in reactive state *and*
   `localStorage`, then the router pushes to `/dashboard`.

`localStorage` is why refreshing does not log you out: the store reads it on startup.

---

## 2. How does JWT work here?

Three base64 parts — header, payload, signature. The payload holds
`{ id, email, role, iat, exp }`. It is **signed, not encrypted**: anyone can read
it, so never put secrets in it. The signature proves the server issued it.

- **Sending** — the Axios *request* interceptor (`services/api.js`) attaches
  `Authorization: Bearer <token>` to every call automatically.
- **Checking** — `middleware/auth.js` calls `jwt.verify()`, which throws on a bad
  signature or expiry, and on success sets `req.user`.
- **Why `req.user` matters** — every query filters by `req.user.id`, taken from
  the *verified token*, never from the request body. That is what stops user A
  touching user B's data.

**The role is in the token too.** `adminOnly` reads `req.user.role`, not anything
the client sent. If it trusted a body field, anyone could send `role: "admin"`.

---

## 3. The 401 bug I found and fixed

Worth telling as a story — it shows testing, not just building.

The Axios *response* interceptor logged the user out on any 401. But
`PUT /api/profile/password` returns 401 for "your current password is wrong". So
a typo in the change-password form **threw the user out of the app entirely**.

The fix: the auth middleware now tags token failures with a code —

```js
return res.status(401).json({ message: 'Invalid or expired token', code: 'TOKEN_INVALID' });
```

— and the interceptor only clears the session when the code starts with `TOKEN`:

```js
const isTokenProblem =
  error.response?.status === 401 &&
  String(error.response?.data?.code || '').startsWith('TOKEN');
```

The lesson: **the same status code can mean two different things.** A blanket
handler on a status code alone was too coarse.

---

## 4. What is middleware?

A function `(req, res, next)` that runs before the route handler. It can inspect
the request, end it early, or call `next()` to continue.

```js
app.use(cors({ origin: ... }));                    // allow the Vue dev server
app.use(express.json());                           // parse JSON into req.body
app.use('/api/requests', auth, requestRoutes);     // token required
app.use('/api/admin', auth, adminOnly, adminRoutes); // token AND admin
```

That last line is the one to point at: **two middleware in sequence**. `auth`
runs first and sets `req.user`; `adminOnly` then checks `req.user.role`. Mounting
them at the router level is why no individual admin route repeats the check.

---

## 5. Why CORS?

Same-origin policy blocks JavaScript on `localhost:5173` from reading a response
from `localhost:3000` — different port, different origin. The `cors` middleware
adds `Access-Control-Allow-Origin`.

**It is a browser restriction, not a server one.** `curl` never needs CORS. Good
detail to mention — it shows you understand *where* the rule is enforced.

---

## 6. How is the matching implemented? Is it AI?

Be honest: **no, it is a weighted scoring function.** Saying so is stronger than
overclaiming, because the examiner will read the code.

Four signals, in `utils/matching.js`:

| Signal | Weight |
|---|---|
| Skill match (does the helper list this category?) | 40 |
| Distance (haversine, linear falloff to 5 km) | 25 |
| Reliability (average rating, 1–5 mapped to 0–1) | 20 |
| Availability (accepted-but-unfinished commitments) | 15 |

Two decisions worth defending:

- **New helpers get a neutral 3.5, not 0.** Otherwise nobody new ever surfaces
  and the platform cannot bootstrap — a cold-start problem.
- **Every match returns its reasons**, and the UI shows them. A ranking a user
  cannot interrogate is a ranking they will not trust.

If asked how you would make it actually ML: you would need outcome data (which
matches led to accepted, completed, well-reviewed help) and would train on that.
You do not have it, so a transparent heuristic is the honest choice.

---

## 7. Explain the CRUD flow

| Action | Frontend | Request | Backend |
|---|---|---|---|
| Read | `onMounted` → load | `GET /api/requests?mine=true` | `SELECT … WHERE user_id = ?` |
| Create | form emits `save` | `POST /api/requests` | `INSERT`, returns 201 |
| Update | `startEdit()` then save | `PUT /api/requests/:id` | `UPDATE … WHERE id = ? AND user_id = ?` |
| Delete | confirm dialog | `DELETE /api/requests/:id` | `DELETE … WHERE id = ? AND user_id = ?` |

Two details to volunteer:

- **`AND user_id = ?` on update and delete.** Without it anyone could edit any
  record by guessing an id. With it a mismatch gives `affectedRows === 0` and we
  return **404** — the same as genuinely missing, so we do not confirm that
  someone else's record exists.
- **The UI updates without refetching.** Create → `unshift`; update → swap by
  index; delete → `filter`. One round trip, not two.

---

## 8. Why one `RequestForm` for both create and edit?

It takes a `request` prop: `null` means create, an object means edit. A `watch`
with `{ immediate: true }` refills the fields whenever that prop changes.

The form **never calls the API**. It validates, then `emit('save', data)`, and the
parent decides POST or PUT. The component knows about form fields, not HTTP —
which is what makes it reusable.

Two gotchas I hit, both worth mentioning if asked about debugging:

- **The date field.** MySQL returns dates as ISO timestamps, but
  `<input type="date">` needs `yyyy-mm-dd`. Without `.slice(0, 10)` the edit form
  opens with an empty date. I also set `dateStrings: ['DATE']` on the pool.
- **The form did not clear after creating.** The `watch` only fires when the prop
  *changes*, and it stayed `null`. Fixed with `defineExpose({ resetForm })` so the
  parent can clear it.

---

## 9. Frontend route protection vs backend

`router.beforeEach` checks `meta.requiresAuth` and `meta.requiresAdmin`.

**Say this explicitly:** the guard is UX only. It stops a page rendering; it does
not stop data leaking, because anyone can edit their own JavaScript. The real
protection is `auth` + `adminOnly` on the server. My test suite checks both: a
non-admin is bounced from `/admin` **and** gets a 403 from the admin API directly.

---

## 10. SQL injection

Concatenating input into a query lets it become code:

```js
db.query(`SELECT * FROM users WHERE email = '${email}'`);  // DANGEROUS
```

An email of `' OR '1'='1` returns every user.

Every query here uses `?` placeholders:

```js
db.query('SELECT * FROM users WHERE email = ?', [email]);
```

The driver sends the statement and the values separately, so input is always
data, never SQL.

---

## 11. Talk me through the database

Seven tables. The ones worth explaining:

- **`users`** — with a `role` enum and `is_active` for moderation.
- **`user_skills`** — a **join table** for the many-to-many between users and
  categories. Composite primary key `(user_id, category_id)` means the same skill
  cannot be added twice.
- **`help_requests`** — foreign keys to both users and categories.
- **`offers`** — `UNIQUE (request_id, helper_id)` stops double-offering *at the
  database level*, not just in application code.
- **`reviews`** — `UNIQUE (request_id, reviewer_id)`, plus a CHECK constraint
  keeping rating between 1 and 5.

**`ON DELETE CASCADE`** on the child tables: delete a user and their requests,
offers and reviews go with them, rather than leaving orphan rows.

**Why `AVG(rating)` is computed, not stored:** a stored average can drift out of
sync with the reviews it claims to summarise. Deriving it means the number can
never contradict the list.

---

## 12. Status codes

| Code | When |
|---|---|
| 200 | Successful GET / PUT / DELETE |
| 201 | Created |
| 400 | Failed validation |
| 401 | Not authenticated — bad login, missing/expired token |
| 403 | Authenticated but not allowed — non-admin hitting `/api/admin` |
| 404 | Not found, or not yours |
| 409 | Conflict — duplicate email, duplicate offer, category still in use |
| 500 | Unhandled server error |

The **401 vs 403** distinction is the one they probe: 401 is "I don't know who
you are", 403 is "I know exactly who you are and you still may not".

---

## 13. Why validate on both sides?

- **Client** — instant feedback, no wasted round trip. Purely UX.
- **Server** — the only validation that counts. Anyone can bypass the frontend
  with curl or Postman.

If asked "isn't that duplication?" — yes, deliberately. The client version is a
convenience; the server version is the guarantee.

Also worth mentioning: every form has `novalidate`. Native HTML5 validation was
swallowing my own error messages with browser popups, so I turned it off and made
my validation the single source of feedback.

---

## 14. What did you deliberately leave out?

Have these ready — knowing your own limits reads as maturity:

- **Refresh tokens.** 4-hour expiry with a hard logout is blunt.
- **`httpOnly` cookies instead of localStorage.** localStorage is readable by any
  JS on the page, so it is XSS-exposed. An `httpOnly` cookie is not — but then
  CSRF becomes your problem instead. Knowing the trade-off is the answer.
- **Pagination.** Fine at 20 requests, not at 20,000. `LIMIT` / `OFFSET`.
- **Real geocoding.** Addresses are seeded with coordinates; a production version
  would geocode on save via an external API.
- **Automated tests in the repo.** I tested the whole thing end to end in a
  headless browser, but the suite is not committed. Vitest + Supertest would make
  it repeatable in CI.

---

## Mapping to the assignment

| Requirement | Weight | Where |
|---|---|---|
| **Frontend (Vue.js)** | 30% | |
| Must use components | | `components/` — NavBar, RequestForm, RequestCard, HelperMap, StatCard, StarRating |
| Fetch data via own API | | `services/api.js` — every view calls the Express API |
| At least 3 views/pages | | **13** views |
| Form handling with validation | | Every form: `validate()` + `novalidate` + field-level `v-if` errors |
| *Nice to have:* routing, state management | | Vue Router with guards; Pinia store |
| **Backend (Express.js)** | 30% | |
| REST API GET/POST/PUT/DELETE | | All four across requests, offers, categories, profile, admin |
| Database with CRUD | | MySQL, 7 tables, foreign keys, constraints |
| Authentication (login/register) | | JWT + bcrypt, `routes/auth.js` |
| Error handling & input validation | | Central error handler in `server.js`; validation on every route |
| *Nice to have:* external API | | OpenStreetMap tiles via Leaflet |
| **Automation flow** | 20% | **Not implemented — removed by request.** See note below. |
| **Business idea & execution** | 20% | Real problem, working matching engine, admin dashboard, privacy design |

**User side (must-have)**

- Account creation & login ✓
- Profile management ✓ (details, skills, password)
- Core interaction ✓ (post request → get matches → receive offers → accept → complete → review)
- Overview of user actions ✓ (My Requests: requests, offers received, offers made)

**Business side (must-have)**

- Owner/admin dashboard with CRUD ✓
- Manage core resources ✓ (categories, members, reports)

**Optional implemented:** maps/geolocation ✓ · ratings & reviews ✓ · password change ✓

> **Note on the 20% automation section.** This was deliberately removed to keep the
> project small enough to explain end to end. If you submit for the Web Fundamentals
> final, that section will score zero unless an automation flow is added back. For a
> technical interview, the smaller surface area is the better trade.

---

## Where everything lives

| Question | File |
|---|---|
| How is the token created? | `backend/routes/auth.js` → `createToken()` |
| How is it verified? | `backend/middleware/auth.js` |
| How is admin enforced? | `backend/middleware/auth.js` → `adminOnly` |
| How is it attached to requests? | `frontend/src/services/api.js` (request interceptor) |
| Where is the matching logic? | `backend/utils/matching.js` |
| Where is address masking? | `backend/utils/geo.js` → `streetOnly`, `blurCoordinates` |
| Where are routes protected? | `backend/server.js` (real) · `frontend/src/router/index.js` (UX) |
