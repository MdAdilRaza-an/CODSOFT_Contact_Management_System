-- Proposed initial schema. The API does not execute this file automatically.
-- Review it and apply it manually only when setting up a new database.
CREATE TABLE contacts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address VARCHAR(255) NULL,
  company VARCHAR(150) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_contacts_email (email),
  UNIQUE KEY uq_contacts_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;