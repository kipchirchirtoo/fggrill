# FAMOUSGATE HOTELS - RECEPTION & CASHIER MODULE DEEP-DIVE ANALYSIS REPORT

**Generated Date:** 2026-07-29  
**Environment:** Live Production Database (`rvoaowhxyweswwuxbrzm` - Supabase PostgreSQL 17)  
**Scope:** Backend API (`backend/`), Client Application (`famous_gates_app/`), and Live Database Schemas  

---

## 1. EXECUTIVE SUMMARY & ARCHITECTURE OVERVIEW

The **Reception & Cashier Module** forms the operational and financial core of the FamousGate Hotels Management System. It orchestrates the entire guest lifecycle from pre-arrival reservation to front desk check-in, in-house folio billing, cross-outlet charge-to-room posting, cashier shift reconciliation, and final check-out settlement.

### Key Architectural Layers
1. **Database Layer (Supabase / PostgreSQL 17)**: High-performance relational database with strict Row Level Security (RLS), automated triggers for folio balances, transactional integrity, and multi-branch data isolation via `branch_id`.
2. **Backend API Layer (Node.js / Express / TypeScript)**: Modular controller and service architecture handling operational business logic, rate calculation, shift reconciliation, audit trails, and payment provider integrations (M-Pesa, Cash, Card, Credit).
3. **Client Layer (`famous_gates_app/` & Next.js Frontend)**: Offline-first desktop and mobile client built with Flutter/Dart utilizing PowerSync SQLite local caching and real-time backend synchronization.

---

## 2. LIVE DATABASE SCHEMA ANALYSIS (34 TABLES)

Below is the exact live database schema extracted directly from the active production PostgreSQL instance.

### Table: `bookings`
* **Live Row Count:** `82`
* **Total Columns:** `35`
* **Foreign Key References:** `4`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `branch_id` | `integer` | ❌ No | — | 🔗 FK -> `branches.id` |
| `booking_number` | `text` | ❌ No | — | |
| `guest_id` | `uuid` | ❌ No | — | 🔗 FK -> `guests.id` |
| `room_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `rooms.id` |
| `booking_type` | `text` | ❌ No | `'room'::text` | |
| `status` | `text` | ❌ No | `'confirmed'::text` | |
| `check_in_at` | `timestamp with time zone` | ✅ Yes | — | |
| `check_out_at` | `timestamp with time zone` | ✅ Yes | — | |
| `pax` | `integer` | ❌ No | `1` | |
| `subtotal` | `numeric` | ❌ No | `0` | |
| `tax_amount` | `numeric` | ❌ No | `0` | |
| `service_charge` | `numeric` | ❌ No | `0` | |
| `discount_amount` | `numeric` | ❌ No | `0` | |
| `total_amount` | `numeric` | ❌ No | `0` | |
| `amount_paid` | `numeric` | ❌ No | `0` | |
| `payment_status` | `text` | ❌ No | `'pending'::text` | |
| `created_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `metadata` | `jsonb` | ❌ No | `'{}'::jsonb` | |
| `created_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `updated_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `deposit_amount` | `numeric` | ✅ Yes | `0` | |
| `deposit_paid` | `boolean` | ✅ Yes | `false` | |
| `room_rate` | `numeric` | ✅ Yes | `0` | |
| `meal_plan` | `text` | ✅ Yes | `'room_only'::text` | |
| `booking_source` | `text` | ✅ Yes | `'walk_in'::text` | |
| `special_requests` | `text` | ✅ Yes | — | |
| `adults` | `integer` | ✅ Yes | `1` | |
| `children` | `integer` | ✅ Yes | `0` | |
| `infants` | `integer` | ✅ Yes | `0` | |
| `internal_notes` | `text` | ✅ Yes | — | |
| `payment_method` | `text` | ✅ Yes | `'cash'::text` | |
| `check_in_date` | `date` | ✅ Yes | — | |
| `check_out_date` | `date` | ✅ Yes | — | |
| `confirmation_number` | `text` | ✅ Yes | — | |

#### Foreign Key Relationships
- `bookings.branch_id` ➔ `branches.id`
- `bookings.created_by` ➔ `users.id`
- `bookings.guest_id` ➔ `guests.id`
- `bookings.room_id` ➔ `rooms.id`

---

### Table: `reservations`
* **Live Row Count:** `84`
* **Total Columns:** `47`
* **Foreign Key References:** `10`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `branch_id` | `integer` | ❌ No | — | 🔗 FK -> `branches.id` |
| `booking_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `bookings.id` |
| `reservation_number` | `text` | ❌ No | — | |
| `guest_id` | `uuid` | ❌ No | — | 🔗 FK -> `guests.id` |
| `room_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `rooms.id` |
| `status` | `text` | ❌ No | `'confirmed'::text` | |
| `reserved_from` | `timestamp with time zone` | ❌ No | — | |
| `reserved_to` | `timestamp with time zone` | ❌ No | — | |
| `created_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `created_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `updated_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `check_in_date` | `date` | ✅ Yes | — | |
| `check_out_date` | `date` | ✅ Yes | — | |
| `confirmation_number` | `text` | ✅ Yes | — | |
| `total_amount` | `numeric` | ✅ Yes | `0` | |
| `amount_paid` | `numeric` | ✅ Yes | `0` | |
| `payment_status` | `text` | ✅ Yes | `'pending'::text` | |
| `payment_method` | `text` | ✅ Yes | `'cash'::text` | |
| `special_requests` | `text` | ✅ Yes | — | |
| `adults` | `integer` | ✅ Yes | `1` | |
| `children` | `integer` | ✅ Yes | `0` | |
| `checked_in_at` | `timestamp with time zone` | ✅ Yes | — | |
| `checked_in_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `checked_out_at` | `timestamp with time zone` | ✅ Yes | — | |
| `checked_out_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `cancelled_at` | `timestamp with time zone` | ✅ Yes | — | |
| `cancelled_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `cancellation_reason` | `text` | ✅ Yes | — | |
| `room_type_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `room_types.id` |
| `rate_plan_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `rate_plans.id` |
| `room_rate` | `numeric` | ✅ Yes | `0` | |
| `subtotal` | `numeric` | ✅ Yes | `0` | |
| `tax_amount` | `numeric` | ✅ Yes | `0` | |
| `service_charge` | `numeric` | ✅ Yes | `0` | |
| `discount_amount` | `numeric` | ✅ Yes | `0` | |
| `deposit_amount` | `numeric` | ✅ Yes | `0` | |
| `deposit_paid` | `boolean` | ✅ Yes | `false` | |
| `deposit_paid_at` | `timestamp with time zone` | ✅ Yes | — | |
| `booking_source` | `text` | ✅ Yes | `'WALK_IN'::text` | |
| `channel_manager_ref` | `text` | ✅ Yes | — | |
| `meal_plan` | `text` | ✅ Yes | — | |
| `purpose` | `text` | ✅ Yes | — | |
| `notes` | `text` | ✅ Yes | — | |
| `internal_notes` | `text` | ✅ Yes | — | |
| `short_code` | `text` | ✅ Yes | — | |
| `infants` | `integer` | ✅ Yes | `0` | |

#### Foreign Key Relationships
- `reservations.booking_id` ➔ `bookings.id`
- `reservations.branch_id` ➔ `branches.id`
- `reservations.cancelled_by` ➔ `users.id`
- `reservations.checked_in_by` ➔ `users.id`
- `reservations.checked_out_by` ➔ `users.id`
- `reservations.created_by` ➔ `users.id`
- `reservations.guest_id` ➔ `guests.id`
- `reservations.rate_plan_id` ➔ `rate_plans.id`
- `reservations.room_id` ➔ `rooms.id`
- `reservations.room_type_id` ➔ `room_types.id`

---

