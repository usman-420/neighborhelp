// seed.js — fills the database with realistic demo data.
//
// Run with:  npm run seed
//
// Everything dated is generated RELATIVE TO TODAY, so the demo never
// goes stale. (The Figma prototype hardcoded May 2026 dates and by
// August they were showing as "upcoming events" three months in the past.)

const bcrypt = require('bcryptjs');
const db = require('./db');

// Real Mechelen streets with roughly correct coordinates.
const PEOPLE = [
  ['Sarah Chen',       'sarah@example.com',   'Brusselsesteenweg 45', 51.0230, 4.4700, 'Gardener and dog lover. Happy to help with outdoor jobs.'],
  ['Mike Johnson',     'mike@example.com',    'Vismarkt 12',          51.0285, 4.4790, 'Retired electrician. Small repairs, no job too small.'],
  ['Jessica Taylor',   'jessica@example.com', 'Grote Markt 5',        51.0280, 4.4805, 'Student, free most afternoons. Good with computers.'],
  ['David Kim',        'david@example.com',   'Bruul 88',             51.0265, 4.4780, 'I cook a lot and often make too much.'],
  ['Emma Rousseau',    'emma@example.com',    'Nekkerspoelstraat 22', 51.0300, 4.4900, 'Mum of two, can help with childcare and school runs.'],
  ['Tom Andersson',    'tom@example.com',     'Onder den Toren 3',    51.0275, 4.4795, 'Handy with furniture and moving heavy things.'],
  ['Aisha Osman',      'aisha@example.com',   'Zandpoortvest 60',     51.0240, 4.4830, 'Nurse. Can help with shopping for elderly neighbours.'],
  ['Lucas Peeters',    'lucas@example.com',   'Leopoldstraat 14',     51.0310, 4.4760, 'Cyclist and bike mechanic. Free repairs for neighbours.'],
  ['Nora De Smet',     'nora@example.com',    'Battelsesteenweg 90',  51.0350, 4.4650, 'Translator, French and Dutch. Happy to help with paperwork.'],
  ['Rob Martinez',     'rob@example.com',     'Hombeeksesteenweg 30', 51.0180, 4.4600, 'Painter and decorator by trade.'],
];

const CATEGORIES = [
  ['Gardening',     'Lawns, hedges, planting and outdoor tidying'],
  ['Home repairs',  'Small fixes, assembly, plumbing and electrical'],
  ['Tech support',  'Computers, phones, wifi and online forms'],
  ['Childcare',     'Babysitting, school runs and after-school help'],
  ['Shopping',      'Groceries and errands for those who cannot get out'],
  ['Moving help',   'Lifting, carrying and transporting'],
  ['Pet care',      'Dog walking, feeding and sitting'],
  ['Language help', 'Translation, paperwork and form filling'],
];

// Skills per person, by category index (0 = Gardening, …)
const SKILLS = {
  'Sarah Chen': [0, 6],
  'Mike Johnson': [1, 5],
  'Jessica Taylor': [2, 3],
  'David Kim': [4, 2],
  'Emma Rousseau': [3, 4],
  'Tom Andersson': [5, 1],
  'Aisha Osman': [4, 3],
  'Lucas Peeters': [1, 5],
  'Nora De Smet': [7, 2],
  'Rob Martinez': [1, 0],
};

