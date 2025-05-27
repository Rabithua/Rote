import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { apiGetMyTags } from '@/api/rote/main';
import { useAPIGet } from '@/utils/fetcher';

export function TagSelector({
  tags,
  setTags,
  callback,
}: {
  tags: string[];
  setTags: (tags: string[]) => void;
  callback?: (tags: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const { data: availableTags } = useAPIGet<string[]>('tags', apiGetMyTags);

  const handleTagSelect = (tag: string) => {
    const updatedTags = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];

    setTags(updatedTags);
    callback?.(updatedTags);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[140px] justify-between overflow-hidden"
          style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          <span className="flex-1 overflow-hidden text-left text-ellipsis whitespace-nowrap">
            {tags.length > 0 ? `${tags.length} 个标签` : '选择标签...'}
          </span>
          <ChevronsUpDown className="ml-2 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[140px] p-0">
        <Command>
          <CommandInput placeholder="搜索标签..." />
          <CommandList>
            <CommandEmpty>未找到标签。</CommandEmpty>
            <CommandGroup>
              {availableTags?.map((tag) => (
                <CommandItem key={tag} value={tag} onSelect={() => handleTagSelect(tag)}>
                  {tag}
                  <Check
                    className={cn('ml-auto', tags.includes(tag) ? 'opacity-100' : 'opacity-0')}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