### Table: `rooms`
* **Live Row Count:** `64`
* **Total Columns:** `29`
* **Foreign Key References:** `5`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `branch_id` | `integer` | ❌ No | — | 🔗 FK -> `branches.id` |
| `room_type_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `room_types.id` |
| `room_number` | `text` | ❌ No | — | |
| `floor` | `text` | ✅ Yes | — | |
| `building` | `text` | ✅ Yes | — | |
| `status` | `text` | ❌ No | `'available'::text` | |
| `housekeeping_status` | `text` | ❌ No | `'clean'::text` | |
| `is_active` | `boolean` | ❌ No | `true` | |
| `created_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `updated_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `amenities` | `jsonb` | ✅ Yes | `'[]'::jsonb` | |
| `image_url` | `text` | ✅ Yes | — | |
| `price_override` | `numeric` | ✅ Yes | — | |
| `max_occupancy` | `integer` | ✅ Yes | `2` | |
| `type_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `room_types.id` |
| `is_clean` | `boolean` | ✅ Yes | `true` | |
| `room_type` | `text` | ✅ Yes | — | |
| `notes` | `text` | ✅ Yes | — | |
| `last_cleaned` | `timestamp with time zone` | ✅ Yes | — | |
| `current_guest` | `uuid` | ✅ Yes | — | 🔗 FK -> `guests.id` |
| `hk_status` | `text` | ✅ Yes | `'clean'::text` | |
| `cleaning_priority` | `text` | ✅ Yes | `'normal'::text` | |
| `is_vip` | `boolean` | ✅ Yes | `false` | |
| `assigned_attendant_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `hk_staff_profiles.id` |
| `last_cleaned_at` | `timestamp with time zone` | ✅ Yes | — | |
| `expected_checkout` | `timestamp with time zone` | ✅ Yes | — | |
| `dnd_start_time` | `timestamp with time zone` | ✅ Yes | — | |
| `rate` | `numeric` | ✅ Yes | — | |

#### Foreign Key Relationships
- `rooms.assigned_attendant_id` ➔ `hk_staff_profiles.id`
- `rooms.branch_id` ➔ `branches.id`
- `rooms.current_guest` ➔ `guests.id`
- `rooms.room_type_id` ➔ `room_types.id`
- `rooms.type_id` ➔ `room_types.id`

---

### Table: `room_types`
* **Live Row Count:** `6`
* **Total Columns:** `13`
* **Foreign Key References:** `1`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `branch_id` | `integer` | ❌ No | — | 🔗 FK -> `branches.id` |
| `code` | `text` | ❌ No | — | |
| `name` | `text` | ❌ No | — | |
| `base_rate` | `numeric` | ❌ No | `0` | |
| `max_occupancy` | `integer` | ❌ No | `1` | |
| `amenities` | `jsonb` | ❌ No | `'[]'::jsonb` | |
| `is_active` | `boolean` | ❌ No | `true` | |
| `created_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `updated_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `price_per_night` | `numeric` | ✅ Yes | — | |
| `rate` | `numeric` | ✅ Yes | — | |
| `type_name` | `text` | ✅ Yes | — | |

#### Foreign Key Relationships
- `room_types.branch_id` ➔ `branches.id`

---

### Table: `room_status_history`
* **Live Row Count:** `409`
* **Total Columns:** `7`
* **Foreign Key References:** `2`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `room_id` | `uuid` | ❌ No | — | 🔗 FK -> `rooms.id` |
| `old_status` | `text` | ✅ Yes | — | |
| `new_status` | `text` | ❌ No | — | |
| `changed_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `reason` | `text` | ✅ Yes | — | |
| `created_at` | `timestamp with time zone` | ✅ Yes | `now()` | |

#### Foreign Key Relationships
- `room_status_history.changed_by` ➔ `users.id`
- `room_status_history.room_id` ➔ `rooms.id`

---

### Table: `guests`
* **Live Row Count:** `61`
* **Total Columns:** `28`
* **Foreign Key References:** `1`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `branch_id` | `integer` | ✅ Yes | — | 🔗 FK -> `branches.id` |
| `first_name` | `text` | ❌ No | — | |
| `last_name` | `text` | ✅ Yes | — | |
| `phone` | `text` | ✅ Yes | — | |
| `email` | `text` | ✅ Yes | — | |
| `id_number` | `text` | ❌ No | — | |
| `id_type` | `text` | ❌ No | `'national_id'::text` | |
| `car_plate` | `text` | ✅ Yes | — | |
| `loyalty_tier` | `text` | ✅ Yes | `'bronze'::text` | |
| `loyalty_points` | `numeric` | ❌ No | `0` | |
| `metadata` | `jsonb` | ❌ No | `'{}'::jsonb` | |
| `created_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `updated_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `is_vip` | `boolean` | ✅ Yes | `false` | |
| `blacklist_status` | `text` | ✅ Yes | `'none'::text` | |
| `blacklist_reason` | `text` | ✅ Yes | — | |
| `nationality` | `text` | ✅ Yes | `'Kenyan'::text` | |
| `date_of_birth` | `date` | ✅ Yes | — | |
| `total_visits` | `integer` | ✅ Yes | `0` | |
| `address` | `text` | ✅ Yes | — | |
| `preferences` | `jsonb` | ✅ Yes | `'{}'::jsonb` | |
| `car_number_plate` | `text` | ✅ Yes | — | |
| `vip_tier` | `text` | ✅ Yes | — | |
| `notes` | `text` | ✅ Yes | — | |
| `city` | `text` | ✅ Yes | — | |
| `country` | `text` | ✅ Yes | — | |
| `blacklist_status_bool` | `boolean` | ✅ Yes | `false` | |

#### Foreign Key Relationships
- `guests.branch_id` ➔ `branches.id`

---

### Table: `guest_profiles`
* **Live Row Count:** `0`
* **Total Columns:** `8`
* **Foreign Key References:** `2`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `guest_id` | `uuid` | ❌ No | — | 🔗 FK -> `guests.id` |
| `loyalty_number` | `text` | ✅ Yes | — | |
| `vip_since` | `date` | ✅ Yes | — | |
| `preferred_room_type` | `uuid` | ✅ Yes | — | 🔗 FK -> `room_types.id` |
| `preferred_floor` | `text` | ✅ Yes | — | |
| `allergies` | `jsonb` | ✅ Yes | `'[]'::jsonb` | |
| `notes` | `text` | ✅ Yes | — | |
| `updated_at` | `timestamp with time zone` | ✅ Yes | `now()` | |

#### Foreign Key Relationships
- `guest_profiles.guest_id` ➔ `guests.id`
- `guest_profiles.preferred_room_type` ➔ `room_types.id`

---

### Table: `guest_documents`
* **Live Row Count:** `0`
* **Total Columns:** `10`
* **Foreign Key References:** `3`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `guest_id` | `uuid` | ❌ No | — | 🔗 FK -> `guests.id` |
| `reservation_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `reservations.id` |
| `document_type` | `text` | ❌ No | — | |
| `file_name` | `text` | ✅ Yes | — | |
| `file_url` | `text` | ✅ Yes | — | |
| `file_size` | `bigint` | ✅ Yes | — | |
| `mime_type` | `text` | ✅ Yes | — | |
| `uploaded_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `created_at` | `timestamp with time zone` | ✅ Yes | `now()` | |

#### Foreign Key Relationships
- `guest_documents.guest_id` ➔ `guests.id`
- `guest_documents.reservation_id` ➔ `reservations.id`
- `guest_documents.uploaded_by` ➔ `users.id`

---

### Table: `guest_messages`
* **Live Row Count:** `0`
* **Total Columns:** `9`
* **Foreign Key References:** `3`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `branch_id` | `integer` | ✅ Yes | — | 🔗 FK -> `branches.id` |
| `guest_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `guests.id` |
| `channel` | `text` | ✅ Yes | `'sms'::text` | |
| `subject` | `text` | ✅ Yes | — | |
| `body` | `text` | ❌ No | — | |
| `status` | `text` | ✅ Yes | `'sent'::text` | |
| `sent_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `created_at` | `timestamp with time zone` | ✅ Yes | `now()` | |

#### Foreign Key Relationships
- `guest_messages.branch_id` ➔ `branches.id`
- `guest_messages.guest_id` ➔ `guests.id`
- `guest_messages.sent_by` ➔ `users.id`

---

### Table: `guest_preferences`
* **Live Row Count:** `0`
* **Total Columns:** `6`
* **Foreign Key References:** `1`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `guest_id` | `uuid` | ❌ No | — | 🔗 FK -> `guests.id` |
| `category` | `text` | ❌ No | — | |
| `preference` | `text` | ❌ No | — | |
| `notes` | `text` | ✅ Yes | — | |
| `created_at` | `timestamp with time zone` | ✅ Yes | `now()` | |

#### Foreign Key Relationships
- `guest_preferences.guest_id` ➔ `guests.id`

---

