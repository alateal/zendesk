# Database Schema

## `users`
- **id**: `uuid` (Primary Key)
- **created_at**: `timestamptz`
- **display_name**: `text`
- **organizations_id**: `uuid` (Foreign Key to `organizations.id`)
- **role_id**: `uuid` (Foreign Key to `role.id`)
- **email**: `text`
- **auth.users.id**: References authentication user ID

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
- **id**: `int8` (Primary Key)
- **created_at**: `timestamptz`
