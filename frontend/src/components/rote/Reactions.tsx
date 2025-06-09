import mainJson from '@/json/main.json';
import type { Profile, Reaction } from '@/types/main';
import { get } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { SmilePlus } from 'lucide-react';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

const { preReactions } = mainJson;

export function ReactionsPart({
  reactions,
  onReaction,
}: {
  reactions: Reaction[];
  onReaction: (_reaction: string) => void;
}) {
  const { data: profile } = useAPIGet<Profile>('profile', () =>
    get('/users/me/profile').then((res) => res.data)
  );

  const [open, setOpen] = useState(false);

  function onReactionClick(reaction: string) {
    setOpen(false);
    onReaction(reaction);
  }

  // 按 type 分组 reactions
  const groupedReactions = reactions.reduce(
    (acc, reaction) => {
      const type = reaction.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(reaction);
      return acc;
    },
    {} as Record<string, Reaction[]>
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(groupedReactions).map(([type, reactionGroup]) => {
          const hasUserReacted =
            profile?.id && reactionGroup.some((reaction) => reaction.userid === profile.id);

          return (
            <div
              key={type}
              className={`flex cursor-pointer items-center gap-2 rounded-full px-3 py-1 text-sm duration-300 ${
                hasUserReacted
                  ? 'bg-theme/20 text-theme border-theme/30 hover:bg-theme/30 border-[0.5px]'
                  : 'bg-foreground/5 hover:bg-foreground/10'
              }`}
              onClick={() => onReactionClick(type)}
            >
              <span>{type}</span>
              <span className="text-xs">{reactionGroup.length}</span>
            </div>
          );
        })}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger>
          <SmilePlus className="bg-foreground/5 size-6 cursor-pointer rounded-2xl p-1 duration-300 hover:scale-110" />
        </PopoverTrigger>
        <PopoverContent side="bottom" className="bg-background/90 w-fit p-0 backdrop-blur-sm">
          <div className="flex flex-wrap divide-x">
            {preReactions.map((reaction) => (
              <div
                className="flex size-10 cursor-pointer items-center justify-center"
                key={reaction}
              >
                <span
                  className="duration-300 hover:scale-120"
                  onClick={() => onReactionClick(reaction)}
                >
                  {reaction}
                </span>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