### Table: `folios`
* **Live Row Count:** `84`
* **Total Columns:** `20`
* **Foreign Key References:** `4`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `branch_id` | `integer` | ❌ No | — | 🔗 FK -> `branches.id` |
| `folio_number` | `text` | ❌ No | — | |
| `booking_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `bookings.id` |
| `guest_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `guests.id` |
| `status` | `text` | ❌ No | `'open'::text` | |
| `total_charges` | `numeric` | ❌ No | `0` | |
| `total_payments` | `numeric` | ❌ No | `0` | |
| `balance_due` | `numeric` | ❌ No | `0` | |
| `created_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `updated_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `room_charges` | `numeric` | ✅ Yes | `0` | |
| `food_charges` | `numeric` | ✅ Yes | `0` | |
| `beverage_charges` | `numeric` | ✅ Yes | `0` | |
| `other_charges` | `numeric` | ✅ Yes | `0` | |
| `settled` | `boolean` | ✅ Yes | `false` | |
| `settled_at` | `timestamp with time zone` | ✅ Yes | — | |
| `notes` | `text` | ✅ Yes | — | |
| `reservation_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `reservations.id` |
| `balance` | `numeric` | ✅ Yes | `0` | |

#### Foreign Key Relationships
- `folios.booking_id` ➔ `bookings.id`
- `folios.branch_id` ➔ `branches.id`
- `folios.guest_id` ➔ `guests.id`
- `folios.reservation_id` ➔ `reservations.id`

---

### Table: `folio_items`
* **Live Row Count:** `0`
* **Total Columns:** `12`
* **Foreign Key References:** `3`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `folio_id` | `uuid` | ❌ No | — | 🔗 FK -> `folios.id` |
| `description` | `text` | ❌ No | — | |
| `charge_date` | `date` | ✅ Yes | `CURRENT_DATE` | |
| `department` | `text` | ✅ Yes | — | |
| `amount` | `numeric` | ✅ Yes | `0` | |
| `quantity` | `numeric` | ✅ Yes | `1` | |
| `unit_price` | `numeric` | ✅ Yes | `0` | |
| `voided` | `boolean` | ✅ Yes | `false` | |
| `voided_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `created_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `created_at` | `timestamp with time zone` | ✅ Yes | `now()` | |

#### Foreign Key Relationships
- `folio_items.created_by` ➔ `users.id`
- `folio_items.folio_id` ➔ `folios.id`
- `folio_items.voided_by` ➔ `users.id`

---

### Table: `folio_payments`
* **Live Row Count:** `0`
* **Total Columns:** `7`
* **Foreign Key References:** `2`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `folio_id` | `uuid` | ❌ No | — | 🔗 FK -> `folios.id` |
| `payment_method` | `text` | ❌ No | — | |
| `amount` | `numeric` | ❌ No | — | |
| `reference` | `text` | ✅ Yes | — | |
| `received_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `received_at` | `timestamp with time zone` | ✅ Yes | `now()` | |

#### Foreign Key Relationships
- `folio_payments.folio_id` ➔ `folios.id`
- `folio_payments.received_by` ➔ `users.id`

---

### Table: `folio_transactions`
* **Live Row Count:** `7`
* **Total Columns:** `14`
* **Foreign Key References:** `3`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `folio_id` | `uuid` | ❌ No | — | 🔗 FK -> `folios.id` |
| `branch_id` | `integer` | ✅ Yes | — | 🔗 FK -> `branches.id` |
| `transaction_type` | `text` | ❌ No | — | |
| `category` | `text` | ✅ Yes | — | |
| `description` | `text` | ❌ No | — | |
| `amount` | `numeric` | ✅ Yes | `0` | |
| `tax_amount` | `numeric` | ✅ Yes | `0` | |
| `total_amount` | `numeric` | ✅ Yes | `0` | |
| `reference` | `text` | ✅ Yes | — | |
| `posted_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `posted_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `status` | `text` | ✅ Yes | `'posted'::text` | |
| `created_at` | `timestamp with time zone` | ✅ Yes | `now()` | |

#### Foreign Key Relationships
- `folio_transactions.branch_id` ➔ `branches.id`
- `folio_transactions.folio_id` ➔ `folios.id`
- `folio_transactions.posted_by` ➔ `users.id`

---

### Table: `payments`
* **Live Row Count:** `2`
* **Total Columns:** `22`
* **Foreign Key References:** `4`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `branch_id` | `integer` | ✅ Yes | — | 🔗 FK -> `branches.id` |
| `booking_id` | `uuid` | ✅ Yes | — | |
| `restaurant_order_id` | `uuid` | ✅ Yes | — | |
| `bar_order_id` | `uuid` | ✅ Yes | — | |
| `pos_transaction_id` | `uuid` | ✅ Yes | — | |
| `cashier_shift_id` | `uuid` | ✅ Yes | — | |
| `amount` | `numeric` | ❌ No | `0` | |
| `payment_method` | `text` | ❌ No | `'cash'::text` | |
| `reference_number` | `text` | ✅ Yes | — | |
| `reference` | `text` | ✅ Yes | — | |
| `customer_name` | `text` | ✅ Yes | — | |
| `recorded_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `cashier_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `status` | `text` | ✅ Yes | `'completed'::text` | |
| `metadata` | `jsonb` | ✅ Yes | `'{}'::jsonb` | |
| `recorded_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `created_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `updated_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `reservation_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `reservations.id` |
| `invoice_id` | `uuid` | ✅ Yes | — | |
| `payment_date` | `timestamp with time zone` | ✅ Yes | — | |

#### Foreign Key Relationships
- `payments.branch_id` ➔ `branches.id`
- `payments.cashier_id` ➔ `users.id`
- `payments.recorded_by` ➔ `users.id`
- `payments.reservation_id` ➔ `reservations.id`

---

