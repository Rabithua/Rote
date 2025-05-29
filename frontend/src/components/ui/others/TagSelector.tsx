import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { get } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';

export function TagSelector({
  tags,
  setTags,
  callback,
}: {
  tags: string[];
  setTags: (_tags: string[]) => void;
  callback?: (_tags: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const { data: availableTags } = useAPIGet<string[]>('tags', () =>
    get('/users/me/tags').then((res) => res.data)
  );

  const [inputValue, setInputValue] = React.useState('');

  const handleTagSelect = (tag: string) => {
    const updatedTags = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];

    setTags(updatedTags);
    callback?.(updatedTags);
  };

  const handleAddCustomTag = () => {
    if (inputValue.trim() && !availableTags?.includes(inputValue)) {
      const newTag = inputValue.trim();
      handleTagSelect(newTag);
      setInputValue('');
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      handleAddCustomTag();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[120px] sm:w-[160px] justify-between overflow-hidden"
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
          <CommandInput
            placeholder="搜索标签..."
            value={inputValue}
            onValueChange={setInputValue}
            onKeyDown={handleInputKeyDown}
          />
          <CommandList>
            <CommandEmpty>
              <div className="flex flex-col items-center px-1 py-2">
                <p className="text-muted-foreground mb-1 text-sm">未找到标签</p>
                {inputValue.trim() && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddCustomTag}
                    className="flex w-full items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    <span>添加 "{inputValue}"</span>
                  </Button>
                )}
              </div>
            </CommandEmpty>
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
            {inputValue.trim() && !availableTags?.includes(inputValue) && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={handleAddCustomTag}>
                    <Plus className="mr-2 h-4 w-4" />
                    {inputValue}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
