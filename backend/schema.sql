-- NeighborHelp database schema
-- Run with:  mysql -u root -p < schema.sql

DROP DATABASE IF EXISTS neighborhelp;
CREATE DATABASE neighborhelp;
USE neighborhelp;

-- Categories --------------------------------------------------------------
-- The core resource an admin manages (CRUD from the admin dashboard).
CREATE TABLE categories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255),
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users -------------------------------------------------------------------
-- role: 'user' or 'admin'. Two roles only — enough for the business side
-- without turning into a permissions system.
--
-- Privacy note: we store the full street for matching/distance, but the
-- API never returns house numbers to other users (see routes/users.js).
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password      VARCHAR(255) NOT NULL,
  role          ENUM('user', 'admin') DEFAULT 'user',
  street        VARCHAR(150),
  city          VARCHAR(100) DEFAULT 'Mechelen',
  latitude      DECIMAL(10, 7),
  longitude     DECIMAL(10, 7),
  bio           VARCHAR(255),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Skills a user can offer --------------------------------------------------
-- Many-to-many: one user has many skills, one category is held by many users.
CREATE TABLE user_skills (
  user_id     INT NOT NULL,
  category_id INT NOT NULL,
  PRIMARY KEY (user_id, category_id),
  FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Help requests ------------------------------------------------------------
CREATE TABLE help_requests (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  category_id  INT NOT NULL,
  title        VARCHAR(120) NOT NULL,
  description  TEXT NOT NULL,
  urgency      ENUM('low', 'normal', 'high') DEFAULT 'normal',
  street       VARCHAR(150),
  latitude     DECIMAL(10, 7),
  longitude    DECIMAL(10, 7),
  status       ENUM('open', 'matched', 'completed', 'cancelled') DEFAULT 'open',
  needed_by    DATE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Offers to help -----------------------------------------------------------
-- A helper offers on someone else's request. UNIQUE stops double-offering.
CREATE TABLE offers (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  helper_id  INT NOT NULL,
  message    VARCHAR(500),
  status     ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_offer (request_id, helper_id),
  FOREIGN KEY (request_id) REFERENCES help_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (helper_id)  REFERENCES users(id)         ON DELETE CASCADE
);

-- Reviews ------------------------------------------------------------------
-- Left after a completed request. One review per request per reviewer.
CREATE TABLE reviews (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  request_id  INT NOT NULL,
  reviewer_id INT NOT NULL,
  reviewee_id INT NOT NULL,
  rating      TINYINT NOT NULL,
  comment     VARCHAR(500),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_review (request_id, reviewer_id),
  FOREIGN KEY (request_id)  REFERENCES help_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users(id)         ON DELETE CASCADE,
  FOREIGN KEY (reviewee_id) REFERENCES users(id)         ON DELETE CASCADE,
  CONSTRAINT rating_range CHECK (rating BETWEEN 1 AND 5)
);

-- Reports ------------------------------------------------------------------
-- Users report other users; admins resolve them.
CREATE TABLE reports (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  reporter_id      INT NOT NULL,
  reported_user_id INT NOT NULL,
  reason           VARCHAR(50) NOT NULL,
  details          VARCHAR(500),
  status           ENUM('open', 'resolved', 'dismissed') DEFAULT 'open',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_id)      REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for the queries we run most ---------------------------------------
CREATE INDEX idx_requests_status   ON help_requests(status);
CREATE INDEX idx_requests_user     ON help_requests(user_id);
CREATE INDEX idx_offers_request    ON offers(request_id);
CREATE INDEX idx_reviews_reviewee  ON reviews(reviewee_id);