### Table: `branch_payments`
* **Live Row Count:** `1`
* **Total Columns:** `39`
* **Foreign Key References:** `10`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `branch_id` | `integer` | ❌ No | — | 🔗 FK -> `branches.id` |
| `payment_number` | `text` | ❌ No | — | |
| `category` | `text` | ❌ No | — | |
| `payee_name` | `text` | ❌ No | — | |
| `payee_account` | `text` | ✅ Yes | — | |
| `payment_method` | `text` | ❌ No | — | |
| `amount` | `numeric` | ❌ No | — | |
| `status` | `text` | ❌ No | `'pending'::text` | |
| `po_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `purchase_orders.id` |
| `grn_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `goods_receipts.id` |
| `invoice_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `supplier_invoices.id` |
| `created_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `released_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `released_at` | `timestamp with time zone` | ✅ Yes | — | |
| `metadata` | `jsonb` | ❌ No | `'{}'::jsonb` | |
| `created_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `updated_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `payment_date` | `date` | ✅ Yes | `CURRENT_DATE` | |
| `reference_number` | `text` | ✅ Yes | — | |
| `currency` | `text` | ✅ Yes | `'KES'::text` | |
| `requires_director` | `boolean` | ✅ Yes | `false` | |
| `created_by_name` | `text` | ✅ Yes | — | |
| `manager_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `manager_approved_at` | `timestamp with time zone` | ✅ Yes | — | |
| `director_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `director_approved_at` | `timestamp with time zone` | ✅ Yes | — | |
| `receipt_url` | `text` | ✅ Yes | — | |
| `description` | `text` | ✅ Yes | — | |
| `rejected_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `rejected_at` | `timestamp with time zone` | ✅ Yes | — | |
| `rejection_reason` | `text` | ✅ Yes | — | |
| `payment_status` | `text` | ✅ Yes | `'pending'::text` | |
| `payment_amount` | `numeric` | ✅ Yes | — | |
| `reference` | `text` | ✅ Yes | — | |
| `cash_flow_category` | `text` | ✅ Yes | — | |
| `source` | `text` | ✅ Yes | — | |
| `settlement_status` | `text` | ✅ Yes | `'pending'::text` | |
| `purchase_order_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `purchase_orders.id` |

#### Foreign Key Relationships
- `branch_payments.branch_id` ➔ `branches.id`
- `branch_payments.created_by` ➔ `users.id`
- `branch_payments.director_id` ➔ `users.id`
- `branch_payments.grn_id` ➔ `goods_receipts.id`
- `branch_payments.invoice_id` ➔ `supplier_invoices.id`
- `branch_payments.manager_id` ➔ `users.id`
- `branch_payments.po_id` ➔ `purchase_orders.id`
- `branch_payments.purchase_order_id` ➔ `purchase_orders.id`
- `branch_payments.rejected_by` ➔ `users.id`
- `branch_payments.released_by` ➔ `users.id`

---

### Table: `branch_payment_receipts`
* **Live Row Count:** `6`
* **Total Columns:** `17`
* **Foreign Key References:** `3`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `payment_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `branch_payments.id` |
| `branch_id` | `integer` | ✅ Yes | — | 🔗 FK -> `branches.id` |
| `receipt_number` | `text` | ❌ No | — | |
| `payment_number` | `text` | ✅ Yes | — | |
| `supplier_name` | `text` | ✅ Yes | — | |
| `amount` | `numeric` | ✅ Yes | `0` | |
| `currency` | `text` | ✅ Yes | `'KES'::text` | |
| `receipt_url` | `text` | ✅ Yes | — | |
| `generated_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `metadata` | `jsonb` | ✅ Yes | `'{}'::jsonb` | |
| `created_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `document_status` | `text` | ✅ Yes | `'generated'::text` | |
| `generated_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `archived_at` | `timestamp with time zone` | ✅ Yes | — | |
| `auditor_notified_at` | `timestamp with time zone` | ✅ Yes | — | |
| `director_notified_at` | `timestamp with time zone` | ✅ Yes | — | |

#### Foreign Key Relationships
- `branch_payment_receipts.branch_id` ➔ `branches.id`
- `branch_payment_receipts.generated_by` ➔ `users.id`
- `branch_payment_receipts.payment_id` ➔ `branch_payments.id`

---

### Table: `cashier_shifts`
* **Live Row Count:** `0`
* **Total Columns:** `27`
* **Foreign Key References:** `2`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `branch_id` | `integer` | ❌ No | — | 🔗 FK -> `branches.id` |
| `cashier_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `shift_number` | `text` | ❌ No | — | |
| `status` | `text` | ❌ No | `'open'::text` | |
| `opening_float` | `numeric` | ❌ No | `0` | |
| `closing_float` | `numeric` | ❌ No | `0` | |
| `opened_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `closed_at` | `timestamp with time zone` | ✅ Yes | — | |
| `created_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `updated_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `start_time` | `timestamp with time zone` | ✅ Yes | — | |
| `end_time` | `timestamp with time zone` | ✅ Yes | — | |
| `cashier_name` | `text` | ✅ Yes | — | |
| `approved_by` | `uuid` | ✅ Yes | — | |
| `approved_at` | `timestamp with time zone` | ✅ Yes | — | |
| `approval_notes` | `text` | ✅ Yes | — | |
| `flagged_by` | `uuid` | ✅ Yes | — | |
| `flagged_at` | `timestamp with time zone` | ✅ Yes | — | |
| `flag_reason` | `text` | ✅ Yes | — | |
| `flag_notes` | `text` | ✅ Yes | — | |
| `expected_cash` | `numeric` | ❌ No | `0` | |
| `actual_cash` | `numeric` | ❌ No | `0` | |
| `total_sales` | `numeric` | ❌ No | `0` | |
| `discrepancy_amount` | `numeric` | ❌ No | `0` | |
| `shift_start` | `timestamp with time zone` | ✅ Yes | — | |
| `shift_end` | `timestamp with time zone` | ✅ Yes | — | |

#### Foreign Key Relationships
- `cashier_shifts.branch_id` ➔ `branches.id`
- `cashier_shifts.cashier_id` ➔ `users.id`

---

### Table: `cashier_shift_logs`
* **Live Row Count:** `173`
* **Total Columns:** `74`
* **Foreign Key References:** `11`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `shift_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `cashier_shifts.id` |
| `action` | `text` | ✅ Yes | — | |
| `actor_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `notes` | `text` | ✅ Yes | — | |
| `created_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `branch_id` | `integer` | ✅ Yes | — | |
| `status` | `text` | ✅ Yes | `'open'::text` | |
| `shift_number` | `text` | ✅ Yes | — | |
| `cashier_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `cashier_name` | `text` | ✅ Yes | — | |
| `shift_start` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `shift_end` | `timestamp with time zone` | ✅ Yes | — | |
| `opening_float` | `numeric` | ✅ Yes | `0` | |
| `closing_float` | `numeric` | ✅ Yes | `0` | |
| `expected_closing_float` | `numeric` | ✅ Yes | `0` | |
| `variance` | `numeric` | ✅ Yes | `0` | |
| `total_cash_sales` | `numeric` | ✅ Yes | `0` | |
| `total_mpesa_sales` | `numeric` | ✅ Yes | `0` | |
| `total_card_sales` | `numeric` | ✅ Yes | `0` | |
| `total_sales` | `numeric` | ✅ Yes | `0` | |
| `transaction_count` | `integer` | ✅ Yes | `0` | |
| `reconciled_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `reconciled_at` | `timestamp with time zone` | ✅ Yes | — | |
| `reconciliation_notes` | `text` | ✅ Yes | — | |
| `verified_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `verified_at` | `timestamp with time zone` | ✅ Yes | — | |
| `verification_notes` | `text` | ✅ Yes | — | |
| `submitted_at` | `timestamp with time zone` | ✅ Yes | — | |
| `submitted_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `approved_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `approved_at` | `timestamp with time zone` | ✅ Yes | — | |
| `swimming_pool_revenue` | `numeric` | ✅ Yes | `0` | |
| `pool_token_revenue` | `numeric` | ✅ Yes | `0` | |
| `conference_revenue` | `numeric` | ✅ Yes | `0` | |
| `room_booking_revenue` | `numeric` | ✅ Yes | `0` | |
| `restaurant_revenue` | `numeric` | ✅ Yes | `0` | |
| `bar_revenue` | `numeric` | ✅ Yes | `0` | |
| `other_revenue` | `numeric` | ✅ Yes | `0` | |
| `credit_bills_taken` | `numeric` | ✅ Yes | `0` | |
| `credit_bills_count` | `integer` | ✅ Yes | `0` | |
| `unpaid_bills_value` | `numeric` | ✅ Yes | `0` | |
| `unpaid_bills_count` | `integer` | ✅ Yes | `0` | |
| `paid_bills_value` | `numeric` | ✅ Yes | `0` | |
| `paid_bills_count` | `integer` | ✅ Yes | `0` | |
| `credit_bills_details` | `jsonb` | ✅ Yes | `'[]'::jsonb` | |
| `paid_bills_details` | `jsonb` | ✅ Yes | `'[]'::jsonb` | |
| `unpaid_bills_details` | `jsonb` | ✅ Yes | `'[]'::jsonb` | |
| `cash_at_hand` | `numeric` | ✅ Yes | `0` | |
| `cash_deposited` | `numeric` | ✅ Yes | `0` | |
| `bank_deposit_ref` | `text` | ✅ Yes | — | |
| `pool_na` | `boolean` | ✅ Yes | `false` | |
| `conference_na` | `boolean` | ✅ Yes | `false` | |
| `rooms_na` | `boolean` | ✅ Yes | `false` | |
| `updated_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `requested_at` | `timestamp with time zone` | ✅ Yes | — | |
| `opening_requested_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `opening_approved_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `opening_approved_at` | `timestamp with time zone` | ✅ Yes | — | |
| `opening_rejected_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `opening_rejected_at` | `timestamp with time zone` | ✅ Yes | — | |
| `opening_review_notes` | `text` | ✅ Yes | — | |
| `expense_total` | `numeric` | ❌ No | `0` | |
| `expense_details` | `jsonb` | ❌ No | `'[]'::jsonb` | |
| `actual_cash_counted` | `numeric` | ✅ Yes | `0` | |
| `actual_mpesa_logged` | `numeric` | ✅ Yes | `0` | |
| `actual_card_logged` | `numeric` | ✅ Yes | `0` | |
| `mpesa_summary_ref` | `text` | ✅ Yes | — | |
| `card_batch_ref` | `text` | ✅ Yes | — | |
| `reconciliation_status` | `text` | ✅ Yes | `'not_started'::text` | |
| `hard_closed_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `hard_closed_at` | `timestamp with time zone` | ✅ Yes | — | |
| `variance_reason_code` | `text` | ✅ Yes | — | |
| `variance_comment` | `text` | ✅ Yes | — | |

#### Foreign Key Relationships
- `cashier_shift_logs.actor_id` ➔ `users.id`
- `cashier_shift_logs.approved_by` ➔ `users.id`
- `cashier_shift_logs.cashier_id` ➔ `users.id`
- `cashier_shift_logs.hard_closed_by` ➔ `users.id`
- `cashier_shift_logs.opening_approved_by` ➔ `users.id`
- `cashier_shift_logs.opening_rejected_by` ➔ `users.id`
- `cashier_shift_logs.opening_requested_by` ➔ `users.id`
- `cashier_shift_logs.reconciled_by` ➔ `users.id`
- `cashier_shift_logs.shift_id` ➔ `cashier_shifts.id`
- `cashier_shift_logs.submitted_by` ➔ `users.id`
- `cashier_shift_logs.verified_by` ➔ `users.id`

---

### Table: `cashier_transactions`
* **Live Row Count:** `18493`
* **Total Columns:** `44`
* **Foreign Key References:** `5`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `branch_id` | `integer` | ❌ No | — | 🔗 FK -> `branches.id` |
| `cashier_shift_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `cashier_shifts.id` |
| `transaction_number` | `text` | ❌ No | `((('CT'::text \|\| to_char(now(), 'YYMMDD'::text)) \|\| '-'::text) \|\| lpad(((floor((random() * (1000000)::double precision)))::integer)::text, 6, '0'::text))` | |
| `transaction_type` | `text` | ❌ No | `'payment'::text` | |
| `payment_method` | `text` | ✅ Yes | — | |
| `amount` | `numeric` | ❌ No | `0` | |
| `source_module` | `text` | ✅ Yes | — | |
| `source_document_type` | `text` | ✅ Yes | — | |
| `source_document_id` | `uuid` | ✅ Yes | — | |
| `source_document_number` | `text` | ✅ Yes | — | |
| `status` | `text` | ❌ No | `'completed'::text` | |
| `created_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `created_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `cashier_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `cashier_name` | `text` | ✅ Yes | — | |
| `shift_id` | `uuid` | ✅ Yes | — | |
| `cashier_shift_log_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `cashier_shift_logs.id` |
| `revenue_type` | `text` | ✅ Yes | — | |
| `reference_type` | `text` | ✅ Yes | — | |
| `reference_id` | `uuid` | ✅ Yes | — | |
| `customer_name` | `text` | ✅ Yes | — | |
| `customer_phone` | `text` | ✅ Yes | — | |
| `payment_reference` | `text` | ✅ Yes | — | |
| `reference_number` | `text` | ✅ Yes | — | |
| `credit_bill_id` | `uuid` | ✅ Yes | — | |
| `total_amount` | `numeric` | ✅ Yes | `0` | |
| `amount_paid` | `numeric` | ✅ Yes | `0` | |
| `amount_tendered` | `numeric` | ✅ Yes | `0` | |
| `change_given` | `numeric` | ✅ Yes | `0` | |
| `invoice_number` | `text` | ✅ Yes | — | |
| `order_number` | `text` | ✅ Yes | — | |
| `bill_number` | `text` | ✅ Yes | — | |
| `confirmation_number` | `text` | ✅ Yes | — | |
| `transaction_date` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `recorded_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `booking_date` | `date` | ✅ Yes | — | |
| `booking_status` | `text` | ✅ Yes | — | |
| `payment_status` | `text` | ✅ Yes | — | |
| `approval_status` | `text` | ✅ Yes | `'pending'::text` | |
| `method` | `text` | ✅ Yes | — | |
| `notes` | `text` | ✅ Yes | — | |
| `metadata` | `jsonb` | ✅ Yes | `'{}'::jsonb` | |
| `updated_at` | `timestamp with time zone` | ✅ Yes | `now()` | |

