import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Command,
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
  const { data: availableTags } = useAPIGet<string[]>(
    'tags',
    () => get('/users/me/tags').then((res) => res.data),
    {
      revalidateOnFocus: true,
    }
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
    if (e.key === 'Enter') {
      e.preventDefault();

      // 首先尝试获取当前选中的 CommandItem
      const selectedItem = document.querySelector(
        '[data-selected="true"][data-slot="command-item"]'
      );

      if (selectedItem) {
        // 如果有选中的项目，获取其值并添加该标签
        const tagValue = selectedItem.getAttribute('data-value');
        if (tagValue) {
          handleTagSelect(tagValue);
          setInputValue('');
          return;
        }
      }

      // 如果没有选中的项目且有输入值，则添加自定义标签
      if (inputValue.trim()) {
        handleAddCustomTag();
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[120px] justify-between overflow-hidden sm:w-[160px]"
          style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          <span className="flex-1 overflow-hidden text-left text-ellipsis whitespace-nowrap">
            {tags.length > 0 ? `${tags.length} 个标签` : '选择标签...'}
          </span>
          <ChevronsUpDown className="ml-2 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="h-50 w-[140px] p-0">
        <Command>
          <CommandInput
            placeholder="搜索标签..."
            value={inputValue}
            onValueChange={setInputValue}
            onKeyDown={handleInputKeyDown}
          />
          <CommandList>
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
