import { profileAtom } from '@/state/profile';
import { API_URL } from '@/utils/api';
import { useAtomValue } from 'jotai';
import { Rss } from 'lucide-react';

export default function ProfileSidebar() {
  const profile = useAtomValue(profileAtom);
  return (
    <div className="grid grid-cols-3 divide-x border-b">
      <a
        href={`${API_URL}/rss/${profile?.username}`}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-foreground/3 flex cursor-pointer items-center justify-center gap-2 py-4"
      >
        <Rss className="size-5" />
        <div className="text-xl">RSS</div>
      </a>
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="text-xl">☝️</div>
      </div>
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="text-xl">🤓</div>
      </div>
    </div>
  );
}