#### Foreign Key Relationships
- `cashier_transactions.branch_id` ➔ `branches.id`
- `cashier_transactions.cashier_id` ➔ `users.id`
- `cashier_transactions.cashier_shift_id` ➔ `cashier_shifts.id`
- `cashier_transactions.cashier_shift_log_id` ➔ `cashier_shift_logs.id`
- `cashier_transactions.created_by` ➔ `users.id`

---

### Table: `cashier_bills`
* **Live Row Count:** `0`
* **Total Columns:** `28`
* **Foreign Key References:** `6`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `branch_id` | `integer` | ✅ Yes | — | 🔗 FK -> `branches.id` |
| `bill_number` | `text` | ✅ Yes | — | |
| `short_code` | `text` | ✅ Yes | — | |
| `bill_type` | `text` | ✅ Yes | `'general'::text` | |
| `customer_name` | `text` | ✅ Yes | — | |
| `customer_phone` | `text` | ✅ Yes | — | |
| `customer_email` | `text` | ✅ Yes | — | |
| `guest_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `guests.id` |
| `room_number` | `text` | ✅ Yes | — | |
| `reservation_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `reservations.id` |
| `waiter_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `subtotal` | `numeric` | ✅ Yes | `0` | |
| `tax_amount` | `numeric` | ✅ Yes | `0` | |
| `service_charge` | `numeric` | ✅ Yes | `0` | |
| `discount_amount` | `numeric` | ✅ Yes | `0` | |
| `total_amount` | `numeric` | ✅ Yes | `0` | |
| `amount_paid` | `numeric` | ✅ Yes | `0` | |
| `balance_due` | `numeric` | ✅ Yes | `0` | |
| `payment_status` | `text` | ✅ Yes | `'unpaid'::text` | |
| `payment_method` | `text` | ✅ Yes | — | |
| `status` | `text` | ✅ Yes | `'open'::text` | |
| `notes` | `text` | ✅ Yes | — | |
| `created_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `closed_at` | `timestamp with time zone` | ✅ Yes | — | |
| `closed_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `created_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `updated_at` | `timestamp with time zone` | ✅ Yes | `now()` | |

#### Foreign Key Relationships
- `cashier_bills.branch_id` ➔ `branches.id`
- `cashier_bills.closed_by` ➔ `users.id`
- `cashier_bills.created_by` ➔ `users.id`
- `cashier_bills.guest_id` ➔ `guests.id`
- `cashier_bills.reservation_id` ➔ `reservations.id`
- `cashier_bills.waiter_id` ➔ `users.id`

---

### Table: `cashier_logbooks`
* **Live Row Count:** `162`
* **Total Columns:** `36`
* **Foreign Key References:** `9`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `branch_id` | `integer` | ❌ No | — | 🔗 FK -> `branches.id` |
| `shift_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `cashier_shifts.id` |
| `cashier_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `logbook_number` | `text` | ❌ No | `generate_cashier_logbook_number()` | |
| `period_start` | `timestamp with time zone` | ❌ No | `now()` | |
| `period_end` | `timestamp with time zone` | ✅ Yes | — | |
| `opening_float` | `numeric` | ✅ Yes | `0` | |
| `closing_float` | `numeric` | ✅ Yes | `0` | |
| `total_sales` | `numeric` | ✅ Yes | `0` | |
| `status` | `text` | ✅ Yes | `'open'::text` | |
| `created_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `updated_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `outlet_shift_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `pos_outlet_shifts.id` |
| `outlet_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `pos_outlets.id` |
| `total_cash` | `numeric` | ✅ Yes | `0` | |
| `total_mpesa` | `numeric` | ✅ Yes | `0` | |
| `total_card` | `numeric` | ✅ Yes | `0` | |
| `total_credit_bill` | `numeric` | ✅ Yes | `0` | |
| `type` | `text` | ✅ Yes | `'cashier'::text` | |
| `log_date` | `date` | ✅ Yes | `CURRENT_DATE` | |
| `total_swipe` | `numeric` | ✅ Yes | `0` | |
| `sales_breakdown` | `jsonb` | ✅ Yes | `'{}'::jsonb` | |
| `notes` | `text` | ✅ Yes | — | |
| `source` | `text` | ✅ Yes | — | |
| `automation_run_id` | `uuid` | ✅ Yes | — | |
| `submitted_at` | `timestamp with time zone` | ✅ Yes | — | |
| `approved_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `approved_at` | `timestamp with time zone` | ✅ Yes | — | |
| `auditor_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `audited_at` | `timestamp with time zone` | ✅ Yes | — | |
| `audit_notes` | `text` | ✅ Yes | — | |
| `cashier_shift_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `cashier_shift_logs.id` |
| `accountant_reviewed_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `accountant_reviewed_at` | `timestamp with time zone` | ✅ Yes | — | |
| `accountant_notes` | `text` | ✅ Yes | — | |

#### Foreign Key Relationships
- `cashier_logbooks.accountant_reviewed_by` ➔ `users.id`
- `cashier_logbooks.approved_by` ➔ `users.id`
- `cashier_logbooks.auditor_id` ➔ `users.id`
- `cashier_logbooks.branch_id` ➔ `branches.id`
- `cashier_logbooks.cashier_id` ➔ `users.id`
- `cashier_logbooks.cashier_shift_id` ➔ `cashier_shift_logs.id`
- `cashier_logbooks.outlet_id` ➔ `pos_outlets.id`
- `cashier_logbooks.outlet_shift_id` ➔ `pos_outlet_shifts.id`
- `cashier_logbooks.shift_id` ➔ `cashier_shifts.id`

---

### Table: `cashier_logbook_lines`
* **Live Row Count:** `19753`
* **Total Columns:** `17`
* **Foreign Key References:** `2`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `logbook_id` | `uuid` | ❌ No | — | 🔗 FK -> `cashier_logbooks.id` |
| `line_type` | `text` | ❌ No | — | |
| `description` | `text` | ✅ Yes | — | |
| `amount` | `numeric` | ✅ Yes | `0` | |
| `reference` | `text` | ✅ Yes | — | |
| `created_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `payment_method` | `text` | ✅ Yes | — | |
| `order_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `pos_shift_orders.id` |
| `section` | `text` | ✅ Yes | — | |
| `customer_name` | `text` | ✅ Yes | — | |
| `staff_id` | `uuid` | ✅ Yes | — | |
| `source_table` | `text` | ✅ Yes | — | |
| `source_id` | `uuid` | ✅ Yes | — | |
| `outlet_shift_id` | `uuid` | ✅ Yes | — | |
| `automation_run_id` | `uuid` | ✅ Yes | — | |
| `metadata` | `jsonb` | ✅ Yes | `'{}'::jsonb` | |

#### Foreign Key Relationships
- `cashier_logbook_lines.logbook_id` ➔ `cashier_logbooks.id`
- `cashier_logbook_lines.order_id` ➔ `pos_shift_orders.id`

---

