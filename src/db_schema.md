# Database Schema

## `users`
- **id**: `uuid` (Primary Key)
- **created_at**: `timestamptz`
- **display_name**: `text`
- **organizations_id**: `uuid` (Foreign Key to `organizations.id`)
- **email**: `text`
- **auth.users.id**: References authentication user ID
- **role_id**: `uuid` (Foreign Key to `role.id`)

---

## `organizations`
- **id**: `uuid` (Primary Key)
- **created_at**: `timestamptz`
- **name**: `text`
- **logoUrl**: `text`


---

## `role`
- **id**: `uuid` (Primary Key)
- **created_at**: `timestamptz`
- **name**: `text`

---

## `conversations`
- **id**: `uuid` (Primary Key)
- **created_at**: `timestamptz`
- **organizations_id**: `uuid` (Foreign Key to `organizations.id`)
- **channels**: `text`
- **status**: `text`
- **customer_id**: `uuid`(Foreign Key to `customers.id`)
- **satisfaction_score**: `text`
- **is_important**: `boolean`
- **assigned_to**: `uuid` (Foreign Key to `users.id`, nullable)

---

## `messages`
- **id**: `uuid` (Primary Key)
- **created_at**: `timestamptz`
- **conversations_id**: `uuid` (Foreign Key to `conversations.id`)
- **organizations_id**: `uuid` (Foreign Key to `organizations.id`)
- **sender_id**: `text`
- **sender_type**: `text`
- **content**: `text`

---

## `customers`
- **id**: `uuid` (Primary Key)
- **created_at**: `timestamptz`
- **full_name**: `text`
- **email**: `text`
- **organizations_id**: `uuid` (Foreign Key to `organizations.id`)


