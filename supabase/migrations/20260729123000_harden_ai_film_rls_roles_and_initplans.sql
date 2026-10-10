-- Narrow AI Film policies to intended roles and evaluate auth.uid() once per statement.
begin;

alter policy "Users manage their own film library" on public.ai_film_library
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Published film transcripts are readable" on public.ai_film_transcript_chunks
  to authenticated
  using (
    exists (
      select 1
      from public.ai_films films
      where films.id = ai_film_transcript_chunks.film_id
        and films.published = true
    )
  );

do $$
declare
  policy_row record;
begin
  for policy_row in
    select *
    from (values
      ('ai_film_projects', 'owners manage ai film projects'),
      ('ai_film_assets', 'owners manage ai film assets'),
      ('ai_film_entities', 'owners manage ai film entities'),
      ('ai_film_relationships', 'owners manage ai film relationships'),
      ('ai_film_canon_rules', 'owners manage ai film canon rules'),
      ('ai_film_scenes', 'owners manage ai film scenes'),
      ('ai_film_asset_versions', 'owners manage ai film asset versions'),
      ('ai_film_reviews', 'owners manage ai film reviews'),
      ('ai_film_release_checklists', 'owners manage ai film release checklists'),
      ('ai_film_render_jobs', 'owners manage ai film render jobs'),
      ('ai_film_storyboards', 'owners manage ai film storyboards'),
      ('ai_film_shots', 'owners manage ai film shots'),
      ('ai_film_render_attempts', 'owners manage ai film render attempts'),
      ('ai_film_export_jobs', 'owners manage ai film export jobs'),
      ('ai_film_subtitle_tracks', 'owners manage ai film subtitle tracks'),
      ('ai_film_publications', 'owners manage ai film publications'),
      ('ai_film_collaborators', 'owners manage ai film collaborators'),
      ('ai_film_activity_events', 'owners manage ai film activity events'),
      ('ai_film_analytics_snapshots', 'owners manage ai film analytics snapshots'),
      ('ai_film_commercial_releases', 'owners manage ai film commercial releases')
    ) as policies(table_name, policy_name)
  loop
    execute format(
      'alter policy %I on public.%I to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      policy_row.policy_name,
      policy_row.table_name
    );
  end loop;
end
$$;

alter policy "owners manage ai film review comments" on public.ai_film_review_comments
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and author_id = (select auth.uid())
  );

alter policy "owners manage ai film scene assets" on public.ai_film_scene_assets
  to authenticated
  using (
    exists (
      select 1
      from public.ai_film_scenes scene
      where scene.id = scene_id
        and scene.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.ai_film_scenes scene
      where scene.id = scene_id
        and scene.owner_id = (select auth.uid())
    )
  );

notify pgrst, 'reload schema';
commit;