### Table: `credit_bills`
* **Live Row Count:** `1228`
* **Total Columns:** `37`
* **Foreign Key References:** `3`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `branch_id` | `integer` | ❌ No | — | 🔗 FK -> `branches.id` |
| `bill_number` | `text` | ❌ No | — | |
| `customer_name` | `text` | ❌ No | — | |
| `customer_phone` | `text` | ✅ Yes | — | |
| `source_module` | `text` | ❌ No | — | |
| `source_document_id` | `uuid` | ✅ Yes | — | |
| `source_document_number` | `text` | ✅ Yes | — | |
| `total_amount` | `numeric` | ❌ No | `0` | |
| `amount_paid` | `numeric` | ❌ No | `0` | |
| `balance_due` | `numeric` | ❌ No | `0` | |
| `status` | `text` | ❌ No | `'open'::text` | |
| `created_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `created_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `updated_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `credit_number` | `text` | ✅ Yes | — | |
| `staff_id` | `uuid` | ✅ Yes | — | |
| `staff_name` | `text` | ✅ Yes | — | |
| `amount` | `numeric` | ✅ Yes | `0` | |
| `paid_amount` | `numeric` | ✅ Yes | `0` | |
| `balance` | `numeric` | ✅ Yes | `0` | |
| `bill_date` | `date` | ✅ Yes | `CURRENT_DATE` | |
| `description` | `text` | ✅ Yes | — | |
| `approval_status` | `text` | ✅ Yes | `'pending'::text` | |
| `source_pos_shift_id` | `uuid` | ✅ Yes | — | |
| `source_pos_order_id` | `uuid` | ✅ Yes | — | |
| `source_pos_payment_id` | `uuid` | ✅ Yes | — | |
| `source_logbook_id` | `uuid` | ✅ Yes | — | |
| `created_by_name` | `text` | ✅ Yes | — | |
| `paid_via_payroll_run_id` | `uuid` | ✅ Yes | — | |
| `paid_at` | `timestamp with time zone` | ✅ Yes | — | |
| `paid_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `payment_reference` | `text` | ✅ Yes | — | |
| `payment_method` | `text` | ✅ Yes | — | |
| `notes` | `text` | ✅ Yes | — | |
| `metadata` | `jsonb` | ✅ Yes | `'{}'::jsonb` | |
| `credit_date` | `date` | ✅ Yes | — | |

#### Foreign Key Relationships
- `credit_bills.branch_id` ➔ `branches.id`
- `credit_bills.created_by` ➔ `users.id`
- `credit_bills.paid_by` ➔ `users.id`

---

### Table: `unpaid_bills`
* **Live Row Count:** `0`
* **Total Columns:** `22`
* **Foreign Key References:** `3`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `branch_id` | `integer` | ✅ Yes | — | 🔗 FK -> `branches.id` |
| `bill_number` | `text` | ❌ No | — | |
| `bill_type` | `text` | ❌ No | — | |
| `source_id` | `uuid` | ✅ Yes | — | |
| `guest_name` | `text` | ✅ Yes | — | |
| `total_amount` | `numeric` | ✅ Yes | `0` | |
| `amount_paid` | `numeric` | ✅ Yes | `0` | |
| `balance_due` | `numeric` | ✅ Yes | `0` | |
| `status` | `text` | ✅ Yes | `'open'::text` | |
| `due_date` | `date` | ✅ Yes | — | |
| `created_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `created_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `updated_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `waiter_id` | `uuid` | ✅ Yes | — | |
| `customer_id` | `uuid` | ✅ Yes | — | |
| `auditor_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `auditor_confirmed_at` | `timestamp with time zone` | ✅ Yes | — | |
| `remarks` | `text` | ✅ Yes | — | |
| `balance_amount` | `numeric` | ✅ Yes | — | |
| `customer_name` | `text` | ✅ Yes | — | |
| `bill_date` | `date` | ✅ Yes | — | |

#### Foreign Key Relationships
- `unpaid_bills.auditor_id` ➔ `users.id`
- `unpaid_bills.branch_id` ➔ `branches.id`
- `unpaid_bills.created_by` ➔ `users.id`

---

### Table: `void_bills`
* **Live Row Count:** `0`
* **Total Columns:** `9`
* **Foreign Key References:** `2`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `branch_id` | `integer` | ✅ Yes | — | 🔗 FK -> `branches.id` |
| `bill_ref` | `text` | ❌ No | — | |
| `bill_type` | `text` | ❌ No | — | |
| `amount` | `numeric` | ✅ Yes | `0` | |
| `reason` | `text` | ✅ Yes | — | |
| `voided_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `voided_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `status` | `text` | ✅ Yes | `'voided'::text` | |

#### Foreign Key Relationships
- `void_bills.branch_id` ➔ `branches.id`
- `void_bills.voided_by` ➔ `users.id`

---

### Table: `void_requests`
* **Live Row Count:** `0`
* **Total Columns:** `17`
* **Foreign Key References:** `6`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `branch_id` | `integer` | ✅ Yes | — | 🔗 FK -> `branches.id` |
| `bill_ref` | `text` | ❌ No | — | |
| `bill_type` | `text` | ❌ No | — | |
| `amount` | `numeric` | ✅ Yes | `0` | |
| `reason` | `text` | ✅ Yes | — | |
| `requested_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `status` | `text` | ✅ Yes | `'pending'::text` | |
| `approved_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `created_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `order_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `restaurant_orders.id` |
| `pos_order_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `pos_shift_orders.id` |
| `source` | `text` | ✅ Yes | `'restaurant'::text` | |
| `reviewed_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `reviewed_at` | `timestamp with time zone` | ✅ Yes | — | |
| `rejection_reason` | `text` | ✅ Yes | — | |
| `void_items` | `jsonb` | ✅ Yes | `'[]'::jsonb` | |

#### Foreign Key Relationships
- `void_requests.approved_by` ➔ `users.id`
- `void_requests.branch_id` ➔ `branches.id`
- `void_requests.order_id` ➔ `restaurant_orders.id`
- `void_requests.pos_order_id` ➔ `pos_shift_orders.id`
- `void_requests.requested_by` ➔ `users.id`
- `void_requests.reviewed_by` ➔ `users.id`

---

### Table: `additional_services`
* **Live Row Count:** `0`
* **Total Columns:** `20`
* **Foreign Key References:** `1`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `branch_id` | `integer` | ✅ Yes | — | 🔗 FK -> `branches.id` |
| `service_code` | `text` | ✅ Yes | — | |
| `service_name` | `text` | ❌ No | — | |
| `service_type` | `text` | ❌ No | — | |
| `description` | `text` | ✅ Yes | — | |
| `pricing_type` | `text` | ✅ Yes | `'fixed'::text` | |
| `base_price` | `numeric` | ✅ Yes | `0` | |
| `currency` | `text` | ✅ Yes | `'KES'::text` | |
| `capacity` | `integer` | ✅ Yes | — | |
| `duration_minutes` | `integer` | ✅ Yes | — | |
| `is_active` | `boolean` | ✅ Yes | `true` | |
| `is_branch_specific` | `boolean` | ✅ Yes | `true` | |
| `requires_booking` | `boolean` | ✅ Yes | `true` | |
| `advance_booking_hours` | `integer` | ✅ Yes | `0` | |
| `terms_and_conditions` | `text` | ✅ Yes | — | |
| `created_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `updated_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `amount` | `numeric` | ✅ Yes | — | |
| `status` | `text` | ✅ Yes | — | |

#### Foreign Key Relationships
- `additional_services.branch_id` ➔ `branches.id`

---

### Table: `service_bookings`
* **Live Row Count:** `0`
* **Total Columns:** `28`
* **Foreign Key References:** `5`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `booking_number` | `text` | ✅ Yes | — | |
| `service_id` | `uuid` | ❌ No | — | 🔗 FK -> `additional_services.id` |
| `branch_id` | `integer` | ✅ Yes | — | 🔗 FK -> `branches.id` |
| `customer_type` | `text` | ✅ Yes | `'walk_in'::text` | |
| `guest_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `guests.id` |
| `customer_name` | `text` | ✅ Yes | — | |
| `customer_phone` | `text` | ✅ Yes | — | |
| `customer_email` | `text` | ✅ Yes | — | |
| `booking_date` | `date` | ❌ No | — | |
| `start_time` | `time without time zone` | ✅ Yes | — | |
| `end_time` | `time without time zone` | ✅ Yes | — | |
| `duration_hours` | `numeric` | ✅ Yes | — | |
| `number_of_people` | `integer` | ✅ Yes | `1` | |
| `total_amount` | `numeric` | ✅ Yes | `0` | |
| `deposit_amount` | `numeric` | ✅ Yes | `0` | |
| `balance_amount` | `numeric` | ✅ Yes | `0` | |
| `payment_status` | `text` | ✅ Yes | `'pending'::text` | |
| `booking_status` | `text` | ✅ Yes | `'pending'::text` | |
| `special_requests` | `text` | ✅ Yes | — | |
| `notes` | `text` | ✅ Yes | — | |
| `booked_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `confirmed_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `confirmed_at` | `timestamp with time zone` | ✅ Yes | — | |
| `cancelled_at` | `timestamp with time zone` | ✅ Yes | — | |
| `cancellation_reason` | `text` | ✅ Yes | — | |
| `created_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `updated_at` | `timestamp with time zone` | ✅ Yes | `now()` | |

#### Foreign Key Relationships
- `service_bookings.booked_by` ➔ `users.id`
- `service_bookings.branch_id` ➔ `branches.id`
- `service_bookings.confirmed_by` ➔ `users.id`
- `service_bookings.guest_id` ➔ `guests.id`
- `service_bookings.service_id` ➔ `additional_services.id`

