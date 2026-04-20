# Asset Storage Design — Phase 71

Date: 2026-04-20  
Status: Approved (design), Implementation pending (71-02)

---

## Bucket Layout

**Decision: one bucket per project** (`project-assets-<project_uuid>`), plus a
global `shared-assets` bucket for cross-project transfer staging.

### Rationale

| Option | Pros | Cons |
|---|---|---|
| Per-project buckets | Clean RLS via bucket name; owner obvious; delete-project can delete bucket atomically | Supabase has a bucket count limit; creating at project-create time adds latency |
| Single bucket + path prefix | One bucket; no count ceiling | Path-prefix RLS is verbose; accidental cross-project reads if prefix policy is wrong |

Per-project buckets win on ownership clarity and security boundary. Supabase
free tier permits 100 buckets — sufficient for early operation. Quota management
issue filed as HUMAN-TODO below.

### Bucket naming

```
project-assets-<project_uuid>     # e.g. project-assets-00000000-0000-0000-0000-000000000001
shared-assets                     # global; used only for cross-project transfer intermediary
```

Buckets are created at project-create time via
`create_project_bucket(project_id uuid)` (see migration).

---

## Public vs Private Access

| Scenario | Bucket setting | URL type |
|---|---|---|
| Private project asset | private bucket | Supabase Storage signed URL, TTL 60s (UI renders) |
| Private project asset for agent handoff | private bucket | Signed URL, TTL 86400s (24h) |
| Public project asset | public bucket (flip on project visibility change) | Permanent public URL via `storage/v1/object/public/<bucket>/<path>` |
| Marketplace asset (shared-assets) | public bucket | Permanent public URL |
| Cross-project transfer source (owner downloads to transfer) | private bucket | Signed URL, TTL 3600s |

**Policy rules:**
- Private projects: no public bucket; all consumer access via signed URLs generated server-side.
- When `projects.visibility` changes `private → public`: bucket `public` flag flipped via admin call (server-role); RLS policy on `assets` table already allows SELECT. Flip is idempotent.
- When `projects.visibility` changes `public → private`: bucket `public` flag cleared; existing signed URLs expire on their own TTL.
- `shared-assets` bucket is always public-read (marketplace display case).

---

## RLS Policies

Supabase Storage RLS uses `auth.uid()` — this is the Supabase auth UID from the
JWT sub claim. Because the platform uses Clerk JWTs passed as Bearer tokens, the
JWT `sub` claim is the Clerk user ID.

**Mapping:** Clerk JWT → Supabase RLS works when Clerk JWKS URL is registered as
a custom JWT provider in the Supabase project dashboard. Once registered,
`auth.uid()` returns the Clerk `sub` claim value.

### Per-project bucket policies (template — instantiated per bucket)

```sql
-- Owner: read + write
CREATE POLICY "owner_rw" ON storage.objects
  FOR ALL
  USING (bucket_id = 'project-assets-<uuid>'
         AND (storage.foldername(name))[1] = auth.uid())  -- optional path enforcement
  WITH CHECK (bucket_id = 'project-assets-<uuid>'
              AND auth.uid() IN (
                SELECT owner_user_id FROM public.projects WHERE id = '<uuid>'::uuid
              ));

-- Public read (activated only when project.visibility = 'public')
CREATE POLICY "public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'project-assets-<uuid>'
         AND EXISTS (
           SELECT 1 FROM public.projects
           WHERE id = '<uuid>'::uuid AND visibility = 'public'
         ));
```

### Cross-project access

No direct cross-bucket access is granted. Transfer is mediated by the CLI:
1. CLI downloads object from source bucket (owner auth).
2. CLI uploads to destination bucket (caller must own destination project).
3. New `assets` metadata row written to destination project.

---

## Cross-Project Transfer Model

**Decision: copy (option a)**

| Option | Mechanism | Trade-off |
|---|---|---|
| (a) Copy object + new metadata row | `storage.from(dest).upload(path, blob)` + `INSERT INTO assets` | Doubles storage for transferred assets; ownership is unambiguous; delete-source doesn't break destination |
| (b) Shared storage_path, multiple metadata rows | Single storage object, two `assets` rows pointing at same `bucket_name/storage_path` | Zero-copy; fragile — if source project deletes the asset, destination row becomes an orphan; RLS fights across bucket owners |