// Requests: [ownerName, categoryIndex, title, description, urgency, daysAgo, status]
const REQUESTS = [
  ['Sarah Chen', 2, 'Cannot get my printer working',
   'New wifi printer refuses to connect. I have tried turning everything off and on again. Any patient soul welcome.',
   'normal', 2, 'open'],
  ['Mike Johnson', 0, 'Hedge needs cutting before winter',
   'Front hedge has got away from me this year. About 8 metres. I have the tools, just not the back for it any more.',
   'low', 5, 'open'],
  ['Emma Rousseau', 5, 'Help moving a sofa on Saturday',
   'Two-seater sofa from the first floor down to a van. Should take twenty minutes with two people.',
   'high', 1, 'open'],
  ['David Kim', 3, 'School pickup Thursday afternoon',
   'Stuck in a meeting until 16:30 on Thursday. Need someone to collect my daughter from Sint-Romboutscollege at 15:30.',
   'high', 0, 'open'],
  ['Jessica Taylor', 7, 'Help understanding a rental contract',
   'My Dutch is not good enough for the legal parts. Would appreciate someone reading it through with me.',
   'normal', 3, 'open'],
  ['Aisha Osman', 6, 'Dog walking while I work nights',
   'Two weeks of night shifts coming up. Bruno is a very calm labrador who just needs a half hour walk.',
   'normal', 4, 'open'],
  ['Tom Andersson', 1, 'Dripping tap in the kitchen',
   'Slow drip that is getting worse. I suspect it just needs a new washer but I do not have the tools.',
   'normal', 9, 'completed'],
  ['Nora De Smet', 4, 'Weekly groceries while my leg heals',
   'Broken ankle, six weeks in a cast. Just the basics from the Colruyt once a week.',
   'normal', 12, 'completed'],
  ['Lucas Peeters', 0, 'Front garden overgrown after holiday',
   'Three weeks away and it has gone wild. Mostly weeding and a bit of pruning.',
   'low', 15, 'completed'],
];

// Offers: [requestIndex, helperName, message, status]
const OFFERS = [
  [0, 'Jessica Taylor', 'I do this for a living, happy to pop round this evening.', 'pending'],
  [0, 'Nora De Smet',   'I had the same problem last month, I know the fix.',       'pending'],
  [1, 'Rob Martinez',   'I have a hedge trimmer and a free Saturday morning.',      'pending'],
  [2, 'Tom Andersson',  'I can be there Saturday, I move furniture all the time.',  'pending'],
  [3, 'Aisha Osman',    'I collect my own son at the same time, happy to help.',    'pending'],
  [6, 'Mike Johnson',   'Easy fix, I have the washers in my toolbox.',              'accepted'],
  [7, 'Aisha Osman',    'I shop there anyway, happy to do yours at the same time.', 'accepted'],
  [8, 'Sarah Chen',     'Gardening is my thing, I will bring my own tools.',        'accepted'],
];

// Reviews: [requestIndex, reviewerName, revieweeName, rating, comment]
const REVIEWS = [
  [6, 'Tom Andersson', 'Mike Johnson',  5, 'Fixed in ten minutes and refused to take anything for it. Wonderful neighbour.'],
  [6, 'Mike Johnson',  'Tom Andersson', 5, 'Easy to arrange and had everything ready when I arrived.'],
  [7, 'Nora De Smet',  'Aisha Osman',   5, 'Did my shopping for six weeks without ever making me feel like a burden.'],
  [7, 'Aisha Osman',   'Nora De Smet',  4, 'Clear lists and always ready with the money. Very easy.'],
  [8, 'Lucas Peeters', 'Sarah Chen',    4, 'Garden looks much better. Took a bit longer than planned but a good job.'],
  [8, 'Sarah Chen',    'Lucas Peeters', 5, 'Friendly, offered coffee twice, and paid for the green waste bags.'],
];

