import PublicPageShell from '@/components/shell/PublicPageShell';
import FilmPage from './Film';

const breadcrumbs = [{ label: 'AI Films' }, { label: 'OpenMontage Studio' }];

const AIFilms = () => (
  <PublicPageShell breadcrumbs={breadcrumbs}>
    <section aria-label="AI Films production studio">
      <FilmPage />
    </section>
  </PublicPageShell>
);

export default AIFilms;