Option (a) wins. Storage is cheap; split ownership is a correctness hazard.

`--keep-source` flag (on `gad assets transfer`) controls whether the source
`assets` row is deleted after copy. Storage object in source bucket is always
preserved unless operator explicitly calls `gad assets delete`.

---

## Naming Conventions

### Storage path within bucket

```
<species_slug>/<generation_id>/<asset_slug>.<ext>
```

Examples:
```
demo-gad/00000000-0000-0000-0000-000000000003/hero-banner-a1b2c3d4.png
demo-gad/00000000-0000-0000-0000-000000000003/prompt-output-e5f6a7b8.json
```

### Asset slug derivation

```
<sanitized_name>-<content_hash_8>.<ext>
```

- `sanitized_name`: lowercase, spaces→hyphens, strip non-`[a-z0-9-_]` chars, max 64 chars.
- `content_hash_8`: first 8 hex chars of SHA-256 of file content.
- Extension: from MIME type map or original file extension, lowercase.

### Collision handling

Slug is deterministic from (name, content). Two uploads of identical content
with identical names produce the same path — which is a no-op upsert on
`assets (bucket_name, storage_path)` UNIQUE constraint. Different content with
same name gets a different hash suffix, so paths never collide between distinct
content.

### Filename sanitization steps

1. Strip path separators (`/`, `\`).
2. Normalize unicode to NFC then ASCII-fold.
3. Lowercase.
4. Replace spaces and underscores with hyphens.
5. Strip remaining non-`[a-z0-9\-.]` characters.
6. Truncate name portion to 64 chars before appending hash.
7. Reject empty result (error — caller must provide a name).

---

## URL Resolution Table

| Scenario | Bucket type | URL returned | TTL |
|---|---|---|---|
| Public project, any asset | public | `<supabase_url>/storage/v1/object/public/<bucket>/<path>` | permanent |
| Private project, UI render | private | Signed URL from `storage.createSignedUrl` | 60s |
| Private project, agent handoff | private | Signed URL | 86400s (24h) |
| Cross-project transfer (CLI download) | private | Signed URL | 3600s |
| Marketplace / shared-assets | public | Public URL | permanent |

Signed URL expiration policy:
- Default (`gad assets download`): 3600s
- `--ttl <seconds>` flag on download overrides; max enforced at 86400s (24h)
- UI link generation (platform app `GET /api/assets/:id/url`): 60s
- Agent-to-agent handoff (`--handoff` flag): 86400s

---

## Quota Strategy

DEFERRED. Supabase free tier = 1 GB storage total. Generation artifacts
(images, traces, build zips) will exhaust this quickly at scale.

**HUMAN-TODO:** Pick Supabase plan (Pro = 100 GB) before phase 71 goes to
production. Also evaluate whether large generation artifacts (multi-MB ZIPs)
should bypass Supabase Storage entirely in favor of object storage with
Supabase as metadata-only.

---

## Metadata-vs-Storage Consistency

Two failure modes:

### Orphan storage object (no DB row)

Cause: upload succeeded, INSERT failed (crash / network).

Reconciliation job (follow-up, not in 71-02):
- Enumerate all objects in each project bucket via `storage.list()`.
- Cross-reference against `assets` table `(bucket_name, storage_path)`.
- Objects with no matching row → flag as orphans → operator review queue.
- Optional: auto-purge orphans older than 7 days.

### Ghost DB row (storage object missing)

Cause: asset row exists, storage object was deleted outside CLI (direct
Supabase dashboard deletion, bucket purge).

Reconciliation job (follow-up):
- For each `assets` row, call `storage.from(bucket).list(prefix)` and verify
  object exists.
- Missing objects → mark row `status='missing'` (requires schema amendment in
  71-02 or later).
- `gad assets list` shows `[MISSING]` label for affected rows.

Both reconciliation jobs are out-of-scope for 71-02; documented here so the
design is complete.
