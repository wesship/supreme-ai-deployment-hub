create extension if not exists vector;

create table if not exists public.ai_films (
  id text primary key,
  title text not null,
  category text not null,
  description text not null,
  duration_label text not null,
  release_year integer not null,
  maturity text not null,
  topics text[] not null default '{}',
  poster_url text,
  trailer_url text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_film_library (
  user_id uuid not null references auth.users(id) on delete cascade,
  film_id text not null references public.ai_films(id) on delete cascade,
  saved boolean not null default false,
  progress integer not null default 0 check (progress between 0 and 100),
  last_position_seconds integer not null default 0 check (last_position_seconds >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, film_id)
);

create table if not exists public.ai_film_transcript_chunks (
  id uuid primary key default gen_random_uuid(),
  film_id text not null references public.ai_films(id) on delete cascade,
  chunk_index integer not null,
  start_seconds integer not null default 0,
  end_seconds integer not null default 0,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (film_id, chunk_index)
);

create index if not exists ai_film_transcript_chunks_film_idx
  on public.ai_film_transcript_chunks (film_id, chunk_index);

create index if not exists ai_film_transcript_embedding_idx
  on public.ai_film_transcript_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table public.ai_films enable row level security;
alter table public.ai_film_library enable row level security;
alter table public.ai_film_transcript_chunks enable row level security;

create policy "Published films are publicly readable"
  on public.ai_films for select
  using (published = true or auth.role() = 'authenticated');

create policy "Users manage their own film library"
  on public.ai_film_library for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Published film transcripts are readable"
  on public.ai_film_transcript_chunks for select
  using (
    exists (
      select 1 from public.ai_films films
      where films.id = ai_film_transcript_chunks.film_id
        and films.published = true
    )
  );

create or replace function public.match_ai_film_transcript(
  query_embedding vector(1536),
  match_film_id text,
  match_count integer default 6
)
returns table (
  id uuid,
  film_id text,
  chunk_index integer,
  start_seconds integer,
  end_seconds integer,
  content text,
  similarity double precision
)
language sql
stable
security invoker
as $$
  select
    chunks.id,
    chunks.film_id,
    chunks.chunk_index,
    chunks.start_seconds,
    chunks.end_seconds,
    chunks.content,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from public.ai_film_transcript_chunks chunks
  where chunks.film_id = match_film_id
    and chunks.embedding is not null
  order by chunks.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

grant execute on function public.match_ai_film_transcript(vector, text, integer) to authenticated, anon;