---

### Table: `booking_status_history`
* **Live Row Count:** `0`
* **Total Columns:** `7`
* **Foreign Key References:** `2`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `booking_id` | `uuid` | ❌ No | — | 🔗 FK -> `bookings.id` |
| `old_status` | `text` | ✅ Yes | — | |
| `new_status` | `text` | ❌ No | — | |
| `changed_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `reason` | `text` | ✅ Yes | — | |
| `created_at` | `timestamp with time zone` | ✅ Yes | `now()` | |

#### Foreign Key Relationships
- `booking_status_history.booking_id` ➔ `bookings.id`
- `booking_status_history.changed_by` ➔ `users.id`

---

### Table: `reservation_guests`
* **Live Row Count:** `0`
* **Total Columns:** `5`
* **Foreign Key References:** `2`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `reservation_id` | `uuid` | ❌ No | — | 🔗 FK -> `reservations.id` |
| `guest_id` | `uuid` | ❌ No | — | 🔗 FK -> `guests.id` |
| `is_primary` | `boolean` | ✅ Yes | `false` | |
| `created_at` | `timestamp with time zone` | ✅ Yes | `now()` | |

#### Foreign Key Relationships
- `reservation_guests.guest_id` ➔ `guests.id`
- `reservation_guests.reservation_id` ➔ `reservations.id`

---

### Table: `rate_plans`
* **Live Row Count:** `5`
* **Total Columns:** `15`
* **Foreign Key References:** `2`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `branch_id` | `integer` | ✅ Yes | — | 🔗 FK -> `branches.id` |
| `room_type_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `room_types.id` |
| `code` | `text` | ❌ No | — | |
| `name` | `text` | ❌ No | — | |
| `rate_per_night` | `numeric` | ❌ No | `0` | |
| `meal_plan` | `text` | ✅ Yes | `'room_only'::text` | |
| `min_stay` | `integer` | ✅ Yes | `1` | |
| `max_stay` | `integer` | ✅ Yes | — | |
| `is_active` | `boolean` | ✅ Yes | `true` | |
| `valid_from` | `date` | ✅ Yes | — | |
| `valid_to` | `date` | ✅ Yes | — | |
| `metadata` | `jsonb` | ✅ Yes | `'{}'::jsonb` | |
| `created_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `updated_at` | `timestamp with time zone` | ✅ Yes | `now()` | |

#### Foreign Key Relationships
- `rate_plans.branch_id` ➔ `branches.id`
- `rate_plans.room_type_id` ➔ `room_types.id`

---

### Table: `restaurant_bills`
* **Live Row Count:** `0`
* **Total Columns:** `32`
* **Foreign Key References:** `8`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `branch_id` | `integer` | ✅ Yes | — | 🔗 FK -> `branches.id` |
| `order_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `restaurant_orders.id` |
| `bill_number` | `text` | ❌ No | — | |
| `customer_name` | `text` | ✅ Yes | — | |
| `subtotal` | `numeric` | ✅ Yes | `0` | |
| `tax_amount` | `numeric` | ✅ Yes | `0` | |
| `total_amount` | `numeric` | ✅ Yes | `0` | |
| `amount_paid` | `numeric` | ✅ Yes | `0` | |
| `balance_due` | `numeric` | ✅ Yes | `0` | |
| `status` | `text` | ✅ Yes | `'open'::text` | |
| `payment_method` | `text` | ✅ Yes | — | |
| `created_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `created_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `updated_at` | `timestamp with time zone` | ✅ Yes | `now()` | |
| `table_number` | `text` | ✅ Yes | — | |
| `room_number` | `text` | ✅ Yes | — | |
| `guest_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `guests.id` |
| `guest_name` | `text` | ✅ Yes | — | |
| `guest_phone` | `text` | ✅ Yes | — | |
| `waiter_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |
| `short_code` | `text` | ✅ Yes | — | |
| `balance` | `numeric` | ✅ Yes | `0` | |
| `vat_rate` | `numeric` | ✅ Yes | `16.00` | |
| `service_charge_rate` | `numeric` | ✅ Yes | `0` | |
| `parent_bill_id` | `uuid` | ✅ Yes | — | 🔗 FK -> `restaurant_bills.id` |
| `split_type` | `text` | ✅ Yes | — | |
| `is_split` | `boolean` | ✅ Yes | `false` | |
| `is_merged` | `boolean` | ✅ Yes | `false` | |
| `merged_into` | `uuid` | ✅ Yes | — | 🔗 FK -> `restaurant_bills.id` |
| `closed_at` | `timestamp with time zone` | ✅ Yes | — | |
| `closed_by` | `uuid` | ✅ Yes | — | 🔗 FK -> `users.id` |

#### Foreign Key Relationships
- `restaurant_bills.branch_id` ➔ `branches.id`
- `restaurant_bills.closed_by` ➔ `users.id`
- `restaurant_bills.created_by` ➔ `users.id`
- `restaurant_bills.guest_id` ➔ `guests.id`
- `restaurant_bills.merged_into` ➔ `restaurant_bills.id`
- `restaurant_bills.order_id` ➔ `restaurant_orders.id`
- `restaurant_bills.parent_bill_id` ➔ `restaurant_bills.id`
- `restaurant_bills.waiter_id` ➔ `users.id`

---

### Table: `pos_master_bills`
* **Live Row Count:** `1`
* **Total Columns:** `20`
* **Foreign Key References:** `0`