async function seed() {
  console.log('Seeding NeighborHelp…');

  // Order matters — foreign keys.
  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of ['reviews', 'reports', 'offers', 'help_requests', 'user_skills', 'users', 'categories']) {
    await db.query(`TRUNCATE TABLE ${t}`);
  }
  await db.query('SET FOREIGN_KEY_CHECKS = 1');

  // Categories -------------------------------------------------------------
  const categoryIds = [];
  for (const [name, description] of CATEGORIES) {
    const [r] = await db.query('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description]);
    categoryIds.push(r.insertId);
  }
  console.log(`  ${categoryIds.length} categories`);

  // Users ------------------------------------------------------------------
  const hash = await bcrypt.hash('password123', 10);
  const userIds = {};

  // Admin account
  const [adminRes] = await db.query(
    `INSERT INTO users (name, email, password, role, street, latitude, longitude, bio)
     VALUES (?, ?, ?, 'admin', ?, ?, ?, ?)`,
    ['Admin', 'admin@neighborhelp.be', hash, 'Grote Markt 1', 51.0281, 4.4801, 'Platform administrator']
  );
  userIds['Admin'] = adminRes.insertId;

  for (const [name, email, street, lat, lng, bio] of PEOPLE) {
    const [r] = await db.query(
      `INSERT INTO users (name, email, password, street, latitude, longitude, bio)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, email, hash, street, lat, lng, bio]
    );
    userIds[name] = r.insertId;

    for (const idx of SKILLS[name] || []) {
      await db.query('INSERT INTO user_skills (user_id, category_id) VALUES (?, ?)', [
        r.insertId,
        categoryIds[idx],
      ]);
    }
  }
  console.log(`  ${Object.keys(userIds).length} users (password for all: password123)`);

  // Requests ---------------------------------------------------------------
  const requestIds = [];
  for (const [owner, catIdx, title, description, urgency, daysAgo, status] of REQUESTS) {
    const [[coords]] = await db.query('SELECT street, latitude, longitude FROM users WHERE id = ?', [
      userIds[owner],
    ]);

    const [r] = await db.query(
      `INSERT INTO help_requests
         (user_id, category_id, title, description, urgency, street, latitude, longitude,
          status, needed_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,
               DATE_ADD(CURDATE(), INTERVAL ? DAY),
               DATE_SUB(NOW(), INTERVAL ? DAY))`,
      [
        userIds[owner], categoryIds[catIdx], title, description, urgency,
        coords.street, coords.latitude, coords.longitude, status,
        // Open requests are needed soon; completed ones were needed in the past.
        status === 'completed' ? -(daysAgo - 2) : Math.max(1, 7 - daysAgo),
        daysAgo,
      ]
    );
    requestIds.push(r.insertId);
  }
  console.log(`  ${requestIds.length} help requests (dates relative to today)`);

  // Offers -----------------------------------------------------------------
  for (const [reqIdx, helper, message, status] of OFFERS) {
    await db.query(
      'INSERT INTO offers (request_id, helper_id, message, status) VALUES (?, ?, ?, ?)',
      [requestIds[reqIdx], userIds[helper], message, status]
    );
  }
  // A request with an accepted offer that is still running is 'matched'.
  await db.query(
    `UPDATE help_requests r
     SET r.status = 'matched'
     WHERE r.status = 'open'
       AND EXISTS (SELECT 1 FROM offers o WHERE o.request_id = r.id AND o.status = 'accepted')`
  );
  console.log(`  ${OFFERS.length} offers`);

  // Reviews ----------------------------------------------------------------
  for (const [reqIdx, reviewer, reviewee, rating, comment] of REVIEWS) {
    await db.query(
      `INSERT INTO reviews (request_id, reviewer_id, reviewee_id, rating, comment, created_at)
       VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
      [requestIds[reqIdx], userIds[reviewer], userIds[reviewee], rating, comment, reqIdx]
    );
  }
  console.log(`  ${REVIEWS.length} reviews`);

  // One example report so the admin dashboard is not empty ------------------
  await db.query(
    `INSERT INTO reports (reporter_id, reported_user_id, reason, details)
     VALUES (?, ?, ?, ?)`,
    [userIds['Emma Rousseau'], userIds['Rob Martinez'], 'Did not show up',
     'Agreed a time twice and did not turn up either time, no message.']
  );

  console.log('\nDone. Log in with any of these (password: password123):');
  console.log('  admin@neighborhelp.be   (admin — sees the Admin tab)');
  console.log('  sarah@example.com       (has open requests and offers waiting)');
  console.log('  mike@example.com        (has reviews and completed work)');

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
