import { Link } from 'react-router-dom';
export default function AvatarStudioLink() {
  return <aside className="my-5 flex flex-wrap items-center justify-between gap-3 border border-stone-700 bg-stone-950 p-5 text-stone-100" aria-label="Avatar Studio workflows">
    <div><h2 className="font-semibold">Avatar Studio workflows</h2><p className="mt-1 text-sm text-stone-400">Podcasts, interviews, presenters, teachers and instructors. Review content before production.</p></div>
    <Link className="border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-100/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200" to="/avatar-studio">Explore use cases</Link>
  </aside>;
}