#### Columns & Schema Definitions
| Column Name | Data Type | Nullable | Default Value | Description / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | ❌ No | `gen_random_uuid()` | **[PRIMARY KEY]** |
| `master_bill_number` | `text` | ❌ No | — | |
| `branch_id` | `integer` | ❌ No | — | |
| `origin_outlet_id` | `uuid` | ✅ Yes | — | |
| `origin_outlet_name` | `text` | ✅ Yes | — | |
| `table_number` | `text` | ✅ Yes | — | |
| `customer_name` | `text` | ✅ Yes | — | |
| `opening_waiter_id` | `uuid` | ✅ Yes | — | |
| `opening_waiter_name` | `text` | ✅ Yes | — | |
| `settlement_cashier_id` | `uuid` | ✅ Yes | — | |
| `settlement_cashier_name` | `text` | ✅ Yes | — | |
| `payment_method` | `text` | ✅ Yes | — | |
| `status` | `text` | ❌ No | `'open'::text` | |
| `total_amount` | `numeric` | ❌ No | `0` | |
| `amount_paid` | `numeric` | ❌ No | `0` | |
| `created_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `updated_at` | `timestamp with time zone` | ❌ No | `now()` | |
| `bill_requested_at` | `timestamp with time zone` | ✅ Yes | — | |
| `paid_at` | `timestamp with time zone` | ✅ Yes | — | |
| `closed_at` | `timestamp with time zone` | ✅ Yes | — | |

---


## 3. RECEPTION FEATURE DEEP-DIVE & BUSINESS LOGIC WORKFLOWS

### 3.1 Bookings & Reservations System
- **Twin Data Model (`reservations` & `bookings`):** Primary reservations live in `reservations` table, with status lifecycle: `pending`, `confirmed`, `checked_in`, `checked_out`, `cancelled`, `no_show`.
- **Reservation Creation & Pricing:** Calculates night count using Nairobi timezone (`en-CA` date formatting). Applies rate plans from `rate_plans` or custom room rates.
- **Check-In Workflow:** 
  1. Validates room status (must be vacant & clean/inspected).
  2. Updates reservation status to `checked_in`.
  3. Updates room status in `rooms` to `occupied`.
  4. Automatically initializes or attaches a guest folio in `folios` with opening room charges.
  5. Records timestamp in `checked_in_at`.
- **Check-Out Workflow:**
  1. Verifies folio balance is zero (`balance <= 0`).
  2. Settle outstanding charges or posts final payment via cashier.
  3. Updates reservation status to `checked_out` and sets `checked_out_at`.
  4. Updates room status to `dirty` (triggering housekeeping cleaning task in `housekeeping_tasks` / `hk_tasks`).
  5. Closes the guest folio (`status = 'closed'`).

### 3.2 Guest Profile & Document Management (`guests`, `guest_profiles`, `guest_documents`)
- **Guest Master Identification:** Tracks guest details including full name, phone number, email, national ID / Passport number, nationality, and VIP status.
- **KYC & Security Compliance:** Document uploads (`guest_documents`) store scanned copies of ID/Passport for police/security compliance.
- **Preference Tracking (`guest_preferences`):** Stores guest room preferences (e.g., quiet room, high floor, non-smoking, extra pillow).

### 3.3 Room Management & Real-Time Room Status (`rooms`, `room_types`, `room_status_history`)
- **Room Statuses:** `vacant_clean`, `vacant_dirty`, `occupied`, `out_of_order`, `out_of_service`, `maintenance`.
- **Audit History:** Any status transition writes a detailed log entry to `room_status_history` capturing previous status, new status, changed by user ID, reason, and branch ID.

### 3.4 Guest Folios & Accounting Engine (`folios`, `folio_items`, `folio_payments`, `folio_transactions`)
- **Folio Structure:**
  - `room_charges`: Total room stay cost.
  - `food_charges`: Restaurant & room service food charges.
  - `beverage_charges`: Bar & lounge beverage charges.
  - `other_charges`: Laundry, spa, transfer, or misc service charges.
  - `total_charges`: Sum of all charges.
  - `total_payments`: Cumulative payments posted to folio.
  - `balance`: Calculated as `total_charges - total_payments`.
- **Automated Database Triggers:** Triggers recalculate `total_payments`, `total_charges`, and `balance` upon insertion of rows into `transactions` / `folio_items`.

### 3.5 Charge-To-Room Functionality & Cross-Module Settlement
- **Outlet Posting Engine (`room-charge.controller.ts`):** Allows Cashiers and POS operators at Restaurant, Bar, Spa, or Outlets to post open bills directly to an in-house guest's room folio.
- **Validation Steps:**
  1. Checks if `GUEST_ROOM_CHARGING` feature flag is enabled for the branch in `branch_features`.
  2. Verifies specific outlet permission (e.g., `RESTAURANT_ROOM_CHARGING`, `EXECUTIVE_BAR_ROOM_CHARGING`, `SPORTS_BAR_ROOM_CHARGING`).
  3. Verifies that the guest reservation is actively checked-in (`status IN ('checked_in', 'checked-in', 'in-house', 'active')`) and check-in date <= today.
  4. Automatically resolves charge bucket (`Food`, `Beverage`, `Other`).
  5. Inserts charge row into `transactions` for the folio.
  6. Automatically updates the original POS source order/bill status to `paid` with payment method `ROOM_CHARGE` across 7 potential bill tables:
     - `pos_shift_orders`
     - `unpaid_bills`
     - `shift_transactions`
     - `pos_master_bills`
     - `restaurant_orders`
     - `bar_orders`
     - `pos_orders`

### 3.6 Cashier & Shift Management Engine (`cashier_shifts`, `cashier_shift_logs`, `cashier_transactions`, `cashier_logbooks`)
- **Shift Opening:** Cashier opens shift with an opening float (`opening_float`).
- **Shift Reconciliation & Closing:**
  - Records breakdown of total collections by payment mode: `cash_collected`, `mpesa_collected`, `card_collected`, `bank_transfer_collected`, `room_charge_total`, `credit_bill_total`.
  - Calculates variance: `expected_cash = opening_float + cash_collected - cash_payouts`, `cash_variance = actual_cash_drawer - expected_cash`.
  - Shift closing status requires supervisor/auditor clearance if variance exists (`cashier-clearance.controller.ts`).

### 3.7 Room Payments, Billing & Credit Management (`payments`, `branch_payments`, `credit_bills`, `unpaid_bills`, `void_bills`)
- **Supported Payment Methods:** Cash, M-Pesa (STK Push & Manual Reference), Credit Card (Stripe/Paystack), Bank Transfer, Room Charge, Staff/Corporate Credit.
- **Credit Bills (`credit_bills`):** Handles credit sales for corporate clients or approved guests. Tracks payment due date, auditor approvals, reconciliation status, and partial payments.
- **Void Bills & Auditing (`void_bills`, `void_requests`, `cashier_shift_void_audits`):** Any voided bill requires explicit supervisor approval, reason logging, and audit tracking.

### 3.8 Breakfast Pax & Meal Plan Engine (`accommodation_breakfast_pax`)
- **Pax Calculation (`calculateBreakfastPaxSnapshot`):**
  - Queries all checked-in guests for the branch.
  - Normalizes meal plans (`BB`, `HB`, `FB`, `Bed & Breakfast`, etc.).
  - Deluxe, Executive, and VIP room types automatically include breakfast eligibility.
  - Generates daily breakfast headcount snapshot for kitchen & restaurant staff reconciliation.

---

## 4. BACKEND API ENDPOINTS & CONTROLLER MAPPING

| HTTP Method | Route Endpoint | Controller File | Function Name | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/bookings` | `booking.controller.ts` | `getBookings` | List all reservations with filters & branch isolation |
| `POST` | `/api/bookings` | `booking.controller.ts` | `createBooking` | Create a new room reservation |
| `POST` | `/api/bookings/:id/check-in` | `booking.controller.ts` | `checkIn` | Execute guest check-in & room status update |
| `POST` | `/api/bookings/:id/check-out` | `booking.controller.ts` | `checkOut` | Execute guest check-out, folio closure & HK task trigger |
| `GET` | `/api/rooms` | `room.controller.ts` | `getRooms` | Fetch rooms listing with real-time status |
| `PATCH` | `/api/rooms/:id/status` | `room.controller.ts` | `updateRoomStatus` | Update room operational status & log to history |
| `GET` | `/api/guests` | `guest.controller.ts` | `getGuests` | Search and list guest profiles |
| `POST` | `/api/guests` | `guest.controller.ts` | `createGuest` | Create a new guest profile |
| `GET` | `/api/room-charge/eligible-guests` | `room-charge.controller.ts` | `getEligibleGuests` | List current in-house guests eligible for room charging |
| `POST` | `/api/room-charge/post` | `room-charge.controller.ts` | `postRoomCharge` | Post POS bill to in-house room folio & settle source bill |
| `POST` | `/api/room-charge/folio/:id/settle` | `room-charge.controller.ts` | `settleRoomBill` | Settle outstanding room folio balance at cashier |
| `GET` | `/api/cashier/shifts/active` | `cashier-shifts.controller.ts` | `getActiveShift` | Get currently open cashier shift |
| `POST` | `/api/cashier/shifts/open` | `cashier-shifts.controller.ts` | `openShift` | Open cashier shift with initial float |
| `POST` | `/api/cashier/shifts/close` | `cashier-shifts.controller.ts` | `closeShift` | Reconcile and close cashier shift |
| `GET` | `/api/credit-bills` | `credit-bills.controller.ts` | `getCreditBills` | Fetch corporate/guest credit bills |

---

## 5. FRONTEND CLIENT ARCHITECTURE (`famous_gates_app/`)

Located in `famous_gates_app/lib/features/reception` and `famous_gates_app/lib/features/cashier`:

### Key Presentation Screens
1. **Reception Dashboard (`lib/features/reception/presentation/reception_dashboard.dart` - 294 KB):**
   - Main front-desk hub displaying room grid, occupancy stats, quick check-in/check-out actions, arrival/departure feeds, and in-house guest list.
2. **Check-In Screen (`screens/check_in_screen.dart`):**
   - Handles guest search, room selection, ID verification, deposit payment, and check-in confirmation.
3. **Check-Out Screen (`screens/check_out_screen.dart`):**
   - Displays complete folio balance, itemized breakdown (room, food, beverage, laundry), payment collection, receipt printing, and check-out execution.
4. **Create Reservation Screen (`screens/create_reservation_screen.dart`):**
   - Date picker, room type selector, rate calculation, guest details, and advance deposit collection.
5. **Room Management Screen (`screens/room_management_screen.dart`):**
   - Interactive room grid with real-time status toggles (clean, dirty, out of order) and housekeeping assignment.
6. **Conference Booking Screen (`screens/conference_booking_screen.dart` - 102 KB):**
   - Conference hall reservation, seating arrangement, PAX count, and catering package selection.
7. **Cashier Dashboard (`lib/features/cashier/presentation/cashier_dashboard.dart` - 348 KB):**
   - Comprehensive POS & Front Desk Cashier station handling shift open/close, cash drawer management, bill settlement, room charge processing, and daily logbooks.

---

## 6. DATA ISOLATION & SECURITY AUDIT

1. **Multi-Branch Isolation (`branch_id`):**
   - Every reception table (`reservations`, `rooms`, `folios`, `cashier_shifts`, `payments`, `credit_bills`) includes an explicit `branch_id` column.
   - Database queries apply `applyBranchFilter()` middleware to enforce that branch staff can only view and mutate data belonging to their assigned branch.
   - Global roles (`super_admin`, `director`, `general_manager`, `auditor`) bypass branch restriction for cross-branch reporting.
2. **Audit Logging & Security:**
   - Security-sensitive actions (voiding bills, room status changes, manual balance adjustments) log to `audit_logs` and `cashier_shift_void_audits`.
   - RLS policies on Supabase prevent direct unauthorized database mutations from non-service clients.

---

## 7. SUMMARY & RECOMMENDATIONS

1. **Schema Consistency:** The twin presence of `reservations` and `bookings` is resolved in business logic by treating `reservations` as the active primary operational store.
2. **Charge-To-Room Robustness:** The charge-to-room engine cleanly settlement-syncs across 7 distinct source bill tables, eliminating orphan unpaid orders when charged to a room.
3. **Offline Sync Safety:** Ensure PowerSync triggers on `famous_gates_app` handle concurrent room status edits during network reconnection.

