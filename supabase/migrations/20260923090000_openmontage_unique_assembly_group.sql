-- One FFmpeg assembly per OpenMontage group, even with multiple coordinators.
create unique index if not exists ai_film_render_jobs_openmontage_assembly_group_uidx
  on public.ai_film_render_jobs (project_id, (input->>'openmontage_job_id'))
  where job_type = 'assembly' and nullif(input->>'openmontage_job_id', '') is not null;
